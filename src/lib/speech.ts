// Voz del navegador (Web Speech API): gratis, sin clave ni servidor.
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export const NORMAL_RATE = 0.95
export const SLOW_RATE = 0.6

export function speak(text: string, lang = 'en-US', rate = NORMAL_RATE): void {
  if (!canSpeak()) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

/** Lo mismo, pero despacito (para dictados y para entender cada palabra). */
export function speakSlow(text: string, lang = 'en-US'): void {
  speak(text, lang, SLOW_RATE)
}

// --- Reconocimiento de voz --------------------------------------------------
// Solo existe en algunos navegadores (Chrome, Safari en el navegador). En la app instalada del iPhone puede
// no funcionar: quien lo use debe tener una alternativa.

interface RecognitionResult {
  0: { transcript: string }
  length: number
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canRecognize(): boolean {
  return recognitionCtor() !== null
}

export interface ListenHandle {
  stop: () => void
}

/** Escucha una frase en inglés. Llama a `onDone` con lo que entendió, o con un error si no pudo. */
export function listenOnce(onDone: (result: { transcript?: string; error?: string }) => void): ListenHandle | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.maxAlternatives = 1
  let finished = false
  const finish = (result: { transcript?: string; error?: string }) => {
    if (finished) return
    finished = true
    onDone(result)
  }
  rec.onresult = (e) => {
    const first = e.results[0]
    finish({ transcript: first?.[0]?.transcript ?? '' })
  }
  rec.onerror = (e) => finish({ error: e.error })
  rec.onend = () => finish({ error: 'no-speech' })
  try {
    rec.start()
  } catch {
    finish({ error: 'start-failed' })
  }
  return { stop: () => rec.stop() }
}
