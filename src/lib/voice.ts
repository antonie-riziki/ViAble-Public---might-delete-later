import { buildResponse } from './language'
import type { Language, PageContext } from './domain'
import { isExtensionRuntime } from './extension'

type SpeechRecognitionResultEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type VoiceWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export type VoiceRecognitionHandle = {
  stop: () => void
  abort: () => void
}

export type VoiceProvider = 'Whisper STT' | 'Gemini + ElevenLabs' | 'ViAble Vision OCR' | 'browser fallback'

const voiceApiUrl = (import.meta.env.VITE_VIABLE_VOICE_API_URL || 'http://localhost:8787').replace(/\/$/, '')
let microphoneAccessGranted = false
let microphoneAccessRequest: Promise<void> | null = null

type VoiceExtensionApi = {
  runtime?: {
    id?: string
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

function languageCode(language: Language) {
  if (language === 'Kiswahili') return 'sw-KE'
  return 'en-KE'
}

function getSpeechRecognitionConstructor() {
  const voiceWindow = window as VoiceWindow
  return voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition || null
}

function getVoiceExtensionApi(): VoiceExtensionApi | null {
  const api = globalThis as typeof globalThis & { chrome?: VoiceExtensionApi; browser?: VoiceExtensionApi }
  return api.chrome?.runtime?.id ? api.chrome : api.browser?.runtime?.id ? api.browser : null
}

async function microphonePermissionState() {
  try {
    const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return permission.state
  } catch {
    return 'unknown' as const
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

async function waitForMicrophonePermission() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const state = await microphonePermissionState()
    if (state === 'granted') return
    if (state === 'denied') throw Object.assign(new Error('Microphone access was blocked.'), { name: 'NotAllowedError' })
    await wait(500)
  }
  throw new Error('The microphone permission window was closed before access was granted.')
}

export function supportsSpeechRecognition() {
  return Boolean(getSpeechRecognitionConstructor())
}

/**
 * Ask for microphone access from the extension page while the user gesture is
 * still active. SpeechRecognition does not reliably surface this prompt from
 * an extension side panel on its own, so request the media permission first.
 */
export function requestMicrophoneAccess() {
  if (microphoneAccessGranted) return Promise.resolve()
  if (microphoneAccessRequest) return microphoneAccessRequest

  microphoneAccessRequest = (async () => {
    const currentState = await microphonePermissionState()
    if (currentState === 'granted') {
      microphoneAccessGranted = true
      return
    }

    const extensionApi = getVoiceExtensionApi()
    if (extensionApi?.runtime) {
      const response = await extensionApi.runtime.sendMessage({ type: 'OPEN_MICROPHONE_PERMISSION' }) as { ok?: boolean; error?: string } | undefined
      if (!response?.ok) throw new Error(response?.error || 'Could not open the microphone permission page.')
      await waitForMicrophonePermission()
      microphoneAccessGranted = true
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not available in this browser.')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    microphoneAccessGranted = true
    stream.getTracks().forEach((track) => track.stop())
  })()
    .finally(() => {
      microphoneAccessRequest = null
    })

  return microphoneAccessRequest
}

export function microphoneErrorMessage(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow microphone access for ViAble in browser settings, then try again.'
  }
  if (name === 'NotFoundError') return 'No microphone was found. Connect a microphone, then try again.'
  if (name === 'NotReadableError') return 'The microphone is already in use. Close other recording apps, then try again.'
  return error instanceof Error ? error.message : 'Microphone access is unavailable. Check your browser settings, then try again.'
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function transcribeWithWhisper(audioBlob: Blob, language: Language = 'English'): Promise<string> {
  const dataUrl = await blobToBase64(audioBlob)
  const mimeType = audioBlob.type || 'audio/webm'
  const payload = { audioBase64: dataUrl, mimeType, language }

  if (isExtensionRuntime()) {
    const extensionApi = getVoiceExtensionApi()
    const response = await extensionApi?.runtime?.sendMessage({ type: 'VOICE_TRANSCRIBE', payload }) as { ok?: boolean; text?: string; error?: string } | undefined
    if (response?.ok && response.text) return response.text
    if (response?.error) throw new Error(response.error)
  } else {
    const response = await fetch(`${voiceApiUrl}/api/voice/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (response.ok && data.ok && data.text) return data.text
    if (data.error) throw new Error(data.error)
  }
  throw new Error('Whisper transcription unavailable.')
}

export async function performOcrAnalysis(imageBase64: string, prompt?: string): Promise<string> {
  const payload = { imageBase64, mimeType: 'image/png', prompt }
  if (isExtensionRuntime()) {
    const extensionApi = getVoiceExtensionApi()
    const response = await extensionApi?.runtime?.sendMessage({ type: 'VISION_OCR', payload }) as { ok?: boolean; text?: string; error?: string } | undefined
    if (response?.ok && response.text) return response.text
    if (response?.error) throw new Error(response.error)
  } else {
    const response = await fetch(`${voiceApiUrl}/api/vision/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (response.ok && data.ok && data.text) return data.text
    if (data.error) throw new Error(data.error)
  }
  throw new Error('Vision OCR unavailable.')
}

export function startWhisperRecording(options: {
  language: Language
  onStart: () => void
  onResult: (text: string) => void
  onEnd: () => void
  onError: (message: string) => void
}): VoiceRecognitionHandle | null {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return startSpeechRecognition(options)
  }

  let mediaStream: MediaStream | null = null
  let mediaRecorder: MediaRecorder | null = null
  const chunks: Blob[] = []
  let stopped = false

  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    if (stopped) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    mediaStream = stream
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : ''
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    mediaRecorder.onstart = () => {
      options.onStart()
    }
    mediaRecorder.onerror = () => {
      options.onError('Audio recording error.')
      options.onEnd()
    }
    mediaRecorder.onstop = async () => {
      options.onEnd()
      try {
        const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        if (audioBlob.size > 1000) {
          const text = await transcribeWithWhisper(audioBlob, options.language)
          if (text) options.onResult(text)
        }
      } catch (err) {
        options.onError(err instanceof Error ? err.message : 'Transcription error.')
      } finally {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
    mediaRecorder.start(250)
  }).catch((err) => {
    options.onError(microphoneErrorMessage(err))
    options.onEnd()
  })

  return {
    stop: () => {
      stopped = true
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop())
    },
    abort: () => {
      stopped = true
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop())
      options.onEnd()
    },
  }
}

export function startSpeechRecognition(options: {
  language: Language
  onStart: () => void
  onResult: (text: string) => void
  onEnd: () => void
  onError: (message: string) => void
}): VoiceRecognitionHandle | null {
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = languageCode(options.language)
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onstart = options.onStart
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim()
    if (transcript) options.onResult(transcript)
  }
  recognition.onerror = (event) => options.onError(event.error === 'not-allowed' ? 'Microphone access was blocked. Allow microphone access for ViAble, then try again.' : 'I could not hear that. Please try again.')
  recognition.onend = options.onEnd

  try {
    recognition.start()
  } catch {
    options.onError('The microphone is already in use. Please stop it and try again.')
    return null
  }

  return { stop: () => recognition.stop(), abort: () => recognition.abort() }
}

async function requestProvider(path: string, payload: unknown) {
  const response = await fetch(`${voiceApiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Voice service returned ${response.status}`)
  return response.json() as Promise<{ ok: boolean; text?: string; audioBase64?: string; mimeType?: string; provider?: VoiceProvider; error?: string }>
}

export async function askViAble(input: string, context: PageContext, language: Language) {
  const payload = { input, context, language }
  try {
    if (isExtensionRuntime()) {
      const extensionApi = getVoiceExtensionApi()
      const response = await extensionApi?.runtime?.sendMessage({ type: 'VOICE_ASK', payload }) as { ok?: boolean; text?: string; provider?: VoiceProvider } | undefined
      if (response?.ok && response.text) return { text: response.text, provider: response.provider || 'Gemini + ElevenLabs' as VoiceProvider }
    } else {
      const response = await requestProvider('/api/voice/respond', payload)
      if (response.ok && response.text) return { text: response.text, provider: response.provider || 'Gemini + ElevenLabs' as VoiceProvider }
    }
  } catch {
    // The offline response keeps the core interaction usable when the proxy is not running.
  }
  return { text: buildResponse(language, input), provider: 'browser fallback' as VoiceProvider }
}

function decodeBase64(value: string) {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/**
 * Spoken output is played by an offscreen document (see public/offscreen.js): Chrome
 * refuses sound in a side panel until the person has clicked in it, which would stop
 * pages being read aloud the moment they open.
 */
async function viaOffscreen(message: Record<string, unknown>): Promise<{ ok?: boolean; error?: string } | null> {
  const api = getVoiceExtensionApi()
  if (!api?.runtime) return null
  try {
    const ready = (await api.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' })) as { ok?: boolean } | undefined
    if (!ready?.ok) return null
    return ((await api.runtime.sendMessage({ target: 'offscreen', ...message })) as { ok?: boolean; error?: string } | undefined) ?? null
  } catch {
    return null
  }
}

export async function stopSpeech() {
  window.speechSynthesis?.cancel()
  await viaOffscreen({ type: 'STOP' })
}

async function browserSpeak(text: string, language: Language) {
  const spoken = await viaOffscreen({ type: 'SPEAK', text, lang: languageCode(language), rate: 0.95 })
  if (spoken?.ok) return
  await new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = languageCode(language)
    utterance.rate = 0.95
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export async function speakViAble(text: string, language: Language) {
  try {
    let response: { ok?: boolean; audioBase64?: string; mimeType?: string; provider?: VoiceProvider } | undefined
    if (isExtensionRuntime()) {
      const extensionApi = getVoiceExtensionApi()
      response = await extensionApi?.runtime?.sendMessage({ type: 'VOICE_SPEAK', payload: { text, language } }) as typeof response
    } else {
      response = await requestProvider('/api/voice/speak', { text, language })
    }
    if (response?.ok && response.audioBase64) {
      const played = await viaOffscreen({ type: 'PLAY', audioBase64: response.audioBase64, mimeType: response.mimeType || 'audio/mpeg' })
      if (played?.ok) return (response.provider || 'Gemini + ElevenLabs') as VoiceProvider
      // No offscreen support (Firefox, preview): play in the panel itself.
      const blob = new Blob([decodeBase64(response.audioBase64)], { type: response.mimeType || 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      await audio.play()
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
      })
      URL.revokeObjectURL(url)
      return (response.provider || 'Gemini + ElevenLabs') as VoiceProvider
    }
  } catch {
    // Native speech is the accessibility-safe fallback when provider audio is unavailable.
  }
  await browserSpeak(text, language)
  return 'browser fallback' as VoiceProvider
}
