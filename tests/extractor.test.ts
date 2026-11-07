import { describe, expect, it } from 'vitest'
import { buildPageContext } from '../src/content/extractor'

describe('semantic page extraction', () => {
  it('normalizes semantic headings, links, and form fields into page context', () => {
    const context = buildPageContext({
      title: 'Registration | ViAble test page',
      host: 'example.test',
      description: 'Complete this form before the application deadline.',
      section: 'Register for support',
      headings: ['Register for support'],
      links: ['Read requirements'],
      forms: 1,
      facts: ['Complete this form before the application deadline.'],
      formFields: [{ label: 'Full name', required: true, hint: 'As shown on ID' }],
    })
    expect(context.title).toBe('Registration | ViAble test page')
    expect(context.headings).toBe(1)
    expect(context.links).toBe(1)
    expect(context.forms).toBe(1)
    expect(context.formFields[0]).toEqual({ label: 'Full name', required: true, hint: 'As shown on ID' })
  })
})
