// Edge Function `deepl`: proxy de traducción para IngApp.
//
// - La clave de DeepL vive en Supabase Vault (secreto `deepl_api_key`) y solo la
//   lee esta función, a través de public.get_deepl_key() (solo service_role).
// - Exige un usuario logueado (verify_jwt + getUser) y limita el consumo por
//   usuario y por pedido.
// - Cache compartido (translation_cache): cada texto del banco de contenido se
//   traduce una sola vez para todos los usuarios.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://jonnyalegria-prog.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate'
const MAX_ITEMS = 20
const MAX_CHARS_PER_REQUEST = 1500
const MAX_CONTEXT_CHARS = 500
const MAX_SUGGEST = 10
const MAX_EXCLUDE = 500
const MONTHLY_CAP_PER_USER = 300_000
const LEVELS = ['principiante', 'intermedio', 'avanzado']

type Lang = 'en' | 'es'
interface Item {
  text: string
  context?: string
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public stage: string,
  ) {
    super(message)
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://jonnyalegria-prog.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function getAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  let secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    if (keys?.default) secret = keys.default
  } catch {
    // formato inesperado: se usa la clave legacy
  }
  if (!url || !secret) throw new HttpError(500, 'Falta configuración del servidor.', 'config')
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function getUserId(admin: SupabaseClient, req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Inicia sesión para traducir.', 'auth')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Inicia sesión para traducir.', 'auth')
  return data.user.id
}

async function cacheKey(from: Lang, to: Lang, text: string, context: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([from, to, context, text]))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// DeepL entrega español latinoamericano genérico (ES-419); unas pocas palabras cambian en Chile.
const CHILEAN_WORDS: Record<string, string> = {
  computadora: 'computador',
  computadoras: 'computadores',
  fresa: 'frutilla',
  fresas: 'frutillas',
  melocotón: 'durazno',
  melocotones: 'duraznos',
  aguacate: 'palta',
  aguacates: 'paltas',
  frijol: 'poroto',
  frijoles: 'porotos',
}

// Solo palabras sueltas: en una frase el género de los artículos y adjetivos ("la palta" / "el computador") se rompería.
function chilenize(text: string): string {
  if (/\s/.test(text.trim())) return text
  return text.replace(/\p{L}+/gu, (word) => {
    const swap = CHILEAN_WORDS[word.toLowerCase()]
    if (!swap) return word
    return word[0] === word[0].toUpperCase() ? swap[0].toUpperCase() + swap.slice(1) : swap
  })
}

async function callDeepl(key: string, texts: string[], from: Lang, to: Lang, context?: string): Promise<string[]> {
  const body: Record<string, unknown> = {
    text: texts,
    source_lang: from.toUpperCase(),
    target_lang: to === 'en' ? 'EN-US' : 'ES-419',
  }
  if (context) body.context = context
  let res: Response
  try {
    res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new HttpError(502, 'No pude conectarme con DeepL. Prueba de nuevo en un ratito.', 'deepl_network')
  }
  if (!res.ok) {
    if (res.status === 456) throw new HttpError(429, 'Se agotó el cupo mensual de DeepL.', 'deepl_quota')
    if (res.status === 429) throw new HttpError(429, 'Demasiados pedidos seguidos. Prueba en unos segundos.', 'deepl_rate')
    if (res.status === 403) throw new HttpError(502, 'La clave de DeepL no es válida.', 'deepl_key')
    throw new HttpError(502, 'DeepL no respondió bien. Prueba de nuevo en un ratito.', 'deepl_error')
  }
  const data = await res.json()
  const out = data?.translations?.map((t: { text: string }) => t.text)
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new HttpError(502, 'Respuesta inesperada de DeepL.', 'deepl_shape')
  }
  return to === 'es' ? out.map(chilenize) : out
}

async function translateItems(
  admin: SupabaseClient,
  key: string,
  userId: string,
  from: Lang,
  to: Lang,
  items: Item[],
  useCache: boolean,
): Promise<string[]> {
  const keys = await Promise.all(items.map((i) => cacheKey(from, to, i.text, i.context ?? '')))
  const out: (string | null)[] = items.map(() => null)

  if (useCache) {
    const { data, error } = await admin.from('translation_cache').select('cache_key, translation').in('cache_key', keys)
    if (error) throw new HttpError(500, 'No se pudo leer el caché de traducciones.', 'cache_read')
    const hits = new Map((data ?? []).map((r) => [r.cache_key as string, r.translation as string]))
    keys.forEach((k, i) => {
      out[i] = hits.get(k) ?? null
    })
  }

  // Los pendientes idénticos se traducen una sola vez.
  const pending = new Map<string, number[]>()
  out.forEach((v, i) => {
    if (v !== null) return
    const list = pending.get(keys[i]) ?? []
    list.push(i)
    pending.set(keys[i], list)
  })
  if (pending.size === 0) return out as string[]

  const unique = [...pending.values()].map((idxs) => idxs[0])
  const chars = unique.reduce((n, i) => n + items[i].text.length, 0)
  const month = new Date().toISOString().slice(0, 7)

  const { data: reserved, error: reserveError } = await admin.rpc('reserve_translation_chars', {
    p_user: userId,
    p_month: month,
    p_chars: chars,
    p_cap: MONTHLY_CAP_PER_USER,
  })
  if (reserveError) throw new HttpError(500, 'No se pudo verificar el cupo mensual.', 'quota_check')
  if (!reserved) throw new HttpError(429, 'Llegaste al tope mensual de traducciones. Se renueva el próximo mes.', 'user_quota')

  try {
    const plain = unique.filter((i) => !items[i].context)
    const withContext = unique.filter((i) => items[i].context)
    if (plain.length) {
      const res = await callDeepl(key, plain.map((i) => items[i].text), from, to)
      plain.forEach((i, n) => {
        out[i] = res[n]
      })
    }
    // `context` es por pedido: cada término con contexto va en su propio pedido.
    for (let n = 0; n < withContext.length; n += 5) {
      const chunk = withContext.slice(n, n + 5)
      const res = await Promise.all(chunk.map((i) => callDeepl(key, [items[i].text], from, to, items[i].context)))
      chunk.forEach((i, m) => {
        out[i] = res[m][0]
      })
    }
  } catch (e) {
    await admin.rpc('refund_translation_chars', { p_user: userId, p_month: month, p_chars: chars })
    throw e
  }

  for (const idxs of pending.values()) {
    for (const i of idxs.slice(1)) out[i] = out[idxs[0]]
  }

  if (useCache) {
    const rows = unique.map((i) => ({
      cache_key: keys[i],
      source_lang: from,
      target_lang: to,
      text: items[i].text,
      context: items[i].context ?? '',
      translation: out[i] as string,
    }))
    const { error } = await admin.from('translation_cache').upsert(rows, { onConflict: 'cache_key', ignoreDuplicates: true })
    if (error) console.error('cache write failed', error.message)
  }

  return out as string[]
}

function parseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    throw new HttpError(400, `Se esperan entre 1 y ${MAX_ITEMS} textos.`, 'validation')
  }
  let total = 0
  const items = raw.map((r): Item => {
    const text = typeof r?.text === 'string' ? r.text.trim() : ''
    if (!text) throw new HttpError(400, 'Hay un texto vacío.', 'validation')
    total += text.length
    const context = typeof r?.context === 'string' ? r.context.trim().slice(0, MAX_CONTEXT_CHARS) : ''
    return context ? { text, context } : { text }
  })
  if (total > MAX_CHARS_PER_REQUEST) {
    throw new HttpError(400, `El texto es demasiado largo (máx. ${MAX_CHARS_PER_REQUEST} caracteres por pedido).`, 'validation')
  }
  return items
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface BankRow {
  term: string
  level: string
  theme: string
  example: string
  note: string | null
}

async function suggest(admin: SupabaseClient, key: string, userId: string, body: Record<string, unknown>) {
  const level = LEVELS.includes(body.level as string) ? (body.level as string) : 'principiante'
  const count = Math.min(Math.max(Math.trunc(Number(body.count ?? 5)) || 5, 1), MAX_SUGGEST)
  const exclude = new Set(
    (Array.isArray(body.exclude) ? body.exclude : [])
      .slice(0, MAX_EXCLUDE)
      .map((s) => String(s).trim().toLowerCase()),
  )

  // Primero el nivel elegido; si no alcanza, completa con el siguiente.
  const picks: BankRow[] = []
  for (const tier of LEVELS.slice(LEVELS.indexOf(level))) {
    if (picks.length >= count) break
    const { data, error } = await admin.from('vocab_bank').select('term, level, theme, example, note').eq('level', tier)
    if (error) throw new HttpError(500, 'No se pudo leer el banco de vocabulario.', 'bank_read')
    const fresh = shuffle((data as BankRow[]).filter((r) => !exclude.has(r.term.toLowerCase())))
    picks.push(...fresh.slice(0, count - picks.length))
  }
  if (picks.length === 0) return { suggestions: [], exhausted: true }

  const translations = await translateItems(
    admin,
    key,
    userId,
    'en',
    'es',
    picks.map((p) => ({ text: p.term, context: p.example })),
    true,
  )
  return {
    suggestions: picks.map((p, i) => ({ ...p, translation: translations[i] })),
    exhausted: false,
  }
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.', 'method')
    const admin = getAdmin()
    const userId = await getUserId(admin, req)
    const body = await req.json().catch(() => {
      throw new HttpError(400, 'El pedido no es JSON válido.', 'body')
    })

    const { data: key, error: keyError } = await admin.rpc('get_deepl_key')
    if (keyError || !key) throw new HttpError(500, 'La clave de DeepL no está configurada.', 'key')

    if (body.action === 'translate') {
      const from = body.from as Lang
      const to = body.to as Lang
      if (!['en', 'es'].includes(from) || !['en', 'es'].includes(to) || from === to) {
        throw new HttpError(400, 'Idiomas no válidos.', 'validation')
      }
      const items = parseItems(body.items)
      const translations = await translateItems(admin, key, userId, from, to, items, body.cache === true)
      return respond({ translations })
    }

    if (body.action === 'suggest') {
      return respond(await suggest(admin, key, userId, body))
    }

    throw new HttpError(400, 'Acción desconocida.', 'action')
  } catch (e) {
    if (e instanceof HttpError) return respond({ error: e.message, stage: e.stage }, e.status)
    console.error('unexpected', e)
    return respond({ error: 'Error inesperado en el servidor.', stage: 'unexpected' }, 500)
  }
})
