import { create } from 'zustand'
import type { Word } from '../lib/types'
import * as storage from '../lib/storage'
import { LOAD_ERROR } from '../lib/errors'
import { termKey } from '../lib/classSave'
import { isDue, newWordSrsState, reviewWord as srsReview, type ReviewQuality } from '../lib/srs'

export type AddResult = 'added' | 'duplicate'

export { termKey }

interface VocabState {
  words: Word[]
  loaded: boolean
  /** Mensaje amable si no se pudo cargar el vocabulario. */
  error: string | null
  load: () => Promise<void>
  hasTerm: (term: string) => boolean
  addWord: (term: string, translation: string, example?: string) => Promise<AddResult>
  addWords: (entries: { term: string; translation: string; example?: string }[]) => Promise<{ added: number; skipped: number }>
  updateWord: (id: string, patch: { term: string; translation: string; example?: string }) => Promise<AddResult | 'updated'>
  removeWord: (id: string) => Promise<Word | undefined>
  /** Vuelve a poner una palabra borrada (para "Deshacer"). */
  restoreWord: (word: Word) => Promise<void>
  review: (id: string, quality: ReviewQuality) => Promise<Word | undefined>
  dueWords: () => Word[]
}

export const useVocabStore = create<VocabState>((set, get) => ({
  words: [],
  loaded: false,
  error: null,

  load: async () => {
    try {
      const words = await storage.getWords()
      set({ words, loaded: true, error: null })
    } catch {
      set({ error: LOAD_ERROR })
    }
  },

  hasTerm: (term) => {
    const key = termKey(term)
    return get().words.some((w) => termKey(w.term) === key)
  },

  addWord: async (term, translation, example) => {
    if (get().hasTerm(term)) return 'duplicate'
    const word: Word = {
      id: crypto.randomUUID(),
      term: term.trim(),
      translation: translation.trim(),
      example: example?.trim() || undefined,
      createdAt: new Date().toISOString(),
      ...newWordSrsState(),
    }
    try {
      await storage.saveWord(word)
    } catch (err) {
      if (storage.isDuplicateError(err)) return 'duplicate'
      throw err
    }
    set({ words: [...get().words, word] })
    return 'added'
  },

  addWords: async (entries) => {
    const seen = new Set(get().words.map((w) => termKey(w.term)))
    const fresh: Word[] = []
    for (const e of entries) {
      const key = termKey(e.term)
      if (!key || seen.has(key)) continue
      seen.add(key)
      fresh.push({
        id: crypto.randomUUID(),
        term: e.term.trim(),
        translation: e.translation.trim(),
        example: e.example?.trim() || undefined,
        createdAt: new Date().toISOString(),
        ...newWordSrsState(),
      })
    }
    await storage.bulkAddWords(fresh)
    set({ words: [...get().words, ...fresh] })
    return { added: fresh.length, skipped: entries.length - fresh.length }
  },

  updateWord: async (id, patch) => {
    const word = get().words.find((w) => w.id === id)
    if (!word) return 'updated'
    const key = termKey(patch.term)
    if (get().words.some((w) => w.id !== id && termKey(w.term) === key)) return 'duplicate'
    const updated: Word = {
      ...word,
      term: patch.term.trim(),
      translation: patch.translation.trim(),
      example: patch.example?.trim() || undefined,
    }
    try {
      await storage.saveWord(updated)
    } catch (err) {
      if (storage.isDuplicateError(err)) return 'duplicate'
      throw err
    }
    set({ words: get().words.map((w) => (w.id === id ? updated : w)) })
    return 'updated'
  },

  removeWord: async (id) => {
    const word = get().words.find((w) => w.id === id)
    await storage.deleteWord(id)
    set({ words: get().words.filter((w) => w.id !== id) })
    return word
  },

  restoreWord: async (word) => {
    if (get().words.some((w) => w.id === word.id)) return
    await storage.saveWord(word)
    set({ words: [...get().words, word].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })
  },

  review: async (id, quality) => {
    const word = get().words.find((w) => w.id === id)
    if (!word) return undefined
    const updated = srsReview(word, quality)
    await storage.saveWord(updated)
    set({ words: get().words.map((w) => (w.id === id ? updated : w)) })
    return updated
  },

  dueWords: () => get().words.filter(isDue),
}))
