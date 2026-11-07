import type { PageContext } from './domain'

export type ExtensionSettings = {
  responseLanguage: 'English' | 'Kiswahili' | 'Sheng'
  interactionMode: 'reader-first' | 'voice' | 'task-assistance'
  readingSpeed: number
  rememberPreferences: boolean
  sttEngine?: 'whisper' | 'browser'
  ttsEngine?: 'elevenlabs' | 'browser'
  codeSwitchingPreference?: 'adaptive' | 'always-sheng' | 'always-swahili' | 'kenyan-english'
  kenyanAccentTuning?: boolean
  autoOcrInaccessibleImages?: boolean
  requireExplicitApproval?: boolean
}

type ExtensionApi = {
  runtime?: {
    id?: string
    sendMessage: <T = unknown>(message: unknown) => Promise<T>
  }
}

const defaultSettings: ExtensionSettings = {
  responseLanguage: 'English',
  interactionMode: 'reader-first',
  readingSpeed: 1,
  rememberPreferences: true,
  sttEngine: 'whisper',
  ttsEngine: 'elevenlabs',
  codeSwitchingPreference: 'adaptive',
  kenyanAccentTuning: true,
  autoOcrInaccessibleImages: true,
  requireExplicitApproval: true,
}

function getExtensionApi(): ExtensionApi | null {
  const runtime = globalThis as typeof globalThis & { chrome?: ExtensionApi; browser?: ExtensionApi }
  return runtime.chrome?.runtime?.id ? runtime.chrome : runtime.browser?.runtime?.id ? runtime.browser : null
}

export function isExtensionRuntime() {
  return Boolean(getExtensionApi())
}

let pageError = ''
/** Why the last page read failed ('' when it worked). */
export const getPageError = () => pageError

export async function requestPageContext(): Promise<PageContext | null> {
  const api = getExtensionApi()
  if (!api?.runtime) return null
  try {
    const response = await api.runtime.sendMessage<{ ok: boolean; context?: PageContext; error?: string }>({ type: 'GET_PAGE_CONTEXT' })
    pageError = response?.ok ? '' : response?.error || 'No response from the ViAble background service.'
    return response?.ok ? response.context ?? null : null
  } catch (error) {
    pageError = error instanceof Error ? error.message : 'No response from the ViAble background service.'
    return null
  }
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const api = getExtensionApi()
  if (!api?.runtime) return defaultSettings
  try {
    const response = await api.runtime.sendMessage<{ ok: boolean; settings?: Partial<ExtensionSettings> }>({ type: 'GET_SETTINGS' })
    return { ...defaultSettings, ...(response?.settings ?? {}) }
  } catch {
    return defaultSettings
  }
}

export async function saveSettings(settings: ExtensionSettings) {
  const api = getExtensionApi()
  if (!api?.runtime) return false
  try {
    const response = await api.runtime.sendMessage<{ ok: boolean }>({ type: 'SAVE_SETTINGS', settings })
    return response?.ok ?? false
  } catch {
    return false
  }
}

export async function executePageAction(action: { type: string; index?: number; value?: string; amount?: number; approved?: boolean }) {
  const api = getExtensionApi()
  if (!api?.runtime) return { ok: false, error: 'Extension runtime is unavailable.' }
  try {
    return await api.runtime.sendMessage<{ ok: boolean; error?: string }>({ type: 'EXECUTE_PAGE_ACTION', action })
  } catch {
    return { ok: false, error: 'Could not reach the active page.' }
  }
}

export async function captureTabOcr(prompt?: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const api = getExtensionApi()
  if (!api?.runtime) return { ok: false, error: 'Extension runtime is unavailable.' }
  try {
    return await api.runtime.sendMessage<{ ok: boolean; text?: string; error?: string }>({ type: 'CAPTURE_TAB_OCR', prompt })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not trigger OCR' }
  }
}

export async function applyPageAccessibility(settings: unknown) {
  const api = getExtensionApi()
  if (!api?.runtime) return { ok: false, error: 'Extension runtime unavailable' }
  try {
    return await api.runtime.sendMessage<{ ok: boolean }>({ type: 'APPLY_ACCESSIBILITY_SETTINGS', settings })
  } catch {
    return { ok: false, error: 'Could not update active page styling' }
  }
}

export async function fillPageFields(fields: { nameOrLabel: string; value: string }[]) {
  return executePageAction({ type: 'FILL_FORM_FIELDS', ...({ fields } as unknown as { value: string }) })
}

export async function clickPageButton(options: { text?: string; index?: number; isSubmit?: boolean; approved?: boolean }) {
  return executePageAction({ type: 'CLICK_BUTTON', ...options })
}

export function onTabChange(callback: () => void): () => void {
  const runtime = globalThis as typeof globalThis & { chrome?: { runtime?: { onMessage?: { addListener: (cb: unknown) => void; removeListener: (cb: unknown) => void } } } }
  const listener = (msg: { type?: string }) => {
    if (msg?.type === 'ACTIVE_TAB_CHANGED') callback()
  }
  runtime.chrome?.runtime?.onMessage?.addListener(listener)
  return () => runtime.chrome?.runtime?.onMessage?.removeListener(listener)
}

export { defaultSettings }
