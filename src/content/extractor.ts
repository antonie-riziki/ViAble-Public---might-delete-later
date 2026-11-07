import type { PageButton, PageContext, PageFormField, PageImage, PageVideo } from '../lib/domain'

function clean(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function accessibleName(element: Element) {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const label = labelledBy.split(/\s+/).map((id) => element.ownerDocument?.getElementById(id)?.textContent ?? '').join(' ')
    if (clean(label)) return clean(label)
  }
  return clean(element.getAttribute('aria-label')) || clean(element.textContent) || clean(element.getAttribute('title'))
}

export type SemanticSnapshot = {
  title: string
  host: string
  url?: string
  description: string
  section: string
  headings: string[]
  links: string[]
  forms: number
  facts: string[]
  formFields: PageFormField[]
  images?: PageImage[]
  videos?: PageVideo[]
  buttons?: PageButton[]
  mainParagraphs?: string[]
}

export function buildPageContext(snapshot: SemanticSnapshot): PageContext {
  return {
    title: snapshot.title,
    host: snapshot.host,
    url: snapshot.url || '',
    description: snapshot.description,
    section: snapshot.section,
    headings: snapshot.headings.length,
    links: snapshot.links.length,
    forms: snapshot.forms,
    facts: snapshot.facts,
    formFields: snapshot.formFields,
    images: snapshot.images || [],
    videos: snapshot.videos || [],
    buttons: snapshot.buttons || [],
    mainParagraphs: snapshot.mainParagraphs || [],
  }
}

export function extractPageContext(documentRoot: Document = document): PageContext {
  const headings = Array.from(documentRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node) => clean(node.textContent)).filter(Boolean)
  const links = Array.from(documentRoot.querySelectorAll('a[href]')).map((node) => accessibleName(node)).filter(Boolean)
  
  const buttons: PageButton[] = Array.from(documentRoot.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]')).slice(0, 25).map((node, index) => {
    const label = accessibleName(node) || 'Interactive Button'
    const isSubmit = (node as HTMLInputElement).type === 'submit' || /submit|apply|register|sign\s*up|pay|order|confirm|send|checkout/i.test(label)
    return { index, label, isSubmit }
  })

  const labels = new Map<string, string>()
  documentRoot.querySelectorAll('label[for]').forEach((label) => {
    const id = label.getAttribute('for')
    if (id) labels.set(id, clean(label.textContent))
  })

  const formFields: PageFormField[] = Array.from(documentRoot.querySelectorAll('input:not([type="hidden"]), textarea, select')).slice(0, 25).map((field, index) => {
    const id = field.getAttribute('id') ?? ''
    const name = labels.get(id) || accessibleName(field) || clean(field.getAttribute('name')) || `Field ${index + 1}`
    const required = field.hasAttribute('required') || field.getAttribute('aria-required') === 'true'
    const type = (field as HTMLInputElement).type || 'text'
    const value = (field as HTMLInputElement).value || ''
    return {
      index,
      id,
      name: field.getAttribute('name') || '',
      type,
      label: name,
      value,
      required,
      hint: clean(field.getAttribute('placeholder')) || clean(field.getAttribute('aria-description')) || clean(field.getAttribute('title')) || 'No additional hint'
    }
  })

  const images: PageImage[] = Array.from(documentRoot.querySelectorAll('img, picture img, [role="img"]')).slice(0, 15).map((img, index) => {
    const htmlImg = img as HTMLImageElement
    const alt = clean(htmlImg.alt || img.getAttribute('aria-label') || '')
    const src = htmlImg.src || img.getAttribute('data-src') || ''
    const title = clean(htmlImg.title || '')
    const isDecorative = !alt && !img.getAttribute('aria-label') && img.getAttribute('role') !== 'img'
    return { index, alt, src, title, isDecorative }
  })

  const videos: PageVideo[] = Array.from(documentRoot.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]')).slice(0, 5).map((v, index) => {
    const title = clean(v.getAttribute('title') || v.getAttribute('aria-label') || 'Video Player')
    const src = (v as HTMLVideoElement).src || v.querySelector('source')?.getAttribute('src') || v.getAttribute('src') || ''
    const hasCaptions = Boolean(v.querySelector('track[kind="subtitles"], track[kind="captions"]'))
    return { index, title, src, hasCaptions }
  })

  const mainElement = documentRoot.querySelector('main, [role="main"], article, #content, .content') || documentRoot.body
  const mainParagraphs = Array.from(mainElement.querySelectorAll('p, h1, h2, h3, li')).map((node) => clean(node.textContent)).filter((t) => t.length > 25).slice(0, 15)
  const bodyText = clean(documentRoot.body?.innerText).slice(0, 6000)
  const facts = mainParagraphs.slice(0, 5)
  const section = clean(documentRoot.querySelector('main h1, article h1, h1')?.textContent) || headings[0] || 'Page content'
  const title = clean(documentRoot.title) || section

  return buildPageContext({
    title,
    host: globalThis.location?.host || 'active tab',
    url: globalThis.location?.href || '',
    description: clean(documentRoot.querySelector('meta[name="description"]')?.getAttribute('content')) || bodyText.slice(0, 180),
    section,
    headings,
    links,
    forms: documentRoot.querySelectorAll('form').length,
    facts: facts.length ? facts : [bodyText.slice(0, 240)],
    formFields,
    images,
    videos,
    buttons,
    mainParagraphs,
  })
}
