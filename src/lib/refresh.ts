import { useVocabStore } from '../store/useVocabStore'
import { invalidateAll } from './cache'
import { flushPracticeLog } from './storage'

export const REFRESH_EVENT = 'ingapp:refresh'

const STALE_AFTER_MS = 2 * 60 * 1000

// Una app instalada en el iPhone puede quedar abierta días. Al volver a ella después de un rato se
// descartan las lecturas guardadas y se avisa a las pantallas para que carguen datos frescos
// (por ejemplo, palabras agregadas desde otro dispositivo).
export function initRefreshOnFocus(): void {
  let hiddenAt: number | null = null
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      // Al salir de la app se manda lo que falte del registro de práctica.
      void flushPracticeLog()
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) {
      invalidateAll()
      useVocabStore.getState().load().catch(() => {})
      window.dispatchEvent(new Event(REFRESH_EVENT))
    }
    hiddenAt = null
  })
}
