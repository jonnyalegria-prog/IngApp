import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { invalidateAll } from './cache'
import { clearNewToday } from './session'
import { resetPracticeMemo } from './storage'
import { useVocabStore } from '../store/useVocabStore'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// Al entrar o salir de una cuenta se descarta todo lo que quedó en memoria de la anterior.
function forgetUserData() {
  invalidateAll()
  resetPracticeMemo()
  clearNewToday()
  useVocabStore.setState({ words: [], loaded: false, error: null })
}

export function onAuthChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') forgetUserData()
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
  forgetUserData()
}
