import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Copy, Share2, Users } from 'lucide-react'
import {
  disablePush,
  enablePush,
  getReminderSettings,
  isIos,
  isStandalone,
  isSubscribed,
  PushError,
  pushSupported,
  saveReminderSettings,
  sendTestPush,
  type ReminderSettings,
} from '../lib/push'
import {
  acceptInvite,
  createInvite,
  createShareLink,
  getDisplayName,
  getPartnerOverview,
  inviteErrorMessage,
  leavePartnership,
  listShareLinks,
  revokeShareLink,
  saveDisplayName,
  shareUrl,
  WEEKLY_GOAL,
  type PartnerOverview,
  type ShareLink,
} from '../lib/social'
import { friendlyError } from '../lib/errors'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../lib/toast'
import LoadError from '../components/LoadError'
import PartnerCard from '../components/PartnerCard'

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const HOURS = Array.from({ length: 24 }, (_, h) => h)

const card = 'rounded-2xl border border-slate-800 bg-slate-900 p-4'
const inputClass = 'rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500'
const primaryButton = 'rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40'
const secondaryButton = 'rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40'

export default function Settings() {
  const load = useLoad(async () => {
    const [name, reminders, links, partner] = await Promise.all([getDisplayName(), getReminderSettings(), listShareLinks(), getPartnerOverview()])
    return { name, reminders, links, partner }
  })
  // Si este dispositivo está suscrito se consulta aparte: puede tardar un poco y no debe frenar el resto de la pantalla.
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    isSubscribed()
      .catch(() => false)
      .then((value) => {
        if (!cancelled) setSubscribed(value)
      })
    return () => {
      cancelled = true
    }
  }, [tick])
  const refresh = () => {
    load.reload()
    setTick((n) => n + 1)
  }

  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (!load.data) return <p className="text-slate-400">Cargando...</p>
  const { name, reminders, links, partner } = load.data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Ajustes</h1>
        <p className="text-slate-400">Recordatorios, compartir tu avance y el reto en pareja.</p>
      </div>

      <NameSection initial={name} />
      <RemindersSection settings={reminders} subscribed={subscribed} onChange={refresh} />
      <ShareSection links={links} onChange={() => load.reload()} />
      <PartnerSection partner={partner} onChange={() => load.reload()} />

      <Link to="/" className="self-start text-sm text-violet-400 hover:underline">
        ← Volver al inicio
      </Link>
    </div>
  )
}

// --- Nombre -----------------------------------------------------------------

function NameSection({ initial }: { initial: string }) {
  const toast = useToast()
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const result = await toast.run(() => saveDisplayName(name), 'No pude guardar tu nombre.')
    setSaving(false)
    if (result.ok) toast.show('Guardé tu nombre.', { kind: 'success' })
  }

  return (
    <section className={card}>
      <h2 className="font-medium text-white">Tu nombre</h2>
      <p className="mb-3 text-sm text-slate-400">Lo ven tu pareja de reto y tu profe cuando les compartes tu avance. Es opcional.</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Ej: Jonny"
          aria-label="Tu nombre"
          className={`min-w-0 flex-1 ${inputClass}`}
        />
        <button onClick={() => void save()} disabled={saving || name.trim() === initial.trim()} className={primaryButton}>
          Guardar
        </button>
      </div>
    </section>
  )
}

// --- Recordatorios ----------------------------------------------------------

function RemindersSection({ settings, subscribed, onChange }: { settings: ReminderSettings; subscribed: boolean | null; onChange: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState(settings)
  const active = local.enabled && subscribed === true

  const supported = pushSupported()
  const needsInstall = isIos() && !isStandalone()

  async function turnOn() {
    setBusy(true)
    try {
      await enablePush()
      const next = { ...local, enabled: true }
      await saveReminderSettings(next)
      setLocal(next)
      toast.show('¡Listo! Te voy a avisar a la hora que elegiste.', { kind: 'success' })
      onChange()
    } catch (err) {
      toast.error(err instanceof PushError ? err.message : friendlyError(err, 'No pude activar los recordatorios.'))
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      await disablePush()
      const next = { ...local, enabled: false }
      await saveReminderSettings(next)
      setLocal(next)
      onChange()
    } catch (err) {
      toast.error(friendlyError(err, 'No pude desactivar los recordatorios.'))
    } finally {
      setBusy(false)
    }
  }

  async function update(patch: Partial<ReminderSettings>) {
    const next = { ...local, ...patch }
    setLocal(next)
    const result = await toast.run(() => saveReminderSettings(next), 'No pude guardar el cambio.')
    if (!result.ok) setLocal(local)
  }

  async function test() {
    setBusy(true)
    try {
      await sendTestPush()
      toast.show('Te mandé un aviso de prueba. Debería llegar en unos segundos.', { kind: 'success' })
    } catch (err) {
      toast.error(err instanceof PushError ? err.message : friendlyError(err, 'No pude mandar el aviso de prueba.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card}>
      <div className="mb-1 flex items-center gap-2">
        <Bell size={18} className="text-violet-400" />
        <h2 className="font-medium text-white">Recordatorios</h2>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Te aviso cuando te esperan palabras por repasar, para que no pierdas tu racha, y la víspera de tu clase si te quedan tareas.
      </p>

      {needsInstall && (
        <p className="mb-3 rounded-md border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          En el iPhone los avisos solo funcionan con la app instalada: en Safari toca <strong>Compartir</strong> →{' '}
          <strong>Agregar a inicio</strong>, y después abre IngApp desde el ícono nuevo.
        </p>
      )}
      {!supported && !needsInstall && (
        <p className="mb-3 rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
          Este navegador no permite avisos. Prueba con Chrome o con la app instalada en tu teléfono.
        </p>
      )}

      {supported && !needsInstall && subscribed === null && <p className="text-sm text-slate-400">Comprobando este dispositivo...</p>}

      {supported && !needsInstall && subscribed !== null && !active && (
        <button onClick={() => void turnOn()} disabled={busy} className={primaryButton}>
          {busy ? 'Activando...' : 'Activar recordatorios en este dispositivo'}
        </button>
      )}

      {active && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">✓ Activados en este dispositivo</p>
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
            Avísame a las
            <select
              value={local.hour}
              onChange={(e) => void update({ hour: Number(e.target.value) })}
              className={`${inputClass} py-1`}
              aria-label="Hora del aviso"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            (hora de Chile)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={local.classEve} onChange={(e) => void update({ classEve: e.target.checked })} className="h-4 w-4 accent-violet-600" />
            Avisarme la víspera de mi clase si me quedan tareas
          </label>
          {local.classEve && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
              Mi clase es el
              <select
                value={local.classWeekday}
                onChange={(e) => void update({ classWeekday: Number(e.target.value) })}
                className={`${inputClass} py-1`}
                aria-label="Día de la clase"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void test()} disabled={busy} className={secondaryButton}>
              Mandarme un aviso de prueba
            </button>
            <button onClick={() => void turnOff()} disabled={busy} className={secondaryButton}>
              Desactivar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// --- Compartir con la profe -------------------------------------------------

function ShareSection({ links, onChange }: { links: ShareLink[]; onChange: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    const result = await toast.run(() => createShareLink('Mi profe'), 'No pude crear el enlace.')
    setBusy(false)
    if (result.ok) onChange()
  }

  async function copy(link: ShareLink) {
    const url = shareUrl(link.token)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi avance en IngApp', url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.show('Copié el enlace.', { kind: 'success' })
    } catch {
      // si cancelas el menú de compartir no pasa nada; si falla copiar, se muestra el enlace para copiarlo a mano
      toast.show(url, { durationMs: 15000 })
    }
  }

  async function revoke(link: ShareLink) {
    const result = await toast.run(() => revokeShareLink(link.id), 'No pude desactivar el enlace.')
    if (result.ok) {
      toast.show('Desactivé el enlace: ya nadie puede verlo.')
      onChange()
    }
  }

  return (
    <section className={card}>
      <div className="mb-1 flex items-center gap-2">
        <Share2 size={18} className="text-violet-400" />
        <h2 className="font-medium text-white">Compartir con mi profe</h2>
      </div>
      <p className="mb-3 text-sm text-slate-400">
        Crea un enlace de solo lectura para que tu profe vea tu avance sin iniciar sesión: tu racha, cuántas palabras llevas y las últimas,
        cuánto practicas, en qué temas te cuesta más y cómo van tus tareas. <strong className="text-slate-300">No ve tu Diario ni tus apuntes.</strong>{' '}
        Puedes desactivarlo cuando quieras.
      </p>
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <span className="text-slate-300">
              {link.label ?? 'Enlace'} · creado el {new Date(link.createdAt).toLocaleDateString('es-CL')}
            </span>
            <span className="flex gap-2">
              <button onClick={() => void copy(link)} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
                <Copy size={13} /> Compartir
              </button>
              <button onClick={() => void revoke(link)} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-red-300 hover:bg-slate-700">
                Desactivar
              </button>
            </span>
          </div>
        ))}
        {links.length === 0 && (
          <button onClick={() => void create()} disabled={busy} className={`self-start ${primaryButton}`}>
            Crear enlace para mi profe
          </button>
        )}
      </div>
    </section>
  )
}

// --- Reto en pareja ---------------------------------------------------------

function PartnerSection({ partner, onChange }: { partner: PartnerOverview | null; onChange: () => void }) {
  const toast = useToast()
  const [code, setCode] = useState<string | null>(null)
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)

  async function makeCode() {
    setBusy(true)
    const result = await toast.run(() => createInvite(), 'No pude crear el código.')
    setBusy(false)
    if (result.ok) setCode(result.value)
  }

  async function join() {
    setBusy(true)
    try {
      await acceptInvite(entered)
      toast.show('¡Listo! Ya son pareja de reto. 💪', { kind: 'success' })
      setEntered('')
      onChange()
    } catch (err) {
      toast.error(inviteErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    const result = await toast.run(() => leavePartnership(), 'No pude salir del reto.')
    if (result.ok) {
      toast.show('Saliste del reto en pareja.')
      onChange()
    }
  }

  return (
    <section className={card}>
      <div className="mb-1 flex items-center gap-2">
        <Users size={18} className="text-violet-400" />
        <h2 className="font-medium text-white">Reto en pareja</h2>
      </div>

      {partner ? (
        <PartnerCard partner={partner} onLeave={() => void leave()} />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">
            Practica junto a otra persona: cada semana, los dos tienen que sumar {WEEKLY_GOAL} respuestas. Se ven la racha y el avance del otro
            (solo cifras, nada de lo que escribes).
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <button onClick={() => void makeCode()} disabled={busy} className={secondaryButton}>
                Crear mi código
              </button>
              {code && (
                <p className="mt-2 text-sm text-slate-300">
                  Tu código es <span className="rounded bg-slate-950 px-2 py-1 font-mono text-lg tracking-widest text-violet-300">{code}</span>. Pásaselo
                  a tu pareja: le sirve por 2 días.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={entered}
                onChange={(e) => setEntered(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="Código de mi pareja"
                aria-label="Código de mi pareja"
                autoCapitalize="characters"
                className={`min-w-0 flex-1 font-mono tracking-widest ${inputClass}`}
              />
              <button onClick={() => void join()} disabled={busy || entered.trim().length !== 6} className={primaryButton}>
                Unirme
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
