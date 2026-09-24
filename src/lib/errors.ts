// Convierte cualquier error (red, sesión, permisos, base de datos) en un mensaje amable.
export function friendlyError(err: unknown, fallback = 'Pucha, algo salió mal. Intenta de nuevo en un ratito.'): string {
  const e = err as { message?: string; code?: string; status?: number } | null
  const message = (e?.message ?? '').toLowerCase()

  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed') || message.includes('network request failed')) {
    return 'No hay conexión. Revisa tu internet e intenta de nuevo.'
  }
  if (message.includes('jwt expired') || message.includes('no hay sesión') || e?.status === 401) {
    return 'Tu sesión venció. Vuelve a iniciar sesión.'
  }
  if (e?.code === '23505') return 'Eso ya existe.'
  if (e?.code === '42501' || message.includes('row-level security')) return 'No tienes permiso para hacer eso.'
  return fallback
}

export const LOAD_ERROR = 'No pude cargar tus datos. Revisa tu conexión e inténtalo de nuevo.'
