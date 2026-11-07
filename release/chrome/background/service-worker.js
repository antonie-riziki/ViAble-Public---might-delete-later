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

async function activeTab() {
  const focusedTabs = await api.tabs.query({ active: true, lastFocusedWindow: true })
  if (focusedTabs.length && focusedTabs[0].url && !focusedTabs[0].url.startsWith('chrome-extension://')) {
    return focusedTabs[0]
  }
  const currentTabs = await api.tabs.query({ active: true, currentWindow: true })
  if (currentTabs.length && currentTabs[0].url && !currentTabs[0].url.startsWith('chrome-extension://')) {
    return currentTabs[0]
  }
  const allActive = await api.tabs.query({ active: true })
  const valid = allActive.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'))
  return valid || allActive[0]
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
  return `ViAble could not read this tab (${error?.message || 'no response'}). Reload the tab and try again.`
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

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'GET_PAGE_CONTEXT') {
      const tab = await activeTab()
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
      const tab = await activeTab()
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
      const tab = await activeTab()
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      await ensureContentScript(tab.id)
      return api.tabs.sendMessage(tab.id, { type: 'EXECUTE_PAGE_ACTION', action })
    }
    if (message?.type === 'VOICE_ASK') return callVoiceProxy('/api/voice/respond', message.payload || {})
    if (message?.type === 'VOICE_SPEAK') return callVoiceProxy('/api/voice/speak', message.payload || {})
    if (message?.type === 'VOICE_TRANSCRIBE') return callVoiceProxy('/api/voice/transcribe', message.payload || {})
    if (message?.type === 'VISION_OCR') return callVoiceProxy('/api/vision/ocr', message.payload || {})
    if (message?.type === 'CAPTURE_TAB_OCR') {
      const tab = await activeTab()
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
