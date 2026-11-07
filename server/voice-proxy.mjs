import { createServer } from 'node:http'

const port = Number(process.env.VIABLE_VOICE_PORT || 8787)
const googleApiKey = process.env.GEMINI_PROXY_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
const geminiBaseUrl = (process.env.GEMINI_BASE_URL || 'https://ai4a11y.lovable.app/api/public/gemini/v1beta').replace(/\/$/, '')
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(body))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 25_000_000) reject(new Error('Request is too large.'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Request body must be valid JSON.')) }
    })
    request.on('error', reject)
  })
}

function contextForPrompt(context = {}) {
  return JSON.stringify({
    title: context.title,
    host: context.host,
    url: context.url,
    description: context.description,
    section: context.section,
    facts: context.facts,
    formFields: context.formFields,
    headings: context.headings,
    links: context.links,
    forms: context.forms,
    images: (context.images || []).slice(0, 10).map((img) => ({ alt: img.alt, title: img.title, src: img.src ? 'present' : 'none' })),
    videos: (context.videos || []).slice(0, 5).map((v) => ({ title: v.title, hasCaptions: v.hasCaptions })),
    buttons: (context.buttons || []).slice(0, 15).map((b) => ({ label: b.label, isSubmit: b.isSubmit })),
    mainContent: (context.mainParagraphs || []).slice(0, 8),
  })
}

async function respondWithGemini({ input, context, language }) {
  if (!googleApiKey) throw new Error('GEMINI_PROXY_KEY or GOOGLE_API_KEY is not configured on the voice server.')
  const system = [
    'You are ViAble, an intelligent voice-first Screen Reader and TalkBack agent for blind and low-vision web users.',
    'You are directly inspecting the user\'s currently active webpage. Base all facts, answers, navigation, and descriptions strictly on the supplied active page context.',
    'When asked about images or photos, describe the images present on the page using their alt text and labels, and mention if any images lack descriptions.',
    'When asked about videos, describe any videos or players found on the page and whether they have captions.',
    'When the user asks to fill a form, apply for an event, or register, explain the fields clearly and remind them: "I will fill this, but will ask for your consent before clicking submit/apply."',
    'CODE-SWITCHING VALUE CHAIN: If the user communicates or asks in Sheng or mixed Kenyan English/Kiswahili, MATCH their code-switching style naturally! Use familiar urban Kenyan cadence (e.g. "Rada fiti", "Hii page inakusho kuhusu...", "Kuna picha ya...", "Nimeku-fillia fomu, lakini kabla tu-submit lazima uniconfirmie").',
    'Keep spoken answers concise, direct, natural, and free of markdown symbols or emoji so they sound crystal-clear when read aloud.',
    `Target language preference: ${language || 'Kenyan English / Sheng / Kiswahili'}.`,
  ].join(' ')
  const url = `${geminiBaseUrl}/models/${geminiModel}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': googleApiKey.trim(),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: `Active page context: ${contextForPrompt(context)}\n\nVoice request: ${String(input || '').slice(0, 1200)}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    }),
  })
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 220)
    throw new Error(`Gemini returned ${response.status}: ${details}`)
  }
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((part) => part.text && !part.thought)
    ?.map((part) => part.text || '')
    ?.join(' ')
    ?.trim()
  if (!text) throw new Error('Gemini returned no answer.')
  return text
}

async function transcribeWithWhisper({ audioBase64, mimeType = 'audio/webm', language }) {
  if (!googleApiKey) throw new Error('GEMINI_PROXY_KEY or GOOGLE_API_KEY is not configured on the voice server.')
  const cleanBase64 = String(audioBase64 || '').replace(/^data:audio\/[a-z0-9_-]+;base64,/, '')
  const system = [
    'You are an expert Whisper-grade speech-to-text transcription engine specializing in Kenyan English, Kiswahili, and Sheng code-switching.',
    'Transcribe the user audio verbatim. Preserve Kenyan colloquialisms, Sheng slang, and code-switched phrasing exactly as spoken.',
    'Do not translate, do not summarize, and do not add commentary. Return ONLY the transcription text.',
  ].join(' ')

  const url = `${geminiBaseUrl}/models/${geminiModel}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': googleApiKey.trim(),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        role: 'user',
        parts: [
          { text: `Transcribe this speech accurately in ${language || 'Kenyan English / Kiswahili / Sheng'}:` },
          { inlineData: { mimeType: mimeType.split(';')[0] || 'audio/webm', data: cleanBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 800 },
    }),
  })
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 220)
    throw new Error(`Whisper transcription failed (${response.status}): ${details}`)
  }
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((part) => part.text && !part.thought)
    ?.map((part) => part.text || '')
    ?.join(' ')
    ?.trim()
  if (!text) throw new Error('Could not transcribe audio.')
  return { text, model: 'whisper-multimodal', language: language || 'mixed' }
}

async function performOcr({ imageBase64, mimeType = 'image/png', prompt }) {
  if (!googleApiKey) throw new Error('GEMINI_PROXY_KEY or GOOGLE_API_KEY is not configured on the voice server.')
  const cleanBase64 = String(imageBase64 || '').replace(/^data:image\/[a-z0-9_-]+;base64,/, '')
  const system = [
    'You are ViAble Vision and OCR engine for blind and low-vision web users.',
    'Extract all readable text, signs, labels, form inputs, buttons, tables, and document layout from the provided image or canvas.',
    'Structure the output cleanly with headings and bullet points suitable for screen readers and spoken synthesis.',
    'Identify any Kenyan context, official terms, or multilingual text (English, Kiswahili, Sheng) accurately.',
  ].join(' ')

  const url = `${geminiBaseUrl}/models/${geminiModel}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': googleApiKey.trim(),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        role: 'user',
        parts: [
          { text: prompt || 'Extract all visible text and provide a concise visual description for an accessibility screen reader.' },
          { inlineData: { mimeType: mimeType.split(';')[0] || 'image/png', data: cleanBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
    }),
  })
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 220)
    throw new Error(`OCR analysis failed (${response.status}): ${details}`)
  }
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((part) => part.text && !part.thought)
    ?.map((part) => part.text || '')
    ?.join(' ')
    ?.trim()
  if (!text) throw new Error('No text or content detected in image.')
  return { text, model: 'viable-ocr-gemini' }
}

async function synthesizeWithElevenLabs({ text, language, voiceId }) {
  if (!elevenLabsApiKey) throw new Error('ELEVENLABS_API_KEY is not configured on the voice server.')
  const targetVoice = voiceId || elevenLabsVoiceId
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(targetVoice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': elevenLabsApiKey.trim(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: String(text || '').slice(0, 4500),
      model_id: 'eleven_multilingual_v2',
      language_code: language === 'Kiswahili' ? 'sw' : undefined,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  })
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 220)
    throw new Error(`ElevenLabs returned ${response.status}: ${details}`)
  }
  return { audioBase64: Buffer.from(await response.arrayBuffer()).toString('base64'), mimeType: response.headers.get('content-type') || 'audio/mpeg' }
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' })
    return response.end()
  }
  const allowedEndpoints = ['/api/voice/respond', '/api/voice/speak', '/api/voice/transcribe', '/api/vision/ocr']
  if (request.method !== 'POST' || !allowedEndpoints.includes(request.url)) return send(response, 404, { ok: false, error: 'Not found.' })
  try {
    const payload = await readJson(request)
    if (request.url === '/api/voice/respond') {
      const text = await respondWithGemini(payload)
      return send(response, 200, { ok: true, text, provider: 'Gemini + ElevenLabs' })
    }
    if (request.url === '/api/voice/transcribe') {
      const result = await transcribeWithWhisper(payload)
      return send(response, 200, { ok: true, ...result, provider: 'Whisper STT' })
    }
    if (request.url === '/api/vision/ocr') {
      const result = await performOcr(payload)
      return send(response, 200, { ok: true, ...result, provider: 'ViAble Vision OCR' })
    }
    const audio = await synthesizeWithElevenLabs(payload)
    return send(response, 200, { ok: true, ...audio, provider: 'Gemini + ElevenLabs' })
  } catch (error) {
    return send(response, 503, { ok: false, error: error?.message || 'Voice provider unavailable.' })
  }
})

server.listen(port, '0.0.0.0', () => console.log(`ViAble voice proxy listening on http://localhost:${port}`))
