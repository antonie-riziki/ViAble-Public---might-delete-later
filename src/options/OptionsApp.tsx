import { useEffect, useState } from 'react'
import { Check, LockKeyhole, Save, ShieldCheck } from 'lucide-react'
import { defaultSettings, loadSettings, saveSettings, type ExtensionSettings } from '../lib/extension'

export default function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings().then(setSettings)
  }, [])

  const update = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    await saveSettings(settings)
    setSaved(true)
  }

  return (
    <main className="options-shell">
      <header className="options-header">
        <div className="brand-lockup"><img className="options-logo" src="/brand/logo.png" alt="ViAble logo" /><div><strong>ViAble</strong><span>Beyond sight. Beyond limitations.</span></div></div>
        <span className="options-badge"><ShieldCheck size={14} /> Saved on this browser</span>
      </header>
      <section className="options-card">
        <span className="eyebrow">Accessibility preferences</span>
        <h1>Make ViAble work your way</h1>
        <p className="options-intro">These settings are stored locally and can be changed at any time. ViAble complements your screen reader and never disables it.</p>
        <label className="options-field"><span><strong>Response language</strong><small>Language for explanations and audio responses</small></span><select value={settings.responseLanguage} onChange={(event) => update('responseLanguage', event.target.value as ExtensionSettings['responseLanguage'])}><option>English</option><option>Kiswahili</option><option>Sheng</option></select></label>

        <label className="options-field"><span><strong>Speech-to-Text (STT) Engine</strong><small>Whisper provides superior Kenyan accent and code-switching recognition</small></span><select value={settings.sttEngine || 'whisper'} onChange={(event) => update('sttEngine', event.target.value as 'whisper' | 'browser')}><option value="whisper">Whisper STT (Accent & Code-Switching Optimized)</option><option value="browser">Browser Web Speech API</option></select></label>

        <label className="options-field"><span><strong>Voice & Speech (TTS) Modeling</strong><small>ElevenLabs Multilingual v2 with Kenyan accent inflection</small></span><select value={settings.ttsEngine || 'elevenlabs'} onChange={(event) => update('ttsEngine', event.target.value as 'elevenlabs' | 'browser')}><option value="elevenlabs">ElevenLabs Multilingual v2 (Natural Kenyan Accent)</option><option value="browser">Browser Native SpeechSynthesis</option></select></label>

        <label className="options-field"><span><strong>Code-Switching Mode (Kenyan Value Chain)</strong><small>How ViAble blends English, Kiswahili, and Sheng in responses</small></span><select value={settings.codeSwitchingPreference || 'adaptive'} onChange={(event) => update('codeSwitchingPreference', event.target.value as ExtensionSettings['codeSwitchingPreference'])}><option value="adaptive">Adaptive (Mirrors your conversational style)</option><option value="always-sheng">Sheng Priority (Urban Kenyan Colloquial)</option><option value="always-swahili">Kiswahili Priority (Formal & Familiar)</option><option value="kenyan-english">Kenyan English (Technical & Clear)</option></select></label>

        <fieldset><legend>Interaction mode</legend><label className="radio-row"><input type="radio" checked={settings.interactionMode === 'reader-first'} onChange={() => update('interactionMode', 'reader-first')} /><span><strong>Reader-first</strong><small>Keep ordinary screen-reader navigation primary; use ViAble on request.</small></span></label><label className="radio-row"><input type="radio" checked={settings.interactionMode === 'voice'} onChange={() => update('interactionMode', 'voice')} /><span><strong>ViAble Voice</strong><small>Use voice as the quickest way to ask about the active page.</small></span></label><label className="radio-row"><input type="radio" checked={settings.interactionMode === 'task-assistance'} onChange={() => update('interactionMode', 'task-assistance')} /><span><strong>Task assistance</strong><small>Prioritise navigation and user-approved form help.</small></span></label></fieldset>
        <label className="options-field"><span><strong>Reading speed</strong><small>Speech provider control will use this preference.</small></span><input type="range" min="0.75" max="1.5" step="0.05" value={settings.readingSpeed} onChange={(event) => update('readingSpeed', Number(event.target.value))} /></label>
        
        <fieldset><legend>AbilityModel & Vision Assistance</legend>
          <label className="check-row"><input type="checkbox" checked={settings.autoOcrInaccessibleImages ?? true} onChange={(event) => update('autoOcrInaccessibleImages', event.target.checked)} /><span><strong>Multimodal OCR for Inaccessible Elements</strong><small>Automatically extract text from flyers, charts, posters, and canvas elements.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={settings.kenyanAccentTuning ?? true} onChange={(event) => update('kenyanAccentTuning', event.target.checked)} /><span><strong>Kenyan Local Accent Inflection</strong><small>Tune ElevenLabs and Whisper models for regional pronunciation and cadence.</small></span></label>
        </fieldset>

        <fieldset><legend>Librarian & Consent (AI for Accessibility Toolkit)</legend>
          <label className="check-row"><input type="checkbox" checked={settings.requireExplicitApproval ?? true} onChange={(event) => update('requireExplicitApproval', event.target.checked)} /><span><strong>Require explicit approval for browser actions</strong><small>Form inputs and navigation changes are never submitted without your voice/tap confirmation.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={settings.rememberPreferences} onChange={(event) => update('rememberPreferences', event.target.checked)} /><span><strong>Store AbilityModel preferences on this device</strong><small>Zero webpage text is retained as long-term memory.</small></span></label>
        </fieldset>

        <div className="options-privacy"><LockKeyhole size={17} /><span><strong>Your privacy and dignity matter.</strong> ViAble follows the open AI-for-Accessibility Toolkit architecture. Page data is ephemeral and untrusted.</span></div>
        <button className="primary-button options-save" onClick={handleSave}>{saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save preferences</>}</button>
      </section>
    </main>
  )
}
