export interface GrammarMatch {
  message: string
  shortMessage: string
  offset: number
  length: number
  suggestions: string[]
  /** Regla de LanguageTool (p. ej. UPPERCASE_SENTENCE_START) o una propia (ES_*). */
  ruleId: string
  categoryId: string
  /** Explicación ya escrita en español; las reglas propias la traen, las de LanguageTool se arman aparte. */
  friendly?: { title: string; text: string }
}

// Free public LanguageTool API — no API key required.
export async function checkGrammar(text: string): Promise<GrammarMatch[]> {
  if (!text.trim()) return []

  const response = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, language: 'en-US' }),
  })

  if (!response.ok) {
    throw new Error(`LanguageTool respondió ${response.status}`)
  }

  const data = await response.json()
  return (data.matches ?? []).map((m: any) => ({
    message: m.message,
    shortMessage: m.shortMessage || m.message,
    offset: m.offset,
    length: m.length,
    suggestions: (m.replacements ?? []).slice(0, 3).map((r: any) => r.value),
    ruleId: m.rule?.id ?? '',
    categoryId: m.rule?.category?.id ?? '',
  }))
}
