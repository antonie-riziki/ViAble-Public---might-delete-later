import type { Language } from './domain'

const kiswahiliMarkers = [
  'nini', 'kujua', 'hapa', 'naweza', 'mahitaji', 'jinsi', 'tafadhali',
  'maombi', 'mchakato', 'habari', 'fomu', 'kitambulisho', 'kazi', 'ukurasa',
  'kusoma', 'mwanzo', 'mwisho', 'tarehe', 'kufungua', 'kujaza', 'usalama'
]

const shengMarkers = [
  'sasa', 'hii', 'maze', 'safi', 'manze', 'uko aje', 'form', 'hapo',
  'rada', 'niaje', 'buda', 'fiti', 'poa', 'luku', 'mbogi', 'mathree',
  'nganya', 'chwani', 'ashu', 'ku-check', 'ku-apply', 'ku-fill', 'ku-submit',
  'ku-navigate', 'ku-read', 'wazi', 'mambo'
]

export interface CodeSwitchAnalysis {
  primaryLanguage: Language
  isCodeSwitched: boolean
  shengHits: string[]
  swahiliHits: string[]
  codeSwitchScore: number // 0 to 1
  styleSummary: string
}

export function analyzeCodeSwitching(text: string): CodeSwitchAnalysis {
  const normalized = text.toLowerCase()
  const sHits = shengMarkers.filter((m) => normalized.includes(m))
  const kHits = kiswahiliMarkers.filter((m) => normalized.includes(m))
  
  const totalKenyanHits = sHits.length + kHits.length
  const words = normalized.split(/\s+/).filter(Boolean)
  const codeSwitchScore = Math.min(1, words.length ? (totalKenyanHits * 1.5) / Math.max(words.length, 3) : 0)
  
  const isCodeSwitched = (sHits.length > 0 && kHits.length > 0) || (totalKenyanHits > 0 && words.some((w) => ['the', 'this', 'page', 'form', 'to', 'how', 'what', 'check'].includes(w)))
  
  let primaryLanguage: Language = 'English'
  if (sHits.length > kHits.length && sHits.length > 0) primaryLanguage = 'Sheng'
  else if (kHits.length > 0) primaryLanguage = 'Kiswahili'

  const styleSummary = isCodeSwitched
    ? `Code-switched (${primaryLanguage} + Kenyan English blend)`
    : primaryLanguage === 'English'
    ? 'Standard Kenyan English'
    : `${primaryLanguage} dominant`

  return {
    primaryLanguage,
    isCodeSwitched,
    shengHits: sHits,
    swahiliHits: kHits,
    codeSwitchScore,
    styleSummary,
  }
}

export function detectLanguage(text: string): { language: Language; confidence: number } {
  const normalized = text.toLowerCase()
  const kiswahiliHits = kiswahiliMarkers.filter((marker) => normalized.includes(marker)).length
  const shengHits = shengMarkers.filter((marker) => normalized.includes(marker)).length

  if (shengHits > kiswahiliHits && shengHits > 0) return { language: 'Sheng', confidence: 0.74 }
  if (kiswahiliHits > 0) return { language: 'Kiswahili', confidence: 0.86 }
  return { language: 'English', confidence: 0.98 }
}

export function buildResponse(language: Language, prompt: string): string {
  if (language === 'Kiswahili') return `Nimepata swali lako: “${prompt}”. Nitaangalia yaliyomo kwenye ukurasa huu na kueleza hatua inayofuata kwa lugha rahisi.`
  if (language === 'Sheng') return `Nimekupata. Nita-check page hii, nikupatie key points na next step bila kufanya action bila approval yako.`
  return `I’m checking the active page for “${prompt}”. I’ll keep the answer grounded in what is visible here.`
}
