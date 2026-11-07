(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim()
  const accessibleName = (element) => clean(element.getAttribute('aria-label')) || clean(element.textContent) || clean(element.getAttribute('title'))

  function extract() {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((node) => clean(node.textContent)).filter(Boolean)
    const links = [...document.querySelectorAll('a[href]')].map(accessibleName).filter(Boolean)
    const labels = new Map([...document.querySelectorAll('label[for]')].map((label) => [label.getAttribute('for'), clean(label.textContent)]))
    const formFields = [...document.querySelectorAll('input,textarea,select')].slice(0, 20).map((field, index) => ({
      index,
      label: labels.get(field.id) || accessibleName(field) || clean(field.name) || 'Unlabelled field',
      required: field.required || field.getAttribute('aria-required') === 'true',
      hint: clean(field.placeholder) || clean(field.autocomplete) || 'No additional hint found',
    }))
    const bodyText = clean(document.body?.innerText).slice(0, 6000)
    const facts = [...document.querySelectorAll('main p,main li,article p,article li,p,li')].map((node) => clean(node.textContent)).filter((text) => text.length > 28).slice(0, 5)
    const section = clean(document.querySelector('main h1,article h1,h1')?.textContent) || headings[0] || 'Page content'
    return {
      title: clean(document.title) || section,
      host: location.host || 'active tab',
      description: clean(document.querySelector('meta[name="description"]')?.content) || bodyText.slice(0, 180),
      section,
      headings: headings.length,
      links: links.length,
      forms: document.querySelectorAll('form').length,
      facts: facts.length ? facts : [bodyText.slice(0, 240)],
      formFields,
    }
  }

  const focusField = (index) => {
    const fields = [...document.querySelectorAll('input,textarea,select')]
    const field = fields[index]
    if (!field) return { ok: false, error: 'That form field is no longer available.' }
    field.focus({ preventScroll: false })
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return { ok: true, label: field.getAttribute('aria-label') || field.name || field.id || `field ${index + 1}` }
  }

  const execute = (action) => {
    if (action.type === 'FOCUS_FIELD') return focusField(action.index)
    if (action.type === 'SCROLL') {
      window.scrollBy({ top: action.amount || 540, behavior: 'smooth' })
      return { ok: true }
    }
    if (action.type === 'FILL_FIELD') {
      const fields = [...document.querySelectorAll('input,textarea,select')]
      const field = fields[action.index]
      if (!field) return { ok: false, error: 'That form field is no longer available.' }
      field.focus()
      field.value = action.value || ''
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true }
    }
    return { ok: false, error: 'Unsupported page action.' }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_PAGE_CONTEXT') sendResponse({ ok: true, context: extract() })
    if (message?.type === 'EXECUTE_PAGE_ACTION') sendResponse(execute(message.action || {}))
    return true
  })
  globalThis.__viablePageContextReady = true
})()
