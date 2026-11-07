export type Language = 'English' | 'Kiswahili' | 'Sheng'

export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding' | 'paused' | 'confirmation'

export type ActionRisk = 'low' | 'moderate' | 'high'

export type BrowserAction = {
  id: string
  label: string
  detail: string
  risk: ActionRisk
  requiresApproval: boolean
}

export type PageImage = {
  index: number
  alt: string
  src: string
  title?: string
  isDecorative?: boolean
}

export type PageVideo = {
  index: number
  title: string
  src?: string
  hasCaptions?: boolean
}

export type PageButton = {
  index: number
  label: string
  isSubmit?: boolean
}

export type PageFormField = {
  index?: number
  id?: string
  name?: string
  type?: string
  label: string
  value?: string
  required: boolean
  hint: string
}

export type PageContext = {
  title: string
  host: string
  url?: string
  description: string
  section: string
  headings: number
  links: number
  forms: number
  facts: string[]
  formFields: PageFormField[]
  images?: PageImage[]
  videos?: PageVideo[]
  buttons?: PageButton[]
  mainParagraphs?: string[]
}

export const initialPageContext: PageContext = {
  title: 'Current Browser Webpage',
  host: 'active tab',
  url: '',
  description: 'ViAble is connected to the active webpage to screen read and assist you.',
  section: 'Current View',
  headings: 0,
  links: 0,
  forms: 0,
  facts: [],
  formFields: [],
  images: [],
  videos: [],
  buttons: [],
  mainParagraphs: [],
}

export const demoPage: PageContext = initialPageContext

export const defaultActions: BrowserAction[] = [
  { id: 'read', label: 'Read this page', detail: 'Start a natural audio overview of the active page.', risk: 'low', requiresApproval: false },
  { id: 'summary', label: 'Summarise page', detail: 'Hear the key purpose, dates and next steps.', risk: 'low', requiresApproval: false },
  { id: 'ocr', label: 'Scan with OCR', detail: 'Extract text from pictures, infographics, diagrams, or inaccessible canvas.', risk: 'low', requiresApproval: false },
  { id: 'find', label: 'Find information', detail: 'Search headings, links, buttons or page content.', risk: 'low', requiresApproval: false },
  { id: 'form', label: 'Assist with form', detail: 'Explain fields and prepare information without submitting.', risk: 'moderate', requiresApproval: false },
]
