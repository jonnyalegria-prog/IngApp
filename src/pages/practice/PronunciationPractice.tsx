import { useEffect, useRef, useState } from 'react'
import { useVocabStore } from '../../store/useVocabStore'
import { canSpeak, speak } from '../../lib/speech'

export default function PronunciationPractice() {
  const { words, loaded, load } = useVocabStore()
  const [index, setIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (!loaded) return <p className="text-slate-400">Cargando...</p>

  if (words.length === 0) {
    return <p className="text-slate-400">Agregá vocabulario primero para poder practicar pronunciación.</p>
  }

  const current = words[index % words.length]

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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setMicError('No pudimos acceder al micrófono. Revisá los permisos del navegador.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function next() {
    setIndex((i) => i + 1)
    setAudioUrl(null)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">Escuchá la referencia, grabate diciéndola, y compará.</p>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="text-2xl font-semibold text-white">{current.term}</div>
        {current.example && <div className="mt-2 text-sm italic text-slate-400">"{current.example}"</div>}
        {canSpeak() && (
          <button
            onClick={() => speak(current.example || current.term)}
            className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm text-violet-300 hover:bg-slate-700"
          >
            🔊 Escuchar referencia
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {!recording ? (
          <button onClick={startRecording} className="rounded-full bg-red-600 px-6 py-4 text-2xl text-white hover:bg-red-500">
            🎤
          </button>
        ) : (
          <button onClick={stopRecording} className="animate-pulse rounded-full bg-red-700 px-6 py-4 text-2xl text-white">
            ⏹️
          </button>
        )}
        <span className="text-xs text-slate-500">{recording ? 'Grabando... tocá para parar' : 'Tocá para grabarte'}</span>
      </div>

      {micError && <p className="text-sm text-red-400">{micError}</p>}

      {audioUrl && (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-300">Tu grabación:</p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      <button onClick={next} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
        Siguiente palabra
      </button>
    </div>
  )
}
