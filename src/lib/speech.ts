// Wraps the browser's built-in Web Speech API — free, no API key, no server.
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, lang = 'en-US'): void {
  if (!canSpeak()) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
