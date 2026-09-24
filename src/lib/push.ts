import { supabase } from './supabase'
import { currentUserId } from './storage'

// Recordatorios push. Funcionan en Chrome/Android y en el iPhone (iOS 16.4 o más) solo con la app instalada en la
// pantalla de inicio. El permiso hay que pedirlo desde un toque del usuario.

export class PushError extends Error {
  code: 'unsupported' | 'denied' | 'server'
  constructor(code: 'unsupported' | 'denied' | 'server', message: string) {
    super(message)
    this.code = code
  }
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Si la app está abierta desde el ícono de la pantalla de inicio (no desde el navegador). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64Url.length % 4)) % 4)
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function fetchVapidKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { action: 'vapid_public' } })
  if (error || !data?.publicKey) throw new PushError('server', 'No pude preparar los avisos. Intenta de nuevo en un ratito.')
  return data.publicKey as string
}

// Si el service worker no llegó a registrarse, `ready` no responde nunca: se espera un rato y se avisa.
async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new PushError('unsupported', 'La app todavía no está lista para los avisos. Recarga la página e intenta de nuevo.')), 4000)
  })
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

/** ¿Este dispositivo ya está suscrito? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false
  const sub = await (await registration()).pushManager.getSubscription()
  return sub !== null && Notification.permission === 'granted'
}

/** Pide permiso, suscribe este dispositivo y lo guarda para que el servidor pueda avisarle. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new PushError('unsupported', 'Este navegador no permite avisos.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError('denied', 'No diste permiso para los avisos.')

  const key = await fetchVapidKey()
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new PushError('server', 'No pude activar los avisos en este dispositivo.')

  const userId = await currentUserId()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) throw error
}

/** Saca este dispositivo de la lista de avisos. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Manda un aviso de prueba a tus dispositivos. */
export async function sendTestPush(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { action: 'test' } })
  if (error) {
    let message = 'No pude mandar el aviso de prueba.'
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      try {
        const payload = await res.json()
        if (payload?.error) message = payload.error
      } catch {
        // cuerpo que no es JSON
      }
    }
    throw new PushError('server', message)
  }
  if (!data || data.sent < 1) throw new PushError('server', 'No pude entregar el aviso a tu dispositivo.')
}

// --- Preferencias -----------------------------------------------------------

export interface ReminderSettings {
  enabled: boolean
  hour: number
  classEve: boolean
  /** 0 = domingo ... 6 = sábado */
  classWeekday: number
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 19, classEve: true, classWeekday: 0 }

export async function getReminderSettings(): Promise<ReminderSettings> {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('reminder_prefs').select('enabled, hour, class_eve, class_weekday').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return DEFAULT_REMINDERS
  return { enabled: data.enabled, hour: data.hour, classEve: data.class_eve, classWeekday: data.class_weekday }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('reminder_prefs').upsert({
    user_id: userId,
    enabled: settings.enabled,
    hour: settings.hour,
    class_eve: settings.classEve,
    class_weekday: settings.classWeekday,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
