const api = globalThis.browser || globalThis.chrome
const VOICE_PROXY_URL = 'http://localhost:8787'
const DEFAULT_SETTINGS = {
  responseLanguage: 'English',
  interactionMode: 'reader-first',
  readingSpeed: 1,
  rememberPreferences: true,
}

api.runtime.onInstalled?.addListener(() => {
  api.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
    api.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...stored.settings } })
  })
  api.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => undefined)
})

;(api.action || api.browserAction)?.onClicked?.addListener(async (tab) => {
  if (tab.windowId && api.sidePanel?.open) await api.sidePanel.open({ windowId: tab.windowId })
})

async function ensureOffscreen() {
  if (!api.offscreen?.createDocument) return false
  try {
    const existing = await api.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    if (existing?.length) return true
    await api.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Read web pages aloud automatically for blind and low-vision users, without needing a click.' })
    return true
  } catch (error) {
    return /single offscreen|already exists/i.test(error?.message || '')
  }
}

const NORMAL_WINDOW = { windowTypes: ['normal'] }
const isWebTab = (tab, excludeId) => tab?.id && tab.id !== excludeId && !/^(chrome|edge|about|chrome-extension|moz-extension|devtools|view-source):/i.test(tab.url || 'http://unknown')

/**
 * Find the page the person is looking at, on any OS. The side panel tells us which
 * browser window it belongs to, which is exact; the other strategies cover the rest.
 */
async function activeTab(windowId, excludeId) {
  if (windowId) {
    const own = await api.tabs.query({ active: true, windowId })
    if (isWebTab(own[0], excludeId)) return own[0]
  }
  const focused = await api.tabs.query({ active: true, lastFocusedWindow: true })
  if (isWebTab(focused[0], excludeId)) return focused[0]
  try {
    const last = await api.windows.getLastFocused({ ...NORMAL_WINDOW, populate: true })
    const tab = last?.tabs?.find((t) => t.active)
    if (isWebTab(tab, excludeId)) return tab
  } catch { /* windows API unavailable */ }
  const everywhere = await api.tabs.query({ active: true })
  return everywhere.find((t) => isWebTab(t, excludeId)) || focused[0] || everywhere[0]
}

const BLOCKED_URL = /^(chrome|edge|about|chrome-extension|moz-extension|devtools|view-source):|^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/i

async function ensureContentScript(tabId) {
  try {
    const ping = await api.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' })
    if (ping?.ok && ping.context) return ping
  } catch {
    // The tab was open before the extension loaded (or was reloaded): inject below.
  }
  if (api.scripting?.executeScript) {
    await api.scripting.executeScript({ target: { tabId }, files: ['content/page-context.js'] })
  }
  return api.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' })
}

function describeFailure(tab, error) {
  const url = tab?.url || ''
  if (BLOCKED_URL.test(url)) return 'Chrome does not let extensions read this kind of page (browser pages and the Web Store). Open a normal website.'
  if (/^file:/i.test(url)) return 'To read local files, turn on "Allow access to file URLs" for ViAble in chrome://extensions.'
  return `ViAble could not read this tab (${error?.message || 'no response'}; tab ${tab?.id ?? 'none'}). Reload the tab and try again.`
}

async function reapplyStoredAccessibility(tabId) {
  try {
    const stored = await api.storage.local.get(['accessibilitySettings'])
    if (stored?.accessibilitySettings) {
      await ensureContentScript(tabId)
      await api.tabs.sendMessage(tabId, { type: 'APPLY_ACCESSIBILITY_SETTINGS', settings: stored.accessibilitySettings })
    }
  } catch {
    // Restricted or internal tab
  }
}

// Ensure settings persist seamlessly across tabs
api.tabs.onActivated?.addListener(async (activeInfo) => {
  if (activeInfo?.tabId) {
    await reapplyStoredAccessibility(activeInfo.tabId)
    api.runtime.sendMessage({ type: 'ACTIVE_TAB_CHANGED', tabId: activeInfo.tabId }).catch(() => undefined)
  }
})

api.tabs.onUpdated?.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url && !tab.url.startsWith('chrome://')) {
    await reapplyStoredAccessibility(tabId)
    api.runtime.sendMessage({ type: 'ACTIVE_TAB_CHANGED', tabId, url: tab.url }).catch(() => undefined)
  }
})

async function callVoiceProxy(path, payload) {
  const response = await fetch(`${VOICE_PROXY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error(data.error || `Voice service returned ${response.status}.`)
  return data
}

const allowedActions = new Set([
  'FOCUS_FIELD',
  'SCROLL',
  'FILL_FIELD',
  'FILL_FORM_FIELDS',
  'CLICK_BUTTON',
  'APPLY_ACCESSIBILITY_SETTINGS'
])

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === 'offscreen') return false // addressed to the audio document
  ;(async () => {
    if (message?.type === 'ENSURE_OFFSCREEN') return { ok: await ensureOffscreen() }
    if (message?.type === 'GET_PAGE_CONTEXT') {
      const tab = await activeTab(message.windowId, sender?.tab?.id)
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      try {
        return await ensureContentScript(tab.id)
      } catch (error) {
        return { ok: false, error: describeFailure(tab, error) }
      }
    }
    if (message?.type === 'GET_SETTINGS') {
      const stored = await api.storage.local.get({ settings: DEFAULT_SETTINGS })
      return { ok: true, settings: { ...DEFAULT_SETTINGS, ...(stored.settings || {}) } }
    }
    if (message?.type === 'SAVE_SETTINGS') {
      await api.storage.local.set({ settings: { ...DEFAULT_SETTINGS, ...(message.settings || {}) } })
      return { ok: true }
    }
    if (message?.type === 'APPLY_ACCESSIBILITY_SETTINGS') {
      const tab = await activeTab(message.windowId, sender?.tab?.id)
      if (!tab?.id) return { ok: false, error: 'No active tab available' }
      await ensureContentScript(tab.id)
      return api.tabs.sendMessage(tab.id, { type: 'APPLY_ACCESSIBILITY_SETTINGS', settings: message.settings })
    }
    if (message?.type === 'OPEN_MICROPHONE_PERMISSION') {
      const permissionTab = await api.tabs.create({ url: api.runtime.getURL('permission.html'), active: true })
      return permissionTab?.id ? { ok: true, tabId: permissionTab.id } : { ok: false, error: 'Could not open the microphone permission page.' }
    }
    if (message?.type === 'MICROPHONE_PERMISSION_GRANTED') return { ok: true }
    if (message?.type === 'EXECUTE_PAGE_ACTION') {
      const action = message.action || {}
      if (!allowedActions.has(action.type)) return { ok: false, error: 'That browser action is not available.' }
      const tab = await activeTab(message.windowId, sender?.tab?.id)
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      await ensureContentScript(tab.id)
      return api.tabs.sendMessage(tab.id, { type: 'EXECUTE_PAGE_ACTION', action })
    }
    if (message?.type === 'VOICE_ASK') return callVoiceProxy('/api/voice/respond', message.payload || {})
    if (message?.type === 'VOICE_SPEAK') return callVoiceProxy('/api/voice/speak', message.payload || {})
    if (message?.type === 'VOICE_TRANSCRIBE') return callVoiceProxy('/api/voice/transcribe', message.payload || {})
    if (message?.type === 'VISION_OCR') return callVoiceProxy('/api/vision/ocr', message.payload || {})
    if (message?.type === 'CAPTURE_TAB_OCR') {
      const tab = await activeTab(message.windowId, sender?.tab?.id)
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      try {
        const dataUrl = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
        return await callVoiceProxy('/api/vision/ocr', { imageBase64: dataUrl, prompt: message.prompt })
      } catch (err) {
        return { ok: false, error: err?.message || 'Could not capture tab screenshot.' }
      }
    }
    return { ok: false, error: 'Unknown ViAble message.' }
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || 'Extension request failed.' }))
  return true
})
