/**
 * ViAble Accessibility Profile Port
 *
 * Implements the AbilityModel and Librarian consent architecture inspired by:
 * - AI-for-Accessibility-Toolkit (controller/presentation and Librarian APIs)
 *   https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit
 * - AI-for-Accessibility-Extension
 *   https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Extension
 *
 * This port models user capability preferences directly rather than diagnostic labels,
 * ensuring user dignity, autonomy, and explicit consent for actions and memory.
 */

export type VisionAcuity = 'standard' | 'low-vision' | 'screen-reader'
export type ContrastPreference = 'default' | 'high-contrast' | 'yellow-on-black' | 'inverted'
export type CodeSwitchingPreference = 'adaptive' | 'always-sheng' | 'always-swahili' | 'kenyan-english'
export type SttEngine = 'whisper' | 'browser'
export type TtsEngine = 'elevenlabs' | 'browser'
export type ConsentStorageLevel = 'local-only' | 'session-only' | 'ephemeral'

export interface VisionAbility {
  acuity: VisionAcuity
  contrast: ContrastPreference
  magnification: number // 1.0 to 3.0
  autoOcrInaccessibleImages: boolean
  readerModeDeclutter: boolean
  highlightActiveElement: boolean
}

export interface SpeechAbility {
  sttEngine: SttEngine
  ttsEngine: TtsEngine
  speechRate: number // 0.7 to 1.5
  preferredVoiceId: string
  codeSwitching: CodeSwitchingPreference
  localKenyanAccent: boolean
  readBackActionsBeforeExecution: boolean
}

export interface MotorAbility {
  voiceFirstMode: boolean
  enlargeTouchTargets: boolean
  keyboardShortcutsEnabled: boolean
}

export interface CognitiveAbility {
  plainLanguageSimplification: boolean
  stepByStepFormGuidance: boolean
  readEstimatedTimeToComplete: boolean
}

export interface LibrarianControls {
  consentGranted: boolean
  storageLevel: ConsentStorageLevel
  pausePersonalization: boolean
  requireExplicitApprovalForActions: boolean
  allowPageSummariesInMemory: boolean
}

export interface AbilityModelProfile {
  version: '2.0.0'
  lastUpdated: string
  vision: VisionAbility
  speech: SpeechAbility
  motor: MotorAbility
  cognitive: CognitiveAbility
  librarian: LibrarianControls
}

export const defaultAbilityProfile: AbilityModelProfile = {
  version: '2.0.0',
  lastUpdated: new Date().toISOString(),
  vision: {
    acuity: 'screen-reader',
    contrast: 'default',
    magnification: 1.0,
    autoOcrInaccessibleImages: true,
    readerModeDeclutter: false,
    highlightActiveElement: true,
  },
  speech: {
    sttEngine: 'whisper',
    ttsEngine: 'elevenlabs',
    speechRate: 1.0,
    preferredVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
    codeSwitching: 'adaptive',
    localKenyanAccent: true,
    readBackActionsBeforeExecution: true,
  },
  motor: {
    voiceFirstMode: true,
    enlargeTouchTargets: false,
    keyboardShortcutsEnabled: true,
  },
  cognitive: {
    plainLanguageSimplification: true,
    stepByStepFormGuidance: true,
    readEstimatedTimeToComplete: true,
  },
  librarian: {
    consentGranted: true,
    storageLevel: 'local-only',
    pausePersonalization: false,
    requireExplicitApprovalForActions: true,
    allowPageSummariesInMemory: false,
  },
}
