/**
 * Plays ViAble's voice. Chrome blocks audio in a side panel until the user has
 * clicked inside it, which would make "read the page as soon as it opens"
 * impossible. An offscreen document created for AUDIO_PLAYBACK is allowed to
 * play without a click, so all spoken output goes through here.
 */
let audio = null
let utterance = null

function stop() {
  if (audio) { audio.pause(); audio.src = ''; audio = null }
  if (utterance) { utterance = null }
  try { speechSynthesis.cancel() } catch { /* not available */ }
}

function play({ audioBase64, mimeType, rate }) {
  return new Promise((resolve) => {
    try {
      const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'audio/mpeg' }))
      const el = new Audio(url)
      audio = el
      if (rate) el.playbackRate = rate
      const done = (result) => { URL.revokeObjectURL(url); if (audio === el) audio = null; resolve(result) }
      el.onended = () => done({ ok: true })
      el.onerror = () => done({ ok: false, error: 'The audio could not be played.' })
      el.play().catch((error) => done({ ok: false, error: error?.message || 'Playback was blocked.' }))
    } catch (error) {
      resolve({ ok: false, error: error?.message || 'Playback failed.' })
    }
  })
}

function say({ text, lang, rate }) {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve({ ok: false, error: 'Browser speech is not available.' })
    const u = new SpeechSynthesisUtterance(text)
    utterance = u
    u.lang = lang || 'en-US'
    u.rate = rate || 0.95
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(String(u.lang).slice(0, 2).toLowerCase()))
    if (voice) u.voice = voice
    u.onend = () => resolve({ ok: true })
    u.onerror = (event) => resolve({ ok: false, error: event?.error || 'Speech failed.' })
    speechSynthesis.speak(u)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false
  if (message.type === 'STOP') { stop(); sendResponse({ ok: true }); return false }
  stop()
  if (message.type === 'PLAY') { play(message).then(sendResponse); return true }
  if (message.type === 'SPEAK') { say(message).then(sendResponse); return true }
  return false
})
