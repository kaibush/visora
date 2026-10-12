/* Visora v1 — public site IDs belong in the browser; server API keys never do. */
;(function () {
  'use strict'
  var script = document.currentScript
  if (
    !script ||
    !script.dataset.site ||
    window.visora ||
    navigator.doNotTrack === '1' ||
    navigator.globalPrivacyControl
  )
    return
  var site = script.dataset.site
  var endpoint = new URL('/api/collect/' + encodeURIComponent(site), script.src).href
  var prefix = 'visora:' + site + ':'
  var lastPath = ''
  var visitor = uuid()
  var session = uuid()
  var lastActivity = 0
  var manual = script.dataset.auto === 'false'
  var hashRouter = script.dataset.hash === 'true'
  var identityReady = script.dataset.waitForUser !== 'true'
  // Identity belongs to the current app login, never to persistent analytics storage.
  var currentUser = null

  function uuid() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) {
      return b.toString(16).padStart(2, '0')
    }).join('')
  }
  function metadata() {
    var now = Date.now()
    try {
      visitor = localStorage.getItem(prefix + 'visitor') || visitor
      localStorage.setItem(prefix + 'visitor', visitor)
      session = sessionStorage.getItem(prefix + 'session') || session
      lastActivity = Number(sessionStorage.getItem(prefix + 'last')) || lastActivity
    } catch (_) {
      /* In-memory fallback for restricted storage. */
    }
    if (lastActivity && now - lastActivity > 30 * 60 * 1000) session = uuid()
    lastActivity = now
    try {
      sessionStorage.setItem(prefix + 'session', session)
      sessionStorage.setItem(prefix + 'last', String(now))
    } catch (_) {
      /* Tracking still works without storage. */
    }
    var referrer = ''
    try {
      referrer = document.referrer ? new URL(document.referrer).origin : ''
    } catch (_) {
      /* Ignore invalid referrers. */
    }
    return {
      eventId: uuid(),
      visitorId: visitor,
      sessionId: session,
      path: currentPath(),
      referrer: referrer,
      language: (navigator.language || '').slice(0, 32),
      user: currentUser ? Object.assign({}, currentUser) : null,
    }
  }
  function currentPath() {
    var path =
      hashRouter && location.hash.indexOf('#/') === 0
        ? location.hash.slice(1).split(/[?#]/)[0]
        : location.pathname
    return path.replace(/\/$/, '') || '/'
  }
  function canSend() {
    return (
      identityReady &&
      navigator.doNotTrack !== '1' &&
      !navigator.globalPrivacyControl &&
      !window.visora.disabled
    )
  }
  function send(event) {
    if (!canSend()) return
    // Cookies/auth headers are never sent. Optional user data comes only from identify().
    fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'text/plain' },
      credentials: 'omit',
      keepalive: true,
    }).catch(function () {})
  }
  function pageview() {
    if (!canSend()) return
    var path = currentPath()
    if (path === lastPath) return
    lastPath = path
    send(Object.assign(metadata(), { type: 'pageview' }))
  }
  function identityResolved() {
    var wasWaiting = !identityReady
    identityReady = true
    if (wasWaiting && !manual) pageview()
  }
  function reset() {
    currentUser = null
    identityResolved()
  }
  function identify(user) {
    // Invalid replacement identities must not leave the previous account attached.
    currentUser = null
    if (user == null) {
      identityResolved()
      return true
    }
    if (typeof user !== 'object' || Array.isArray(user)) return false
    var id = user.id
    if (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) id = String(id)
    if (typeof id !== 'string') return false
    id = id.trim()
    if (!id || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) return false
    var next = { id: id }
    if (user.name != null) {
      if (typeof user.name !== 'string' || user.name.trim().length > 120) return false
      if (user.name.trim()) next.name = user.name.trim()
    }
    if (user.email != null) {
      if (typeof user.email !== 'string' || user.email.trim().length > 254) return false
      var email = user.email.trim()
      // Same email grammar used by the API validator.
      if (
        email &&
        !/^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/.test(
          email
        )
      )
        return false
      if (email) next.email = email
    }
    currentUser = next
    identityResolved()
    return true
  }
  window.visora = {
    disabled: false,
    pageview: pageview,
    identify: identify,
    reset: reset,
    track: function (name) {
      if (!canSend()) return
      if (typeof name !== 'string' || !name.trim() || name.length > 80) return
      send(Object.assign(metadata(), { type: 'event', name: name.trim() }))
    },
  }
  // Delegation covers controls rendered later by React/Vue, including open shadow roots.
  var privateSelector = '[data-visora-ignore],.visora-ignore,[contenteditable]:not([contenteditable="false"]),input[type="password"],input[type="hidden"]'
  var controls = 'button,a[href],summary,input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],select,[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[role="menuitem"],[role="option"],[data-visora-event]'
  var autoWindow = 0
  var autoCount = 0
  function captureInteraction(event) {
    if (!event.isTrusted || !canSend()) return
    var chain = event.composedPath ? event.composedPath() : [event.target]
    if (chain.some(function (node) {
      return node.closest && node.closest(privateSelector)
    })) return
    var selector = event.type === 'submit' ? 'form' : event.type === 'change'
      ? 'select,input[type="checkbox"],input[type="radio"]' : controls
    var element
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].matches && chain[i].matches(selector)) { element = chain[i]; break }
    }
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return
    // Checkbox/radio/select changes have their own event; avoid double counting clicks.
    if (event.type === 'click' && element.matches('select,input[type="checkbox"],input[type="radio"]')) return
    if (element.closest(privateSelector)) return
    var parts = []
    for (var node = element; node && parts.length < 6; node = node.parentElement) {
      var index = 1
      for (var sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.tagName === node.tagName) index++
      }
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + index + ')')
    }
    var target = parts.join(' > ').slice(0, 512)
    // Never read field values, form contents, hrefs, IDs, classes or arbitrary data attributes.
    var label = element.getAttribute('data-visora-event') || element.getAttribute('aria-label') || ''
    if (!label && element.matches('button,a,summary,[role="button"],[role="tab"],[role="menuitem"]') &&
        !element.querySelector('input,textarea,select,' + privateSelector)) label = element.textContent || ''
    label = label.replace(/\s+/g, ' ').trim()
    // Dynamic labels can contain personal data; omit common email/token-like values.
    if (label.length > 120 || /@|https?:|\b\d{7,}\b|[A-Za-z0-9_-]{32,}/.test(label)) label = ''
    var now = Date.now()
    if (now - autoWindow >= 60000) { autoWindow = now; autoCount = 0 }
    if (autoCount >= 60) return
    autoCount++
    send(Object.assign(metadata(), {
      type: 'event',
      name: (event.type + ':' + (label || target)).slice(0, 80),
      interaction: { action: event.type, target: target, label: label },
    }))
  }
  if (!manual && script.dataset.autocapture !== 'false') {
    ;['click', 'change', 'submit'].forEach(function (type) {
      document.addEventListener(type, captureInteraction, true)
    })
  }
  if (!manual) {
    ;['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method]
      history[method] = function () {
        var result = original.apply(this, arguments)
        pageview()
        return result
      }
    })
    addEventListener('popstate', pageview)
    if (hashRouter) addEventListener('hashchange', pageview)
  }
  // Restore identity after route listeners exist, before the initial automatic pageview.
  dispatchEvent(new Event('visora:ready'))
  if (!manual) pageview()
})()
