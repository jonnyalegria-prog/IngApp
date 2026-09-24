import { supabase } from './supabase'
import { currentUserId } from './storage'

// Compartir con tu profe (enlace de solo lectura) y reto en pareja.

// --- Enlace para la profe ---------------------------------------------------

export interface ShareLink {
  id: string
  token: string
  label?: string
  createdAt: string
  revokedAt?: string
}

/** 32 caracteres al azar (192 bits): imposible de adivinar. */
export function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('id, token, label, created_at, revoked_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    token: r.token,
    label: r.label ?? undefined,
    createdAt: r.created_at,
    revokedAt: r.revoked_at ?? undefined,
  }))
}

export async function createShareLink(label?: string): Promise<ShareLink> {
  const link = { id: crypto.randomUUID(), token: newToken(), label: label?.trim() || undefined, createdAt: new Date().toISOString() }
  const { error } = await supabase.from('share_links').insert({
    id: link.id,
    user_id: await currentUserId(),
    token: link.token,
    label: link.label ?? null,
    created_at: link.createdAt,
  })
  if (error) throw error
  return link
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Dirección completa para pasarle a la profe (funciona con HashRouter, sin iniciar sesión). */
export function shareUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/resumen/${token}`
}

export interface SharedSummary {
  name: string | null
  streak: number
  lastPractice: string | null
  wordsTotal: number
  wordsMastered: number
  recentWords: { term: string; translation: string }[]
  daysPracticed30: number
  answers30: number
  byKind: { kind: string; total: number; correct: number }[]
  weakTopics: { topic: string; total: number; pct: number }[]
  lastClass: { date: string; vocab: number; tasks: number } | null
  tasksLastClass: { done: number; total: number }
  generatedAt: string
}

/** Lo que ve tu profe con el enlace. Devuelve null si el enlace no existe o se desactivó. */
export async function fetchSharedSummary(token: string): Promise<SharedSummary | null> {
  const { data, error } = await supabase.rpc('shared_summary', { p_token: token })
  if (error) throw error
  return (data as SharedSummary | null) ?? null
}

// --- Nombre (lo ven tu pareja y tu profe) -----------------------------------

export async function getDisplayName(): Promise<string> {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('user_settings').select('display_name').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.display_name ?? ''
}

export async function saveDisplayName(name: string): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, display_name: name.trim().slice(0, 30) || null })
  if (error) throw error
}

// --- Reto en pareja ---------------------------------------------------------

/** Respuestas que cada uno tiene que sumar en la semana (de lunes a domingo) para cumplir el reto. */
export const WEEKLY_GOAL = 50

export interface PartnerStats {
  streak: number
  practicedToday: boolean
  answersWeek: number
  wordsTotal: number
}

export interface PartnerOverview {
  partnerName: string | null
  me: PartnerStats
  partner: PartnerStats
}

export async function getPartnerOverview(): Promise<PartnerOverview | null> {
  const { data, error } = await supabase.rpc('partner_overview')
  if (error) throw error
  return (data as PartnerOverview | null) ?? null
}

export interface ChallengeState {
  meFraction: number
  partnerFraction: number
  meDone: boolean
  partnerDone: boolean
  /** Los dos cumplieron la meta de la semana. */
  bothDone: boolean
}

export function challengeState(overview: PartnerOverview, goal = WEEKLY_GOAL): ChallengeState {
  const fraction = (n: number) => Math.max(0, Math.min(1, n / goal))
  const meDone = overview.me.answersWeek >= goal
  const partnerDone = overview.partner.answersWeek >= goal
  return {
    meFraction: fraction(overview.me.answersWeek),
    partnerFraction: fraction(overview.partner.answersWeek),
    meDone,
    partnerDone,
    bothDone: meDone && partnerDone,
  }
}

const INVITE_ERRORS: Record<string, string> = {
  invalid_code: 'Ese código no existe o ya venció. Pídele uno nuevo a tu pareja.',
  own_code: 'Ese es tu propio código: tienes que ingresar el de tu pareja.',
  already_partnered: 'Tú o esa persona ya tienen una pareja de reto. Primero hay que salirse de la anterior.',
}

export function inviteErrorMessage(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? ''
  return INVITE_ERRORS[message] ?? 'No pude hacerlo. Intenta de nuevo en un ratito.'
}

export async function createInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_partner_invite')
  if (error) throw error
  return data as string
}

export async function acceptInvite(code: string): Promise<void> {
  const { error } = await supabase.rpc('accept_partner_invite', { p_code: code })
  if (error) throw error
}

export async function leavePartnership(): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('partnerships').delete().or(`user_a.eq.${userId},user_b.eq.${userId}`)
  if (error) throw error
}
