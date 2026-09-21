import { create } from 'zustand'
import type { Word } from '../lib/types'
import * as storage from '../lib/storage'
import { isDue, newWordSrsState, reviewWord as srsReview } from '../lib/srs'

interface VocabState {
  words: Word[]
  loaded: boolean
  load: () => Promise<void>
  addWord: (term: string, translation: string, example?: string) => Promise<void>
  addWords: (entries: { term: string; translation: string }[]) => Promise<void>
  removeWord: (id: string) => Promise<void>
  review: (id: string, quality: 1 | 3 | 5) => Promise<void>
  dueWords: () => Word[]
}

export const useVocabStore = create<VocabState>((set, get) => ({
  words: [],
  loaded: false,

  load: async () => {
    const words = await storage.getWords()
    set({ words, loaded: true })
  },

  addWord: async (term, translation, example) => {
    const word: Word = {
      id: crypto.randomUUID(),
      term,
      translation,
      example: example || undefined,
      createdAt: new Date().toISOString(),
      ...newWordSrsState(),
    }
    await storage.saveWord(word)
    set({ words: [...get().words, word] })
  },

  addWords: async (entries) => {
    const words: Word[] = entries.map((e) => ({
      id: crypto.randomUUID(),
      term: e.term,
      translation: e.translation,
      createdAt: new Date().toISOString(),
      ...newWordSrsState(),
    }))
    await storage.bulkAddWords(words)
    set({ words: [...get().words, ...words] })
  },

  removeWord: async (id) => {
    await storage.deleteWord(id)
    set({ words: get().words.filter((w) => w.id !== id) })
  },

  review: async (id, quality) => {
    const word = get().words.find((w) => w.id === id)
    if (!word) return
    const updated = srsReview(word, quality)
    await storage.saveWord(updated)
    set({ words: get().words.map((w) => (w.id === id ? updated : w)) })
  },

  dueWords: () => get().words.filter(isDue),
}))
