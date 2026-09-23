import { registerSW } from 'virtual:pwa-register'

export const UPDATE_AVAILABLE_EVENT = 'ingapp:update-available'

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

// Registra el service worker y avisa cuando hay una versión nueva esperando.
export function initServiceWorker(): void {
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT))
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        registration.update().catch(() => {})
      }
      // Una app instalada en el iPhone puede quedar abierta días: se busca una versión nueva
      // cada hora y cada vez que vuelves a ella.
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}

// Activa la versión nueva y recarga la página.
export function applyServiceWorkerUpdate(): Promise<void> | undefined {
  return applyUpdate?.(true)
}
