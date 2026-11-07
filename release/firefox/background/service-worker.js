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
  const tabs = await api.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function ensureContentScript(tabId) {
  try {
    const ping = await api.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' })
    if (ping?.ok) return ping
  } catch {
    if (!api.scripting?.executeScript) throw new Error('This browser needs a content-script permission before page inspection.')
    await api.scripting.executeScript({ target: { tabId }, files: ['content/page-context.js'] })
  }
  return api.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' })
}

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

const allowedActions = new Set(['FOCUS_FIELD', 'SCROLL', 'FILL_FIELD'])

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ;(async () => {
    if (message?.type === 'GET_PAGE_CONTEXT') {
      const tab = await activeTab()
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      try {
        return await ensureContentScript(tab.id)
      } catch {
        return { ok: false, error: 'ViAble needs a user-activated webpage before it can inspect this tab.' }
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
    if (message?.type === 'OPEN_MICROPHONE_PERMISSION') {
      const permissionTab = await api.tabs.create({ url: api.runtime.getURL('permission.html'), active: true })
      return permissionTab?.id ? { ok: true, tabId: permissionTab.id } : { ok: false, error: 'Could not open the microphone permission page.' }
    }
    if (message?.type === 'MICROPHONE_PERMISSION_GRANTED') return { ok: true }
    if (message?.type === 'EXECUTE_PAGE_ACTION') {
      const action = message.action || {}
      if (!allowedActions.has(action.type)) return { ok: false, error: 'That browser action is not available.' }
      if (action.type === 'FILL_FIELD' && action.approved !== true) return { ok: false, error: 'Form changes require your approval.' }
      const tab = await activeTab()
      if (!tab?.id) return { ok: false, error: 'No active webpage is available.' }
      await ensureContentScript(tab.id)
      return api.tabs.sendMessage(tab.id, { type: 'EXECUTE_PAGE_ACTION', action })
    }
    if (message?.type === 'VOICE_ASK') return callVoiceProxy('/api/voice/respond', message.payload || {})
    if (message?.type === 'VOICE_SPEAK') return callVoiceProxy('/api/voice/speak', message.payload || {})
    return { ok: false, error: 'Unknown ViAble message.' }
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || 'Extension request failed.' }))
  return true
})
