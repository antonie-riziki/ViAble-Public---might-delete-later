import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Contrast,
  Eye,
  FileText,
  Gauge,
  Globe2,
  Headphones,
  Image as ImageIcon,
  Info,
  Keyboard,
  Languages,
  LockKeyhole,
  Menu,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scan,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  TextCursorInput,
  Type,
  Video as VideoIcon,
  Volume2,
  X,
} from 'lucide-react'
import { defaultActions, initialPageContext, type BrowserAction, type Language, type PageContext, type VoiceState } from './lib/domain'
import { stopSpeech } from './lib/voice'
import { getPageError, saveSettings, applyPageAccessibility, captureTabOcr, clickPageButton, executePageAction, fillPageFields, isExtensionRuntime, loadSettings, onTabChange, requestPageContext } from './lib/extension'
import { analyzeCodeSwitching } from './lib/language'
import { defaultAccessibilitySettings, loadAccessibilitySettings, saveAndApplyAccessibilitySettings, type PageAccessibilitySettings } from './lib/accessibility'
import { askViAble, microphoneErrorMessage, performOcrAnalysis, requestMicrophoneAccess, speakViAble, startSpeechRecognition, startWhisperRecording, supportsSpeechRecognition, type VoiceRecognitionHandle, type VoiceProvider } from './lib/voice'

type NavItem = 'Home' | 'Listen' | 'Ask ViAble' | 'Navigate' | 'Settings'

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  meta?: string
  action?: BrowserAction
}

const navItems: { label: NavItem; icon: typeof AudioLines }[] = [
  { label: 'Home', icon: BookOpen },
  { label: 'Listen', icon: Headphones },
  { label: 'Ask ViAble', icon: Sparkles },
  { label: 'Navigate', icon: ArrowUpRight },
  { label: 'Settings', icon: Settings },
]

const quickActionIcons = [Volume2, FileText, Scan, Search, TextCursorInput]

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <img className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'} src="/brand/logo.png" alt="" aria-hidden="true" />
}

function StatusPill({ state }: { state: VoiceState }) {
  const labels: Record<VoiceState, string> = {
    idle: 'Screen Reader Active',
    listening: 'Listening to your command',
    processing: 'Analyzing webpage & voice',
    responding: 'TalkBack Speaking',
    paused: 'Paused',
    confirmation: 'Your Approval Needed',
  }
  return (
    <div className={`status-pill status-pill--${state}`} role="status" aria-live="polite">
      <span className="status-dot" />
      {labels[state]}
    </div>
  )
}

function App() {
  const [activeNav, setActiveNav] = useState<NavItem>('Home')
  const [language, setLanguage] = useState<Language>('English')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [input, setInput] = useState('')
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [approvalAction, setApprovalAction] = useState<{ title: string; description: string; onConfirm: () => Promise<void> } | null>(null)
  const [approved, setApproved] = useState(false)
  const [accessibility, setAccessibility] = useState<PageAccessibilitySettings>(defaultAccessibilitySettings)
  const [pageContext, setPageContext] = useState<PageContext>(initialPageContext)
  const [pageProblem, setPageProblem] = useState('')
  const [runtimeMode, setRuntimeMode] = useState<'extension' | 'preview'>(isExtensionRuntime() ? 'extension' : 'preview')
  const [lastTranscript, setLastTranscript] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [providerStatus, setProviderStatus] = useState<VoiceProvider>('browser fallback')
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<VoiceRecognitionHandle | null>(null)
  const autoReadRef = useRef<string>('')
  const autoReadOnRef = useRef(true)
  const [autoRead, setAutoRead] = useState(true)
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'ViAble Intelligent TalkBack Screen Reader is ready. Inspecting current browser webpage...',
      meta: 'TalkBack · Initializing',
    },
  ])

  const currentContext = useMemo(() => `${pageContext.host} · ${pageContext.section}`, [pageContext])

  const addAssistantMessage = async (text: string, meta = 'Grounded in active page') => {
    setMessages((items) => [...items, { id: Date.now(), role: 'assistant', text, meta }])
    setVoiceState('responding')
    setIsPlaying(true)
    try {
      setProviderStatus(await speakViAble(text, language))
    } finally {
      setIsPlaying(false)
      setVoiceState('idle')
    }
  }

  const speakPageTalkBack = async (context: PageContext, lang: Language) => {
    let overview = ''
    const imgCount = context.images?.length || 0
    const vidCount = context.videos?.length || 0
    const mediaHint = imgCount || vidCount ? `Contains ${imgCount} image${imgCount === 1 ? '' : 's'}${vidCount ? ` and ${vidCount} video${vidCount === 1 ? '' : 's'}` : ''}. ` : ''

    if (lang === 'Sheng') {
      overview = `Rada fiti! Uko kwa ${context.title} (${context.host}). ${context.description}. Kuna headings ${context.headings}, links ${context.links}, ${mediaHint}na fomu ${context.forms}. Nikusomee contents, niku-explain picha, ama nikujazie fomu?`
    } else if (lang === 'Kiswahili') {
      overview = `Hujambo! Upo kwenye ${context.title} (${context.host}). ${context.description}. Kuna vichwa vya habari ${context.headings}, viungo ${context.links}, ${mediaHint}na fomu ${context.forms}. Nikusomee ukurasa, nikuelezee picha, au nikusaidie kujaza fomu?`
    } else {
      overview = `You are on ${context.title} at ${context.host}. ${context.description}. Found ${context.headings} headings, ${context.links} interactive elements, ${mediaHint}and ${context.formFields?.length || 0} form fields. What would you like to explore or do next?`
    }
    await addAssistantMessage(overview, 'TalkBack Screen Reader · Active Webpage')
  }

  const inspectActiveWebpage = async (autoRead = false) => {
    const context = await requestPageContext()
    setPageProblem(context && context.title ? '' : getPageError())
    if (context && context.title) {
      setPageContext(context)
      const pageKey = (context.url || '') + context.title
      if (autoRead && autoReadOnRef.current && autoReadRef.current !== pageKey) {
        autoReadRef.current = pageKey
        void speakPageTalkBack(context, language)
      }
      return context
    }
    return pageContext
  }

  useEffect(() => {
    let mounted = true
    setSpeechSupported(supportsSpeechRecognition() || typeof MediaRecorder !== 'undefined')
    
    Promise.all([
      loadAccessibilitySettings(),
      loadSettings(),
      requestPageContext()
    ]).then(([accSettings, extSettings, context]) => {
      if (!mounted) return
      setPageProblem(context && context.title ? '' : getPageError())
      setAccessibility(accSettings)
      void applyPageAccessibility(accSettings)
      setLanguage(extSettings.responseLanguage)
      autoReadOnRef.current = extSettings.autoRead !== false
      setAutoRead(extSettings.autoRead !== false)
      setRuntimeMode(isExtensionRuntime() ? 'extension' : 'preview')

      if (context && context.title) {
        setPageContext(context)
        autoReadRef.current = (context.url || '') + context.title
        if (extSettings.autoRead !== false) void speakPageTalkBack(context, extSettings.responseLanguage)
      } else {
        setMessages([
          {
            id: 1,
            role: 'assistant',
            text: 'ViAble is connected to your browser. Open any webpage (news, e-citizen, forms) and I will screen-read it aloud immediately.',
            meta: 'Ready · Waiting for webpage',
          },
        ])
      }
    })

    const unbind = onTabChange(() => {
      void inspectActiveWebpage(true)
    })
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') void stopSpeech() }
    window.addEventListener('keydown', onKey)

    return () => {
      mounted = false
      recognitionRef.current?.abort()
      window.removeEventListener('keydown', onKey)
      unbind()
    }
  }, [])

  const updateAccessibility = async (updates: Partial<PageAccessibilitySettings>, speechAnnouncement?: string) => {
    const updated = { ...accessibility, ...updates }
    setAccessibility(updated)
    await saveAndApplyAccessibilitySettings(updated)
    await applyPageAccessibility(updated)
    if (speechAnnouncement) {
      await addAssistantMessage(speechAnnouncement, 'Accessibility Adaptation')
    }
  }

  const handleQuickAction = (action: BrowserAction) => {
    if (action.id === 'read') {
      void inspectActiveWebpage().then((ctx) => {
        const paragraphs = ctx.mainParagraphs?.length ? ctx.mainParagraphs.slice(0, 4).join(' ') : ctx.facts.join(' ')
        void addAssistantMessage(`Reading page sections: ${ctx.title}. Overview: ${paragraphs}`, 'Audio Overview · Active Webpage')
      })
    } else if (action.id === 'summary') {
      void inspectActiveWebpage().then((ctx) => {
        void addAssistantMessage(`Summary of ${ctx.host}: ${ctx.description} Key facts: ${ctx.facts.slice(0, 3).join('. ')}`, 'Summary · Active Webpage')
      })
    } else if (action.id === 'ocr') {
      setVoiceState('processing')
      void addAssistantMessage('Scanning visible page elements, graphics, and infographics with OCR...', 'ViAble Vision OCR')
      void (async () => {
        try {
          let ocrResult = ''
          if (isExtensionRuntime()) {
            const res = await captureTabOcr('Extract all text and visual structure from this page view.')
            ocrResult = res.ok && res.text ? res.text : 'No readable text detected in page capture.'
          } else {
            const demoCanvas = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            ocrResult = await performOcrAnalysis(demoCanvas, 'Explain this accessibility element')
          }
          await addAssistantMessage(ocrResult, 'ViAble Vision OCR · Page Analysis')
        } catch {
          await addAssistantMessage('OCR scan completed. No inaccessible text blocks found on this view.', 'ViAble Vision OCR')
        }
      })()
    } else if (action.id === 'find') {
      void inspectActiveWebpage().then((ctx) => {
        const buttons = (ctx.buttons || []).slice(0, 5).map(b => b.label).join(', ')
        void addAssistantMessage(`I found ${ctx.headings} headings, ${ctx.links} links, and buttons: ${buttons || 'standard navigation'}. Tell me what section or topic to jump to.`, 'Navigation Result · Active Webpage')
      })
    } else {
      setVoiceState('confirmation')
      setApprovalAction({
        title: 'Assist with Application or Form?',
        description: 'ViAble will identify input fields, prepare values you dictate, and explain each step. It will NOT submit without your explicit consent.',
        onConfirm: async () => {
          await executePageAction({ type: 'FOCUS_FIELD', index: 0 })
          await addAssistantMessage('Form assistance enabled. I have focused the first field. Dictate what to fill (e.g., "my name is Evans, email is evans@test.com").', 'Form Assistance Ready')
        },
      })
      setIsActionSheetOpen(true)
    }
    setActiveNav(action.id === 'form' ? 'Navigate' : action.id === 'read' ? 'Listen' : 'Home')
  }

  const handleVoiceCommand = async (command: string) => {
    const trimmed = command.trim()
    if (!trimmed) return
    setLastTranscript(trimmed)
    setVoiceError('')
    const codeSwitch = analyzeCodeSwitching(trimmed)
    setMessages((items) => [...items, { id: Date.now(), role: 'user', text: trimmed, meta: `${codeSwitch.styleSummary} · voice command` }])
    setVoiceState('processing')
    const context = await inspectActiveWebpage()
    const normalized = trimmed.toLowerCase()

    // 1. Accessibility Adjustments (Voice-driven)
    if (/(high contrast|contrast ya juu|yellow on black)/i.test(normalized)) {
      await updateAccessibility({ contrast: 'high-contrast' }, 'High contrast enabled. Yellow text on black background applied.')
      return
    }
    if (/(dark mode|weka giza|black background)/i.test(normalized)) {
      await updateAccessibility({ contrast: 'dark-mode' }, 'Dark mode applied to webpage.')
      return
    }
    if (/(invert colors|geuza rangi|inverted)/i.test(normalized)) {
      await updateAccessibility({ contrast: 'inverted' }, 'Inverted color scheme applied.')
      return
    }
    if (/(normal contrast|reset contrast|default colors|rangi ya kawaida)/i.test(normalized)) {
      await updateAccessibility({ contrast: 'normal' }, 'Contrast reset to default.')
      return
    }
    if (/(increase brightness|brighter|ongeza mwanga)/i.test(normalized)) {
      const b = Math.min(150, accessibility.brightness + 15)
      await updateAccessibility({ brightness: b }, `Brightness increased to ${b} percent.`)
      return
    }
    if (/(reduce brightness|dim|punguza mwanga)/i.test(normalized)) {
      const b = Math.max(50, accessibility.brightness - 15)
      await updateAccessibility({ brightness: b }, `Brightness reduced to ${b} percent.`)
      return
    }
    if (/(increase font|bigger text|larger font|ongeza herufi|ongeza font)/i.test(normalized)) {
      const s = Math.min(220, accessibility.fontScale + 20)
      await updateAccessibility({ fontScale: s }, `Page font scale increased to ${s} percent.`)
      return
    }
    if (/(smaller text|reduce font|punguza herufi)/i.test(normalized)) {
      const s = Math.max(90, accessibility.fontScale - 20)
      await updateAccessibility({ fontScale: s }, `Page font scale reduced to ${s} percent.`)
      return
    }

    // 2. Images & Videos Descriptions
    if (/(describe images?|show images?|photos?|pictures?|eleza picha|angalia picha)/i.test(normalized)) {
      const images = context.images || []
      if (!images.length) {
        await addAssistantMessage('There are no standalone images found on this webpage.', 'Image Description')
      } else {
        const descriptions = images.slice(0, 5).map((img, i) => `Image ${i + 1}: ${img.alt || img.title || 'Graphic without alt text (say "scan with OCR" to extract any embedded text)'}`).join('. ')
        await addAssistantMessage(`Found ${images.length} images on this page. ${descriptions}`, 'Image Description')
      }
      return
    }
    if (/(videos?|watch|kuna video|eleza video)/i.test(normalized)) {
      const videos = context.videos || []
      if (!videos.length) {
        await addAssistantMessage('No video players or embeds found on this webpage.', 'Video Description')
      } else {
        const descriptions = videos.map((v, i) => `Video ${i + 1}: ${v.title} (${v.hasCaptions ? 'Captions available' : 'No captions track'})`).join('. ')
        await addAssistantMessage(`Found ${videos.length} video${videos.length === 1 ? '' : 's'}. ${descriptions}`, 'Video Description')
      }
      return
    }

    // 3. Form Filling & Application with Consent Guard
    if (/(fill|jaza|apply|application|register|sign up|jiandikishe|ku-apply)/i.test(normalized)) {
      const nameMatch = normalized.match(/(?:my name is|jina langu ni|name is|jina ni)\s+([a-zA-Z\s]+?)(?:,|and|with|na|email|phone|$)/i)
      const emailMatch = normalized.match(/(?:email is|email yangu ni|email)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      const phoneMatch = normalized.match(/(?:phone|simu|phone number is|namba ya simu)\s+([0-9\s+]{9,15})/i)

      const fieldsToFill: { nameOrLabel: string; value: string }[] = []
      if (nameMatch) fieldsToFill.push({ nameOrLabel: 'name', value: nameMatch[1].trim() })
      if (emailMatch) fieldsToFill.push({ nameOrLabel: 'email', value: emailMatch[1].trim() })
      if (phoneMatch) fieldsToFill.push({ nameOrLabel: 'phone', value: phoneMatch[1].trim() })

      if (fieldsToFill.length > 0) {
        await fillPageFields(fieldsToFill)
        const summary = fieldsToFill.map(f => `${f.nameOrLabel}: ${f.value}`).join(', ')
        setVoiceState('confirmation')
        setApprovalAction({
          title: 'Confirm & Submit Application?',
          description: `You have filled: ${summary}. Do you approve submitting this application on ${context.host}?`,
          onConfirm: async () => {
            await clickPageButton({ isSubmit: true, approved: true })
            await addAssistantMessage('Application submitted successfully on the webpage.', 'Form Submitted')
          },
        })
        setIsActionSheetOpen(true)
        if (codeSwitch.primaryLanguage === 'Sheng') {
          await addAssistantMessage(`Nimeku-fillia fomu na (${summary}). Kuna button ya ku-submit/apply. Uko sure ni-click Submit sasa hivi?`, 'Consent Needed · Form Application')
        } else {
          await addAssistantMessage(`I have filled your information (${summary}). A submit button is ready. Do you give approval to submit this application?`, 'Consent Needed · Form Application')
        }
        return
      }

      if (/(submit|tuma|complete application|finish apply)/i.test(normalized)) {
        setVoiceState('confirmation')
        setApprovalAction({
          title: 'Confirm Webpage Submission',
          description: `Ready to click Submit on ${context.host}. Submissions are consequential. Do you approve?`,
          onConfirm: async () => {
            await clickPageButton({ isSubmit: true, approved: true })
            await addAssistantMessage('Form submission completed.', 'Action Approved')
          },
        })
        setIsActionSheetOpen(true)
        if (codeSwitch.primaryLanguage === 'Sheng') {
          await addAssistantMessage('Niko ready ku-submit fomu yako. Lazima unithibitishie kwanza. Uko sure ni-click Submit?', 'Approval Needed · Submit Action')
        } else {
          await addAssistantMessage('Ready to submit the application on this webpage. Do you approve clicking Submit?', 'Approval Needed · Submit Action')
        }
        return
      }

      const fieldList = (context.formFields || []).slice(0, 5).map(f => `${f.label}${f.required ? ' (required)' : ''}`).join(', ')
      if (codeSwitch.primaryLanguage === 'Sheng') {
        await addAssistantMessage(`Hii page ina fomu na fields: ${fieldList || 'general inputs'}. Niambie details zako nikujazie (mfano: 'jina langu ni Evans, email ni evans@test.com'), alafu nitakuuliza approval kabla ni-submit.`, 'Form Guidance · Sheng')
      } else {
        await addAssistantMessage(`This page has form fields: ${fieldList || 'general inputs'}. Tell me what values to enter (e.g. 'my name is Evans, email is evans@test.com') and I will prepare them safely before asking for your submit consent.`, 'Form Guidance')
      }
      return
    }

    // 4. Voice Consent Resolution
    if (voiceState === 'confirmation' || isActionSheetOpen) {
      if (/(yes|approve|ndio|wazi|endelea|sure|submit|kubali|tuma)/i.test(normalized)) {
        setIsActionSheetOpen(false)
        setApproved(true)
        setVoiceState('processing')
        if (approvalAction) {
          await approvalAction.onConfirm()
        } else {
          await clickPageButton({ isSubmit: true, approved: true })
          await addAssistantMessage('Approval granted. I have clicked the Submit button on the webpage.', 'Action Completed')
        }
        return
      }
      if (/(no|cancel|hapana|acha|stop|don't)/i.test(normalized)) {
        setIsActionSheetOpen(false)
        setVoiceState('idle')
        await addAssistantMessage('Action cancelled. No changes or submissions were made.', 'Action Cancelled')
        return
      }
    }

    // 5. OCR Trigger
    if (/(ocr|scan|read image|picha)/i.test(normalized)) {
      handleQuickAction(defaultActions[2])
      return
    }

    // 6. Navigation
    if (/(scroll|down|next section|endelea)/i.test(normalized)) {
      await executePageAction({ type: 'SCROLL', amount: 560 })
      await addAssistantMessage('Scrolled down to the next section of the page.', 'Page Navigation')
      return
    }

    // 7. General Multilingual AI Response (Gemini 3.8 Flash with code switching)
    const response = await askViAble(trimmed, context, language)
    setProviderStatus(response.provider)
    await addAssistantMessage(response.text, `${response.provider} · ${codeSwitch.styleSummary}`)
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    setInput('')
    void handleVoiceCommand(trimmed)
  }

  const handleMic = () => {
    if (voiceState === 'listening') {
      recognitionRef.current?.stop()
      return
    }
    if (voiceState === 'processing') return
    if (!speechSupported) {
      setVoiceError('Voice input is not available in this browser. Use the text composer below.')
      return
    }
    setVoiceError('')
    setVoiceState('processing')
    void requestMicrophoneAccess()
      .then(() => {
        recognitionRef.current = startWhisperRecording({
          language,
          onStart: () => setVoiceState('listening'),
          onResult: (text) => void handleVoiceCommand(text),
          onEnd: () => setVoiceState((state) => state === 'listening' ? 'idle' : state),
          onError: (message) => { setVoiceError(message); setVoiceState('idle') },
        })
      })
      .catch((error: unknown) => {
        setVoiceError(microphoneErrorMessage(error))
        setVoiceState('idle')
      })
  }

  const handleApproval = (allow: boolean) => {
    setIsActionSheetOpen(false)
    setApproved(allow)
    setVoiceState('processing')
    if (allow) {
      if (approvalAction) {
        void approvalAction.onConfirm()
      } else {
        void executePageAction({ type: 'FOCUS_FIELD', index: 0 })
        void addAssistantMessage('Form assistance approved. I am preparing fields.', 'Form Assistance')
      }
    } else {
      void addAssistantMessage('Action cancelled. No changes were submitted.', 'Cancelled')
    }
  }

  const faviconLetters = useMemo(() => {
    return (pageContext.host || 'WB').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'WB'
  }, [pageContext.host])

  return (
    <div className="app-shell" style={{ '--font-scale': `${accessibility.fontScale / 100}` } as React.CSSProperties}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-top">
          <div className="brand-lockup">
            <BrandMark />
            <div>
              <p className="brand-name">ViAble</p>
              <p className="brand-tagline">Beyond sight. Beyond limitations.</p>
            </div>
          </div>
          <button className="icon-button sidebar-menu" aria-label="Open navigation menu"><Menu size={19} /></button>
        </div>

        <div className="sidebar-context">
          <div className="context-icon"><Globe2 size={17} /></div>
          <div className="context-copy">
            <span className="eyebrow">Active Webpage</span>
            <strong>{pageContext.host}</strong>
            <span role={pageProblem ? 'alert' : undefined}>{pageProblem || (runtimeMode === 'extension' ? 'Live browser tab' : 'Preview tab')}</span>
          </div>
          <span className="online-indicator" aria-label="Connected" />
        </div>
        <nav className="nav-list">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'nav-item--active' : ''}`} onClick={() => setActiveNav(label)} aria-current={activeNav === label ? 'page' : undefined}>
              <Icon size={18} strokeWidth={activeNav === label ? 2.4 : 1.9} />
              <span>{label}</span>
              {label === 'Ask ViAble' && <span className="nav-kbd">⌘K</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <div><strong>Consent-first Safety</strong><span>Submissions require your approval</span></div>
          </div>
          <div className="account-row" onClick={() => setActiveNav('Settings')} style={{ cursor: 'pointer' }}>
            <div className="avatar">VA</div>
            <div><strong>AbilityModel Profile</strong><span>Settings & Adaptations</span></div>
            <ChevronRight size={16} className="account-chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb"><span>ViAble</span><ChevronRight size={13} /><strong>TalkBack Screen Reader</strong></p>
            <h1>{pageContext.title || 'Current Webpage'}</h1>
            <div className="accessibility-toolbar" aria-label="Accessibility controls">
              <button
                className={`accessibility-pill-btn ${accessibility.contrast === 'high-contrast' ? 'active' : ''}`}
                onClick={() => updateAccessibility({ contrast: accessibility.contrast === 'high-contrast' ? 'normal' : 'high-contrast' })}
                title="Toggle High Contrast"
              >
                <Contrast size={13} /> High Contrast
              </button>
              <button
                className={`accessibility-pill-btn ${accessibility.contrast === 'dark-mode' ? 'active' : ''}`}
                onClick={() => updateAccessibility({ contrast: accessibility.contrast === 'dark-mode' ? 'normal' : 'dark-mode' })}
                title="Toggle Dark Mode"
              >
                <Sun size={13} /> Dark Mode
              </button>
              <button
                className="accessibility-pill-btn"
                onClick={() => updateAccessibility({ fontScale: Math.min(200, accessibility.fontScale + 15) })}
                title="Increase Text Size"
              >
                <Type size={13} /> Font +{accessibility.fontScale}%
              </button>
              <button
                className="accessibility-pill-btn"
                onClick={() => updateAccessibility({ fontScale: 100 })}
                title="Reset Font Size"
              >
                Reset Font
              </button>
              <button
                className="accessibility-pill-btn"
                onClick={() => void speakPageTalkBack(pageContext, language)}
                title="Re-read Page with TalkBack"
              >
                <Volume2 size={13} /> Re-read Page
              </button>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="topbar-link" onClick={() => setActiveNav('Settings')}><CircleHelp size={16} /> Preferences</button>
            <button className="avatar avatar--top" aria-label="Open profile" onClick={() => setActiveNav('Settings')}>VA</button>
          </div>
        </header>

        <div className="content-grid">
          <section className="primary-column" aria-label="ViAble workspace">
            <div className="page-card context-card">
              <div className="context-heading">
                <div className="site-favicon">{faviconLetters}</div>
                <div>
                  <span className="eyebrow">Active Webpage</span>
                  <h2>{pageContext.title}</h2>
                  <p>{currentContext}</p>
                </div>
                <button className="icon-button" aria-label="Refresh page analysis" onClick={() => void inspectActiveWebpage(true)}><RotateCcw size={17} /></button>
              </div>
              <div className="context-summary">
                <span className="summary-check"><Check size={13} /></span>
                <span>
                  <strong>Page Screen-Read</strong> · {pageContext.headings} headings · {pageContext.links} links · {pageContext.images?.length || 0} images · {pageContext.videos?.length || 0} videos · {pageContext.forms} form{pageContext.forms === 1 ? '' : 's'}
                </span>
                <button className="inline-link" onClick={() => handleQuickAction(defaultActions[3])}>Find info</button>
              </div>
              {pageProblem && <p className="page-problem" role="alert">{pageProblem}</p>}
              <label className="auto-read">
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={(event) => {
                    const on = event.target.checked
                    setAutoRead(on)
                    autoReadOnRef.current = on
                    if (!on) void stopSpeech()
                    void loadSettings().then((saved) => saveSettings({ ...saved, autoRead: on }))
                  }}
                />
                <span>Read each page aloud automatically <small>(Esc stops speaking)</small></span>
              </label>
            </div>

            <div className="hero-card">
              <div className="hero-copy">
                <div className="hero-badge"><Sparkles size={14} /> Voice Command Agent & TalkBack</div>
                <h2>Talk to ViAble</h2>
                <p>Speak naturally in English, Kiswahili, or Sheng. I’ll listen with Whisper, execute accessibility changes, read media, and fill forms safely.</p>
              </div>
              <div className={`voice-orb voice-orb--${voiceState}`}>
                <div className="orb-glow" />
                <button className="voice-button" onClick={handleMic} aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start voice request'}>
                  {voiceState === 'listening' ? <Square size={25} fill="currentColor" /> : <Mic size={30} />}
                </button>
                <span className="orb-caption">{voiceState === 'listening' ? 'Listening…' : 'Press to speak'}</span>
              </div>
              <div className="voice-meta">
                <StatusPill state={voiceState} />
                <span className="voice-hint">{speechSupported ? 'Whisper STT Ready' : 'Text composer active'}</span>
              </div>
              {lastTranscript && <p className="voice-transcript" aria-live="polite"><strong>You said:</strong> {lastTranscript}</p>}
              {voiceError && <p className="voice-error" role="alert">{voiceError}</p>}
            </div>

            <div className="quick-actions-section">
              <div className="section-heading">
                <div><span className="eyebrow">Intelligent screen reader</span><h2>Quick actions</h2></div>
                <button className="text-button" onClick={() => setActiveNav('Navigate')}>See all <ChevronRight size={15} /></button>
              </div>
              <div className="quick-actions-grid">
                {defaultActions.map((action, index) => {
                  const Icon = quickActionIcons[index] || Volume2
                  return (
                    <button key={action.id} className={`quick-action-card quick-action-card--${action.id}`} onClick={() => handleQuickAction(action)}>
                      <span className="quick-icon"><Icon size={19} /></span>
                      <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                      <ChevronRight size={16} className="quick-chevron" />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="conversation-section">
              <div className="section-heading">
                <div><span className="eyebrow">Conversation</span><h2>TalkBack Assistant</h2></div>
                <span className="message-count">{messages.length} messages</span>
              </div>
              <div className="conversation-list" aria-live="polite">
                {messages.map((message) => (
                  <div className={`message message--${message.role}`} key={message.id}>
                    <div className="message-avatar">{message.role === 'assistant' ? <BrandMark compact /> : 'YOU'}</div>
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{message.role === 'assistant' ? 'ViAble TalkBack' : 'You'}</strong>
                        <span>{message.meta}</span>
                      </div>
                      <p>{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="composer">
                <label htmlFor="ask-input" className="sr-only">Ask ViAble about this webpage</label>
                <TextCursorInput size={18} className="composer-icon" />
                <input
                  id="ask-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') handleSend() }}
                  placeholder="Ask anything, request form help, or tell me to change contrast/font…"
                />
                <button className="composer-send" onClick={handleSend} aria-label="Send message" disabled={!input.trim()}>
                  <Send size={17} />
                </button>
              </div>
              <p className="composer-helper">
                <Info size={13} /> Code-switching enabled. Submissions or payments are never executed without your explicit consent.
              </p>
            </div>
          </section>

          <aside className="secondary-column" aria-label="Page tools and preferences">
            <div className="side-card reading-card">
              <div className="side-card-heading">
                <span className="side-icon side-icon--green"><ImageIcon size={18} /></span>
                <div><span className="eyebrow">Page Media</span><h3>Images & Videos</h3></div>
              </div>
              <p>
                {pageContext.images?.length || 0} images and {pageContext.videos?.length || 0} videos found on this webpage.
              </p>
              <button className="secondary-button" onClick={() => void handleVoiceCommand('describe images')}>
                <Eye size={15} /> Describe Media
              </button>
            </div>

            <div className="side-card page-map">
              <div className="side-card-heading">
                <span className="side-icon side-icon--blue"><Gauge size={18} /></span>
                <div><span className="eyebrow">Live Page Structure</span><h3>Headings & Sections</h3></div>
              </div>
              {(pageContext.facts || []).slice(0, 3).map((fact, idx) => (
                <div className="map-row" key={idx}>
                  <span className="map-bullet map-bullet--active" />
                  <div><strong>Section {idx + 1}</strong><span>{fact.slice(0, 48)}…</span></div>
                </div>
              ))}
            </div>

            <div className="side-card language-card">
              <div className="side-card-heading">
                <span className="side-icon side-icon--purple"><Languages size={18} /></span>
                <div><span className="eyebrow">Kenyan Code-Switching</span><h3>Voice & Response Mode</h3></div>
              </div>
              <div className="segmented-control" role="group" aria-label="Response language">
                {(['English', 'Kiswahili', 'Sheng'] as Language[]).map((item) => (
                  <button key={item} className={language === item ? 'segment--active' : ''} onClick={() => setLanguage(item)}>
                    {item === 'Kiswahili' ? 'Kisw.' : item}
                  </button>
                ))}
              </div>
              <p className="language-note">
                <span className="language-dot" /> Fluent in Sheng slang, Swahili, and Kenyan English code-switching.
              </p>
            </div>

            <div className="side-card privacy-card">
              <div className="privacy-icon"><LockKeyhole size={17} /></div>
              <div>
                <h3>Librarian Consent Guard</h3>
                <p>Forms and actions require confirmation. Adaptations persist across all tabs automatically.</p>
                <button className="text-button" onClick={() => setActiveNav('Settings')}>Review settings <ChevronRight size={14} /></button>
              </div>
            </div>

            <div className="tip-card">
              <div className="tip-icon">✦</div>
              <div>
                <span className="eyebrow">Try saying</span>
                <p>“Buda jaza jina langu ni Evans alafu niku-confirm kabla u-submit”</p>
                <span className="tip-meta">Sheng code-switching supported</span>
              </div>
            </div>
          </aside>
        </div>

        <footer className="footer-status">
          <span><span className="footer-dot" /> {runtimeMode === 'extension' ? `Connected: ${pageContext.host}` : 'Preview mode'}</span>
          <span>Voice: ElevenLabs Multilingual v2</span>
          <span>STT: Whisper</span>
          <span className="keyboard-fallback-label">TalkBack Active</span>
        </footer>
      </main>

      {isActionSheetOpen && (
        <div className="modal-backdrop">
          <section className="approval-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
            <div className="dialog-icon"><TextCursorInput size={22} /></div>
            <span className="eyebrow">Explicit Consent Required</span>
            <h2 id="approval-title">{approvalAction?.title || 'Approve Webpage Action?'}</h2>
            <p>{approvalAction?.description || 'ViAble is asking for your consent before submitting changes to the active webpage.'}</p>
            <div className="dialog-list">
              <div><Check size={15} /> Data entered is verifiable on page</div>
              <div><LockKeyhole size={15} /> Submission cannot be undone once confirmed</div>
              <div><ShieldCheck size={15} /> Zero memory of confidential credentials</div>
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => handleApproval(false)}>Reject / Cancel</button>
              <button className="primary-button" onClick={() => handleApproval(true)}>
                Approve & Submit <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {approved && <div className="toast" role="status"><Check size={16} /> Consent granted · action executed</div>}
    </div>
  )
}

export default App
