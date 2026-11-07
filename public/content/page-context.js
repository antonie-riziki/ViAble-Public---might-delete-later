(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim()
  const accessibleName = (element) => {
    const labelledBy = element.getAttribute('aria-labelledby')
    if (labelledBy) {
      const label = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
      if (clean(label)) return clean(label)
    }
    return clean(element.getAttribute('aria-label')) || clean(element.textContent) || clean(element.getAttribute('title'))
  }

  function extract() {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((node) => clean(node.textContent)).filter(Boolean)
    const links = [...document.querySelectorAll('a[href]')].map(accessibleName).filter(Boolean)
    
    const buttons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]')].slice(0, 25).map((btn, index) => {
      const label = accessibleName(btn) || 'Interactive button'
      const isSubmit = btn.type === 'submit' || /submit|apply|register|sign\s*up|pay|order|confirm|send|checkout/i.test(label)
      return { index, label, isSubmit }
    })

    const labels = new Map([...document.querySelectorAll('label[for]')].map((label) => [label.getAttribute('for'), clean(label.textContent)]))
    const formFields = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select')].slice(0, 25).map((field, index) => ({
      index,
      id: field.id || '',
      name: field.name || '',
      type: field.type || 'text',
      label: labels.get(field.id) || accessibleName(field) || clean(field.name) || `Field ${index + 1}`,
      value: field.value || '',
      required: field.required || field.getAttribute('aria-required') === 'true',
      hint: clean(field.placeholder) || clean(field.getAttribute('aria-description')) || clean(field.title) || 'No hint',
    }))

    const images = [...document.querySelectorAll('img, picture img, [role="img"]')].slice(0, 15).map((img, index) => ({
      index,
      alt: clean(img.alt || img.getAttribute('aria-label') || ''),
      src: img.src || img.getAttribute('data-src') || '',
      title: clean(img.title || ''),
      isDecorative: !img.alt && !img.getAttribute('aria-label') && img.getAttribute('role') !== 'img',
    }))

    const videos = [...document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]')].slice(0, 6).map((v, index) => ({
      index,
      title: clean(v.getAttribute('title') || v.getAttribute('aria-label') || 'Video player'),
      src: v.src || v.querySelector('source')?.src || '',
      hasCaptions: Boolean(v.querySelector('track[kind="subtitles"], track[kind="captions"]')),
    }))

    const mainElement = document.querySelector('main, [role="main"], article, #content, .content') || document.body
    const mainParagraphs = [...mainElement.querySelectorAll('p, h1, h2, h3, li')].map((node) => clean(node.textContent)).filter((text) => text.length > 25).slice(0, 15)
    const bodyText = clean(document.body?.innerText).slice(0, 6000)
    const section = clean(document.querySelector('main h1,article h1,h1')?.textContent) || headings[0] || 'Active webpage'
    
    return {
      title: clean(document.title) || section,
      host: location.host || 'active tab',
      url: location.href,
      description: clean(document.querySelector('meta[name="description"]')?.content) || bodyText.slice(0, 180),
      section,
      headings: headings.length,
      links: links.length,
      forms: document.querySelectorAll('form').length,
      facts: mainParagraphs.slice(0, 5).length ? mainParagraphs.slice(0, 5) : [bodyText.slice(0, 240)],
      formFields,
      images,
      videos,
      buttons,
      mainParagraphs,
    }
  }

  const applyAccessibilitySettings = (settings) => {
    let styleEl = document.getElementById('viable-accessibility-styles')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'viable-accessibility-styles'
      const targetParent = document.head || document.documentElement || document.body
      if (targetParent) targetParent.appendChild(styleEl)
    }

    const { contrast, brightness = 100, fontScale = 100, highlightFocus = true } = settings || {}
    let css = ''

    if (contrast === 'high-contrast') {
      css += `
        html, body, div, section, article, main, header, nav, footer, aside, p, span, h1, h2, h3, h4, h5, h6, li, label, td, th {
          background-color: #000000 !important;
          color: #FFFF00 !important;
          border-color: #FFFF00 !important;
        }
        a, a * {
          color: #00FFFF !important;
          text-decoration: underline !important;
        }
        button, input, select, textarea {
          background-color: #1A1A1A !important;
          color: #FFFFFF !important;
          border: 2px solid #FFFF00 !important;
        }
      `
    } else if (contrast === 'inverted') {
      css += `
        html {
          filter: invert(100%) hue-rotate(180deg) !important;
        }
        img, video, canvas {
          filter: invert(100%) hue-rotate(180deg) !important;
        }
      `
    } else if (contrast === 'dark-mode') {
      css += `
        html, body, div, section, article, main, header, nav, footer, aside, form {
          background-color: #121212 !important;
          color: #E0E0E0 !important;
        }
        p, span, li, label, td, th {
          color: #CCCCCC !important;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #FFFFFF !important;
        }
        a, a * {
          color: #64B5F6 !important;
        }
      `
    }

    if (brightness && brightness !== 100) {
      css += `
        html {
          filter: brightness(${brightness}%) !important;
        }
      `
    }

    if (fontScale && fontScale !== 100) {
      css += `
        html, body {
          zoom: ${fontScale / 100} !important;
        }
      `
    }

    if (highlightFocus) {
      css += `
        *:focus, *:focus-visible {
          outline: 4px solid #F59E0B !important;
          outline-offset: 3px !important;
        }
      `
    }

    styleEl.textContent = css
    return { ok: true }
  }

  const focusField = (index) => {
    const fields = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select')]
    const field = fields[index]
    if (!field) return { ok: false, error: 'That form field is no longer available.' }
    field.focus({ preventScroll: false })
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field.style.outline = '4px solid #3B82F6'
    return { ok: true, label: field.getAttribute('aria-label') || field.name || field.id || `field ${index + 1}` }
  }

  const fillFormFields = (fieldsToFill) => {
    const inputs = [...document.querySelectorAll('input:not([type="hidden"]),textarea,select')]
    const filled = []
    const list = Array.isArray(fieldsToFill) ? fieldsToFill : [fieldsToFill]
    
    for (const item of list) {
      let target = null
      if (typeof item.index === 'number') {
        target = inputs[item.index]
      } else if (item.nameOrLabel) {
        const query = item.nameOrLabel.toLowerCase()
        target = inputs.find((el) => {
          const l = (accessibleName(el) || el.name || el.placeholder || el.id || '').toLowerCase()
          return l.includes(query)
        })
      }
      if (target) {
        target.focus()
        target.value = item.value || ''
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
        target.style.outline = '3px solid #10B981'
        filled.push({ field: accessibleName(target) || target.name || 'field', value: item.value })
      }
    }
    return { ok: true, filled }
  }

  const clickButton = ({ text, index, isSubmit, approved }) => {
    if (isSubmit && approved !== true) {
      return { ok: false, requiresApproval: true, error: 'Submitting or applying requires your explicit approval.' }
    }
    const buttons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"], a')]
    let target = null
    if (typeof index === 'number') {
      target = buttons[index]
    } else if (text) {
      const query = text.toLowerCase()
      target = buttons.find((btn) => (accessibleName(btn) || '').toLowerCase().includes(query))
    }
    if (!target) return { ok: false, error: 'Button not found on page.' }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.click()
    return { ok: true, clicked: accessibleName(target) || 'button' }
  }

  const execute = (action) => {
    if (action.type === 'FOCUS_FIELD') return focusField(action.index)
    if (action.type === 'SCROLL') {
      window.scrollBy({ top: action.amount || 540, behavior: 'smooth' })
      return { ok: true }
    }
    if (action.type === 'FILL_FIELD') {
      return fillFormFields([{ index: action.index, nameOrLabel: action.nameOrLabel, value: action.value }])
    }
    if (action.type === 'FILL_FORM_FIELDS') {
      return fillFormFields(action.fields || [])
    }
    if (action.type === 'CLICK_BUTTON') {
      return clickButton(action)
    }
    if (action.type === 'APPLY_ACCESSIBILITY_SETTINGS') {
      return applyAccessibilitySettings(action.settings || {})
    }
    return { ok: false, error: 'Unsupported page action.' }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_PAGE_CONTEXT') sendResponse({ ok: true, context: extract() })
    if (message?.type === 'EXECUTE_PAGE_ACTION') sendResponse(execute(message.action || {}))
    if (message?.type === 'APPLY_ACCESSIBILITY_SETTINGS') sendResponse(applyAccessibilitySettings(message.settings || {}))
    return true
  })
  
  if (chrome?.storage?.local) {
    chrome.storage.local.get(['accessibilitySettings'], (res) => {
      if (res?.accessibilitySettings) {
        applyAccessibilitySettings(res.accessibilitySettings)
      }
    })
  }

  globalThis.__viablePageContextReady = true
})()
