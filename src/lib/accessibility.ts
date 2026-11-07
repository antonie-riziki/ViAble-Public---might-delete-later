export interface PageAccessibilitySettings {
  contrast: 'normal' | 'high-contrast' | 'inverted' | 'dark-mode'
  brightness: number // 50 to 150 (%)
  fontScale: number // 90 to 220 (%)
  highlightFocus: boolean
}

export const defaultAccessibilitySettings: PageAccessibilitySettings = {
  contrast: 'normal',
  brightness: 100,
  fontScale: 100,
  highlightFocus: true,
}

type ExtensionApi = {
  runtime?: {
    id?: string
    sendMessage: <T = unknown>(message: unknown) => Promise<T>
  }
  storage?: {
    local?: {
      get: (keys: unknown) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
  }
}

function getApi(): ExtensionApi | null {
  const globalObj = globalThis as typeof globalThis & { chrome?: ExtensionApi; browser?: ExtensionApi }
  return globalObj.chrome?.runtime?.id ? globalObj.chrome : globalObj.browser?.runtime?.id ? globalObj.browser : null
}

export async function loadAccessibilitySettings(): Promise<PageAccessibilitySettings> {
  const api = getApi()
  if (api?.storage?.local) {
    try {
      const stored = await api.storage.local.get({ accessibilitySettings: defaultAccessibilitySettings })
      return { ...defaultAccessibilitySettings, ...(stored.accessibilitySettings as Partial<PageAccessibilitySettings> || {}) }
    } catch {
      return defaultAccessibilitySettings
    }
  }
  try {
    const raw = localStorage.getItem('viable_accessibility_settings')
    if (raw) return { ...defaultAccessibilitySettings, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return defaultAccessibilitySettings
}

export async function saveAndApplyAccessibilitySettings(settings: PageAccessibilitySettings): Promise<boolean> {
  const api = getApi()
  if (api?.storage?.local) {
    try {
      await api.storage.local.set({ accessibilitySettings: settings })
      await api.runtime?.sendMessage({ type: 'APPLY_ACCESSIBILITY_SETTINGS', settings })
      return true
    } catch {
      return false
    }
  }
  try {
    localStorage.setItem('viable_accessibility_settings', JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
