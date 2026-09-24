// Edge Function `send-reminders`: avisos push de IngApp.
//
// - Modo cron: pg_cron la llama cada hora con el encabezado x-cron-secret (secreto en Vault). Revisa quién tiene
//   recordatorios activados y manda los avisos que corresponden (ver reminderRules.ts).
// - Modo persona: con la sesión iniciada, entrega la clave pública VAPID ("vapid_public") y manda un aviso de prueba ("test").
// - Las claves VAPID se generan la primera vez y se guardan en Vault; la privada nunca sale de la base ni de esta función.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { decideReminders, localParts, type ReminderPrefs, type UserSnapshot } from './reminderRules.ts'

const ALLOWED_ORIGINS = new Set([
  'https://jonnyalegria-prog.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])
const APP_URL = 'https://jonnyalegria-prog.github.io/IngApp/'
const DEFAULT_TZ = 'America/Santiago'

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
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : APP_URL.replace(/\/IngApp\/$/, ''),
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
  if (!token) throw new HttpError(401, 'Inicia sesión primero.', 'auth')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Inicia sesión primero.', 'auth')
  return data.user.id
}

interface Vapid {
  public: string
  private: string
}

async function ensureVapid(admin: SupabaseClient): Promise<Vapid> {
  const read = async (): Promise<Vapid | null> => {
    const { data, error } = await admin.rpc('get_vapid_keys')
    if (error) throw new HttpError(500, 'No pude leer las claves de los avisos.', 'vapid_read')
    return data?.public && data?.private ? (data as Vapid) : null
  }
  const existing = await read()
  if (existing) return existing

  const keys = webpush.generateVAPIDKeys()
  const { error } = await admin.rpc('set_vapid_keys', { p_public: keys.publicKey, p_private: keys.privateKey })
  if (error) console.error('[send-reminders] set_vapid_keys failed', error.message)
  // Si otra llamada se adelantó, se usan las que quedaron guardadas.
  const saved = await read()
  if (!saved) throw new HttpError(500, 'No pude guardar las claves de los avisos.', 'vapid_write')
  return saved
}

interface Sub {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Message {
  title: string
  body: string
  url: string
  tag: string
}

async function deliver(admin: SupabaseClient, subs: Sub[], message: Message): Promise<{ sent: number; removed: number }> {
  const payload = JSON.stringify(message)
  let sent = 0
  let removed = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        TTL: 60 * 60 * 6,
        urgency: 'normal',
      })
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // El dispositivo ya no está suscrito: se limpia.
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
      } else {
        console.error('[send-reminders] push failed', status, String((e as { body?: unknown }).body ?? e))
      }
    }
  }
  return { sent, removed }
}

function safeTimeZone(tz: unknown): string {
  if (typeof tz !== 'string') return DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TZ
  }
}

async function runCron(admin: SupabaseClient) {
  const { data, error } = await admin.rpc('reminder_batch')
  if (error) throw new HttpError(500, 'No pude armar la lista de avisos.', 'batch')
  const now = new Date()
  let users = 0
  let sent = 0
  let removed = 0

  for (const row of (data ?? []) as { user_id: string; prefs: ReminderPrefs & { timezone?: string }; snapshot: UserSnapshot; subs: Sub[] }[]) {
    const tz = safeTimeZone(row.prefs.timezone)
    const reminders = decideReminders(now, tz, row.prefs, row.snapshot)
    if (reminders.length === 0 || !row.subs?.length) continue
    users++
    const today = localParts(now, tz).date
    const patch: Record<string, string> = {}
    for (const r of reminders) {
      const result = await deliver(admin, row.subs, r)
      sent += result.sent
      removed += result.removed
      // Se anota como enviado aunque un dispositivo falle, para no insistir toda la tarde.
      patch[r.kind === 'daily' ? 'last_daily_sent' : 'last_eve_sent'] = today
    }
    await admin.from('reminder_prefs').update(patch).eq('user_id', row.user_id)
  }
  console.log('[send-reminders] cron', { candidates: (data ?? []).length, users, sent, removed })
  return { candidates: (data ?? []).length, users, sent, removed }
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.', 'method')
    const admin = getAdmin()
    const body = await req.json().catch(() => ({}))

    // Modo cron: solo con el secreto guardado en Vault.
    const cronHeader = req.headers.get('x-cron-secret')
    if (cronHeader) {
      const { data: secret } = await admin.rpc('get_cron_secret')
      if (!secret || cronHeader !== secret) throw new HttpError(401, 'No autorizado.', 'cron_auth')
      const vapid = await ensureVapid(admin)
      webpush.setVapidDetails(APP_URL, vapid.public, vapid.private)
      return respond(await runCron(admin))
    }

    // Modo persona: exige sesión.
    const userId = await getUserId(admin, req)
    const vapid = await ensureVapid(admin)

    if (body.action === 'vapid_public') return respond({ publicKey: vapid.public })

    if (body.action === 'test') {
      webpush.setVapidDetails(APP_URL, vapid.public, vapid.private)
      const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
      if (!subs?.length) throw new HttpError(400, 'Todavía no hay ningún dispositivo con avisos activados.', 'no_subscription')
      const result = await deliver(admin, subs as Sub[], {
        title: '¡Funciona! 🎉',
        body: 'Así te van a llegar los recordatorios de IngApp.',
        url: '/',
        tag: 'test',
      })
      if (result.sent === 0) throw new HttpError(502, 'No pude entregar el aviso a tu dispositivo. Vuelve a activar los recordatorios.', 'push_failed')
      return respond(result)
    }

    throw new HttpError(400, 'Acción desconocida.', 'action')
  } catch (e) {
    if (e instanceof HttpError) {
      console.error('[send-reminders] failed', e.stage, e.status, e.message)
      return respond({ error: e.message, stage: e.stage }, e.status)
    }
    console.error('[send-reminders] unexpected', e)
    return respond({ error: 'Error inesperado en el servidor.', stage: 'unexpected' }, 500)
  }
})
