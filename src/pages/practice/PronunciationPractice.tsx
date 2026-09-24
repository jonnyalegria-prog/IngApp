import { useEffect, useRef, useState } from 'react'
import { useVocabStore } from '../../store/useVocabStore'
import { canRecognize, canSpeak, listenOnce, speak, speakSlow, type ListenHandle } from '../../lib/speech'
import { similarity } from '../../lib/dictation'
import { logPractice, markPracticed } from '../../lib/storage'
import LoadError from '../../components/LoadError'

type Verdict = { kind: 'good' | 'close' | 'again'; heard?: string } | { kind: 'error'; message: string }

const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'No tengo permiso para usar el micrófono. Revisa los permisos del navegador.',
  'service-not-allowed': 'Este navegador no deja usar el reconocimiento de voz. Puedes grabarte y comparar a oído.',
  'no-speech': 'No te escuché. Acércate un poco al micrófono e intenta de nuevo.',
  'audio-capture': 'No encontré un micrófono.',
  network: 'El reconocimiento de voz necesita internet.',
}

export default function PronunciationPractice() {
  const { words, loaded, error, load } = useVocabStore()
  const [index, setIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  // Si el reconocimiento falla (p. ej. en la app instalada del iPhone) se pasa a "grabarme y comparar".
  const [recognitionBroken, setRecognitionBroken] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const listenRef = useRef<ListenHandle | null>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      listenRef.current?.stop()
    }
  }, [])

  if (error && !loaded) return <LoadError message={error} onRetry={() => void load()} />
  if (!loaded) return <p className="text-slate-400">Cargando...</p>

  if (words.length === 0) {
    return <p className="text-slate-400">Agrega vocabulario primero para poder practicar pronunciación.</p>
  }

  const current = words[index % words.length]
  const target = current.term.replace(/^to\s+/i, '')
  const useRecognition = canRecognize() && !recognitionBroken

  function record(correct: boolean) {
    markPracticed()
    logPractice({ kind: 'pronunciation', topic: 'pronunciación', item: current.term, correct })
  }

  function startListening() {
    setVerdict(null)
    setListening(true)
    listenRef.current = listenOnce((result) => {
      setListening(false)
      if (result.error) {
        if (result.error === 'service-not-allowed' || result.error === 'start-failed') setRecognitionBroken(true)
        setVerdict({ kind: 'error', message: RECOGNITION_ERRORS[result.error] ?? 'No pude escucharte. Intenta de nuevo.' })
        return
      }
      const heard = result.transcript ?? ''
      const score = similarity(target, heard)
      const kind = score >= 0.99 ? 'good' : score >= 0.5 ? 'close' : 'again'
      setVerdict({ kind, heard })
      record(kind === 'good')
    })
  }

  async function startRecording() {
    setMicError(null)
    setAudioUrl(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        // Safari graba mp4/aac y Chrome webm: se usa el tipo que realmente produjo el grabador,
        // porque un tipo equivocado impide reproducir el audio en el iPhone.
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || 'audio/mp4' })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setMicError('No pude acceder al micrófono. Revisa los permisos del navegador.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    markPracticed()
  }

  function next() {
    setIndex((i) => i + 1)
    setAudioUrl(null)
    setVerdict(null)
    setMicError(null)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        {useRecognition ? 'Escucha la referencia y dila tú: te digo si te entendí.' : 'Escucha la referencia, grábate diciéndola y compara.'}
      </p>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="text-2xl font-semibold text-white" lang="en" translate="no">
          {current.term}
        </div>
        {current.example && (
          <div className="mt-2 text-sm italic text-slate-400" lang="en" translate="no">
            "{current.example}"
          </div>
        )}
        {canSpeak() && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => speak(current.example || current.term)}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm text-violet-300 hover:bg-slate-700"
            >
              🔊 Escuchar
            </button>
            <button
              onClick={() => speakSlow(current.example || current.term)}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm text-violet-300 hover:bg-slate-700"
            >
              🐢 Más lento
            </button>
          </div>
        )}
      </div>

      {useRecognition ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={startListening}
            disabled={listening}
            className={`rounded-full px-6 py-4 text-2xl text-white ${listening ? 'animate-pulse bg-red-700' : 'bg-red-600 hover:bg-red-500'}`}
            aria-label="Decir la palabra"
          >
            🎤
          </button>
          <span className="text-xs text-slate-400">{listening ? 'Te escucho...' : `Toca y di «${target}»`}</span>
          {verdict && <VerdictBox verdict={verdict} target={target} />}
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            {!recording ? (
              <button onClick={() => void startRecording()} className="rounded-full bg-red-600 px-6 py-4 text-2xl text-white hover:bg-red-500" aria-label="Grabarme">
                🎤
              </button>
            ) : (
              <button onClick={stopRecording} className="animate-pulse rounded-full bg-red-700 px-6 py-4 text-2xl text-white" aria-label="Parar la grabación">
                ⏹️
              </button>
            )}
            <span className="text-xs text-slate-400">{recording ? 'Grabando... toca para parar' : 'Toca para grabarte'}</span>
          </div>
          {micError && <p className="text-sm text-red-400">{micError}</p>}
          {verdict?.kind === 'error' && <p className="text-sm text-amber-300">{verdict.message}</p>}
          {audioUrl && (
            <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-300">Tu grabación. ¿Cómo sonó comparada con la referencia?</p>
              <audio controls src={audioUrl} className="w-full" />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    record(true)
                    next()
                  }}
                  className="rounded-md bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  Me sonó bien
                </button>
                <button
                  onClick={() => {
                    record(false)
                    setAudioUrl(null)
                  }}
                  className="rounded-md bg-amber-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Otra vez
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <button onClick={next} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
        Siguiente palabra
      </button>
    </div>
  )
}

function VerdictBox({ verdict, target }: { verdict: Verdict; target: string }) {
  if (verdict.kind === 'error') return <p className="max-w-md text-center text-sm text-amber-300">{verdict.message}</p>
  const styles = {
    good: 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300',
    close: 'border-amber-700/50 bg-amber-950/30 text-amber-200',
    again: 'border-red-700/50 bg-red-950/30 text-red-300',
  }[verdict.kind]
  const title = { good: '¡Bacán, se entendió perfecto! 🎉', close: 'Casi. Se entendió una parte.', again: 'Pucha, no te entendí bien. Prueba de nuevo.' }[verdict.kind]
  return (
    <div className={`w-full max-w-md rounded-2xl border p-3 text-center text-sm ${styles}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-slate-300">
        Escuché: “<span lang="en">{verdict.heard || '...'}</span>” · Objetivo: “<span lang="en">{target}</span>”
      </p>
    </div>
  )
}
