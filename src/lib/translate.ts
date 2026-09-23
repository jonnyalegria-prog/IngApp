import { supabase } from './supabase'
import type { EnglishLevel } from './types'

// Cliente de la Edge Function `deepl`. La clave de DeepL nunca llega al navegador:
// la función la lee de Supabase Vault y exige sesión iniciada.

export type Lang = 'en' | 'es'

export interface TranslateItem {
  text: string
  /** Oración donde aparece el texto; desambigua palabras como "light" o "bank" (DeepL no la cobra). */
  context?: string
}

export interface VocabSuggestion {
  term: string
  level: EnglishLevel
  theme: string
  example: string
  note: string | null
  translation: string
}

export class TranslateError extends Error {
  stage?: string
  constructor(message: string, stage?: string) {
    super(message)
    this.stage = stage
  }
}

const memo = new Map<string, string>()

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('deepl', { body })
  if (error) {
    let message = 'No se pudo traducir ahora. Probá de nuevo en un rato.'
    let stage: string | undefined
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      if (res.status === 401) message = 'Tu sesión venció. Volvé a iniciar sesión.'
      try {
        const payload = await res.json()
        if (payload?.error) {
          message = payload.error
          stage = payload.stage
        }
      } catch {
        // cuerpo no JSON: se deja el mensaje genérico
      }
    }
    throw new TranslateError(message, stage)
  }
  return data as T
}

/**
 * Traduce hasta 20 textos. `cache: true` guarda el resultado en el caché compartido:
 * usarlo solo para contenido del banco o palabras sueltas, nunca para escritura personal.
 */
export async function translate(
  items: TranslateItem[],
  opts: { from: Lang; to: Lang; cache?: boolean },
): Promise<string[]> {
  const keyOf = (i: TranslateItem) => JSON.stringify([opts.from, opts.to, i.context ?? '', i.text])
  const out: (string | undefined)[] = items.map((i) => memo.get(keyOf(i)))
  const missing = out.flatMap((v, i) => (v === undefined ? [i] : []))

  if (missing.length > 0) {
    const { translations } = await invoke<{ translations: string[] }>({
      action: 'translate',
      from: opts.from,
      to: opts.to,
      cache: opts.cache ?? false,
      items: missing.map((i) => items[i]),
    })
    missing.forEach((i, n) => {
      out[i] = translations[n]
      memo.set(keyOf(items[i]), translations[n])
    })
  }
  return out as string[]
}

export async function translateOne(
  text: string,
  opts: { from: Lang; to: Lang; cache?: boolean; context?: string },
): Promise<string> {
  const [result] = await translate([{ text, context: opts.context }], opts)
  return result
}

export async function fetchVocabSuggestions(
  level: EnglishLevel,
  count: number,
  exclude: string[],
): Promise<{ suggestions: VocabSuggestion[]; exhausted: boolean }> {
  return invoke({ action: 'suggest', level, count, exclude })
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'No se pudo traducir ahora. Probá de nuevo en un rato.'
}
