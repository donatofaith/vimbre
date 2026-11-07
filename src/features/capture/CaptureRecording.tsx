import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

const recordingSeconds = 30 * 60
const recordingBytes = 16 * 1024 * 1024
const recordingTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']

type Phase = 'ready' | 'permission' | 'recording' | 'stopping' | 'review' | 'transcribing'
type Status = { available?: boolean; code?: string }
const messages: Record<string, string> = {
  recording_limit: 'You’ve used your three transcriptions today. The limit resets at midnight UTC.',
  no_speech: 'No speech was detected. Play the recording to check what the microphone picked up.',
  sign_in_required: 'Your session expired. Download the recording before signing in again.',
  access_denied: 'Transcription is no longer available for your account. Download the recording to keep it.',
  audio_too_large: 'This recording exceeds 16 MB. Record a shorter section.',
  unsupported_audio: 'This browser’s recording format could not be read. Try another browser.',
}
const duration = (seconds: number) => [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':')

export function CaptureRecording({ disabled, onTranscript }: { disabled: boolean; onTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (import.meta.env.VITE_CAPTURE_RECORDING_ENABLED !== 'true') return
    const controller = new AbortController()
    void supabase.functions.invoke<Status>('capture-transcribe', {
      method: 'GET', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    }).then(({ data, error }) => {
      if (!controller.signal.aborted) setStatus(error || !data ? { code: 'status_unavailable' } : data)
    })
    return () => controller.abort()
  }, [statusAttempt])
  if (import.meta.env.VITE_CAPTURE_RECORDING_ENABLED !== 'true') return null
  return <>
    <button ref={trigger} type="button" disabled={disabled} onClick={() => setOpen(true)}>
      <svg className="vc-source-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-3 0h6"/></svg>
      Record meeting
    </button>
    {open && <Recorder status={status} retryStatus={() => {
      setStatus(null)
      setStatusAttempt(attempt => attempt + 1)
    }} close={() => {
      setOpen(false)
      trigger.current?.focus()
    }} onLimit={() => setStatus({ code: 'recording_limit' })} onTranscript={onTranscript} />}
  </>
}

function Recorder({ status, retryStatus, close, onLimit, onTranscript }: { status: Status | null; retryStatus: () => void; close: () => void; onLimit: () => void; onTranscript: (text: string) => void }) {
  const limited = status?.code === 'recording_limit'
  const dialog = useRef<HTMLDialogElement>(null)
  const media = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const request = useRef<AbortController | null>(null)
  const active = useRef(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [agreed, setAgreed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState<{ blob: Blob; url: string } | null>(null)
  const playbackURL = useRef('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mime = typeof MediaRecorder === 'undefined' ? undefined : recordingTypes.find(type => MediaRecorder.isTypeSupported(type))
  const supported = Boolean(mime && navigator.mediaDevices?.getUserMedia)
  const policy = (document as Document & { featurePolicy?: { allowsFeature: (feature: string) => boolean } }).featurePolicy
  const needsReload = policy?.allowsFeature('microphone') === false
  const protectedPhase = !['ready', 'permission'].includes(phase)

  useEffect(() => {
    active.current = true
    const element = dialog.current
    element?.showModal()
    return () => {
      active.current = false
      request.current?.abort()
      if (media.current?.state === 'recording') media.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
      URL.revokeObjectURL(playbackURL.current)
      element?.close()
    }
  }, [])

  useEffect(() => {
    if (!protectedPhase) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [protectedPhase])

  function stop() {
    if (media.current?.state !== 'recording') return
    setPhase('stopping')
    media.current.stop()
    stream.current?.getTracks().forEach(track => track.stop())
  }

  useEffect(() => {
    if (phase !== 'recording') return
    const started = Date.now()
    const tick = () => {
      const seconds = Math.floor((Date.now() - started) / 1000)
      setElapsed(Math.min(seconds, recordingSeconds))
      if (seconds >= recordingSeconds) {
        setNotice('Recording stopped at 30 minutes.')
        stop()
      }
    }
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [phase])

  async function start() {
    if (!agreed || !mime) return
    setError('')
    setNotice('')
    setPhase('permission')
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false })
      if (!active.current) {
        input.getTracks().forEach(track => track.stop())
        return
      }
      stream.current = input
      const recorder = new MediaRecorder(input, { mimeType: mime, audioBitsPerSecond: 48_000 })
      media.current = recorder
      const chunks: Blob[] = []
      let bytes = 0
      recorder.ondataavailable = ({ data }) => {
        if (!active.current || !data.size) return
        bytes += data.size
        if (bytes > recordingBytes) {
          setNotice('Recording stopped at the file size limit. Review the audio before transcribing.')
          stop()
        } else {
          chunks.push(data)
        }
      }
      recorder.onstop = () => {
        input.getTracks().forEach(track => track.stop())
        if (!active.current) return
        if (!chunks.length) {
          setError('The microphone didn’t capture any audio. Check your microphone and try again.')
          setPhase('ready')
          return
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || mime })
        playbackURL.current = URL.createObjectURL(blob)
        setRecording({ blob, url: playbackURL.current })
        setPhase('review')
      }
      recorder.onerror = () => {
        if (active.current) setNotice('The microphone stopped unexpectedly. Review the audio that was recorded.')
      }
      input.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
        if (active.current && recorder.state === 'recording') {
          setNotice('The microphone disconnected.')
          stop()
        }
      }))
      recorder.start(1000)
      setElapsed(0)
      setPhase('recording')
    } catch (reason) {
      stream.current?.getTracks().forEach(track => track.stop())
      if (!active.current) return
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Check this site’s microphone permission, then reload Capture and try again.'
        : 'Vimbre couldn’t start the microphone. Check that a microphone is connected and available.')
      setPhase('ready')
    }
  }

  async function transcribe() {
    if (!recording || request.current) return
    setError('')
    setPhase('transcribing')
    const controller = new AbortController()
    request.current = controller
    try {
      const { data, error: failure } = await supabase.functions.invoke<{ transcript?: string }>('capture-transcribe', {
        body: recording.blob, headers: { 'Content-Type': recording.blob.type },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(145_000)]),
      })
      if (!active.current) return
      if (data?.transcript && !failure) {
        close()
        onTranscript(data.transcript)
        return
      }
      let code = ''
      try { code = (await failure?.context?.json())?.code ?? '' } catch { /* Show the Capture message below. */ }
      if (!active.current) return
      if (code === 'recording_limit') onLimit()
      setError(messages[code] ?? 'Transcription didn’t finish. Your recording is still here. Retry or download it.')
    } catch {
      if (active.current) setError('Transcription didn’t finish. Your recording is still here. Retry or download it.')
    } finally {
      request.current = null
      if (active.current) setPhase('review')
    }
  }

  function discard() {
    if (!protectedPhase || window.confirm('Discard this recording? The audio will be lost unless you downloaded it.')) close()
  }

  return <dialog ref={dialog} className="vc-record-dialog" aria-labelledby="vc-record-title" onCancel={event => {
    event.preventDefault()
    if (phase !== 'transcribing') discard()
  }}>
    <h2 id="vc-record-title">Record an in-person meeting</h2>
    {phase === 'ready' && <>
      {!status ? <p role="status">Checking recording access…</p>
        : limited ? <p role="status">{messages.recording_limit}</p>
        : status.code === 'status_unavailable' ? <p role="alert">Couldn’t check recording access. Try again.</p>
        : !status.available ? <p role="status">Recording is unavailable for your workspace right now. You can still paste meeting notes in Capture.</p>
        : needsReload
        ? <p role="status">Reload Capture to enable the microphone. Copy any unsaved notes before reloading.</p> : !supported
        ? <p role="status">Microphone recording is unavailable in this browser. Open Capture in a supported browser or paste your meeting notes.</p>
        : <>
          <p>Record up to 30 minutes. Keep this tab open and your screen awake.</p>
          <label className="vc-record-consent"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)}/>Everyone in the meeting agreed to be recorded.</label>
        </>}
    </>}
    {phase === 'permission' && <p role="status">Allow microphone access when your browser asks.</p>}
    {(phase === 'recording' || phase === 'stopping') && <div className="vc-record-meter">
      <strong role="status" className="vc-record-status">{phase === 'recording'
        ? <><span className="vc-record-dot" aria-hidden="true"/>Recording</>
        : 'Finishing recording…'}</strong>
      <span role="timer">{duration(elapsed)} / 30:00</span>
    </div>}
    {notice && <p role="status">{notice}</p>}
    {recording && <div className="vc-record-playback">
      <audio controls src={recording.url} aria-label="Meeting recording"/>
      <a href={recording.url} download={'vimbre-meeting.' + (recording.blob.type.includes('mp4') ? 'mp4' : recording.blob.type.includes('ogg') ? 'ogg' : 'webm')}>Download recording</a>
    </div>}
    {error && <p role="alert" className="vc-error">{error}</p>}
    {phase === 'transcribing' && <p role="status">Transcribing the recording. Keep this tab open.</p>}
    <div className="form-actions">
      {phase === 'ready' && status?.code === 'status_unavailable' && <Button variant="secondary" onClick={retryStatus}>Try again</Button>}
      {phase === 'ready' && status?.available && supported && !limited && !needsReload && <Button disabled={!agreed} onClick={() => void start()}>Start recording</Button>}
      {phase === 'recording' && <Button variant="danger" onClick={stop}>Stop recording</Button>}
      {phase === 'review' && <Button disabled={limited} onClick={() => void transcribe()}>Transcribe recording</Button>}
      {phase !== 'transcribing' && phase !== 'stopping' && <Button variant="secondary" onClick={discard}>{protectedPhase ? 'Discard recording' : 'Close'}</Button>}
    </div>
  </dialog>
}
