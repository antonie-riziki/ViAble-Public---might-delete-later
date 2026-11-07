const button = document.querySelector<HTMLButtonElement>('#allow-microphone')
const statusElement = document.querySelector<HTMLElement>('#status')

type PermissionExtensionApi = {
  runtime?: {
    id?: string
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

function extensionApi() {
  const api = globalThis as typeof globalThis & { chrome?: PermissionExtensionApi; browser?: PermissionExtensionApi }
  return api.chrome?.runtime?.id ? api.chrome : api.browser?.runtime?.id ? api.browser : null
}

function errorMessage(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access was blocked. Choose Allow in the browser permission settings, then try again.'
  if (name === 'NotFoundError') return 'No microphone was found. Connect a microphone, then try again.'
  return 'Microphone access could not be started. Try the button again.'
}

async function requestMicrophone() {
  if (!button || !statusElement) return
  button.disabled = true
  statusElement.textContent = 'Waiting for the browser permission…'
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable.')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    statusElement.textContent = 'Microphone access granted. Returning to ViAble…'
    await extensionApi()?.runtime?.sendMessage({ type: 'MICROPHONE_PERMISSION_GRANTED' })
    window.setTimeout(() => window.close(), 350)
  } catch (error) {
    button.disabled = false
    statusElement.textContent = errorMessage(error)
  }
}

button?.addEventListener('click', () => void requestMicrophone())
void requestMicrophone()

export {}
