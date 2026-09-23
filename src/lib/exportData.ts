import * as storage from './storage'
import { localDateString } from './week'

export async function exportAllData(): Promise<void> {
  const [words, grammarTopics, notebookEntries, homeworkTasks, discoveryPicks, settings] = await Promise.all([
    storage.getWords(),
    storage.getGrammarTopics(),
    storage.getNotebookEntries(),
    storage.getHomeworkTasks(),
    storage.getDiscoveryPicks(),
    storage.getSettings(),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    words,
    grammarTopics,
    notebookEntries,
    homeworkTasks,
    discoveryPicks,
    settings,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ingapp-backup-${localDateString()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
