import { describe, expect, it } from 'vitest'
import { analyzeCodeSwitching, buildResponse, detectLanguage } from '../src/lib/language'

describe('ViAble language seam', () => {
  it('detects Kiswahili markers without translating the input', () => {
    expect(detectLanguage('Nataka kujua jinsi ya kuomba hapa')).toEqual({ language: 'Kiswahili', confidence: 0.86 })
  })

  it('detects Sheng-aware prompts as a separate lane', () => {
    expect(detectLanguage('Maze check hii form hapo')).toEqual({ language: 'Sheng', confidence: 0.74 })
  })

  it('keeps English as the high-confidence default', () => {
    expect(detectLanguage('What is the application deadline?').language).toBe('English')
  })

  it('returns a response in the selected language', () => {
    expect(buildResponse('Kiswahili', 'what do I need?')).toContain('Nimepata swali lako')
    expect(buildResponse('Sheng', 'find the form')).toContain('Nimekupata')
  })

  it('analyzes code-switching across Kenyan English, Kiswahili and Sheng', () => {
    const analysis = analyzeCodeSwitching('Sasa buda, check this page and help me ku-apply for the grant')
    expect(analysis.isCodeSwitched).toBe(true)
    expect(analysis.shengHits).toContain('sasa')
    expect(analysis.shengHits).toContain('buda')
    expect(analysis.shengHits).toContain('ku-apply')
    expect(analysis.styleSummary).toContain('Code-switched')
  })
})
