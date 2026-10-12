/* Visora v1 — public site IDs belong in the browser; server API keys never do. */
;(function () {
  'use strict'
  var script = document.currentScript
  if (!script || !script.dataset.site || window.visora || navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return
  var site = script.dataset.site
  var endpoint = new URL('/api/collect/' + encodeURIComponent(site), script.src).href
  var prefix = 'visora:' + site + ':'
  var lastPath = ''
  var visitor = uuid()
  var session = uuid()
  var lastActivity = 0
  var manual = script.dataset.auto === 'false'
  var hashRouter = script.dataset.hash === 'true'

  function uuid() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, '0') }).join('')
  }
  function metadata() {
    var now = Date.now()
    try {
      visitor = localStorage.getItem(prefix + 'visitor') || visitor
      localStorage.setItem(prefix + 'visitor', visitor)
      session = sessionStorage.getItem(prefix + 'session') || session
      lastActivity = Number(sessionStorage.getItem(prefix + 'last')) || lastActivity
    } catch (_) { /* In-memory fallback for restricted storage. */ }
    if (lastActivity && now - lastActivity > 30 * 60 * 1000) session = uuid()
    lastActivity = now
    try {
      sessionStorage.setItem(prefix + 'session', session)
      sessionStorage.setItem(prefix + 'last', String(now))
    } catch (_) { /* Tracking still works without storage. */ }
    var referrer = ''
    try { referrer = document.referrer ? new URL(document.referrer).origin : '' } catch (_) { /* Ignore invalid referrers. */ }
    return { eventId: uuid(), visitorId: visitor, sessionId: session, path: currentPath(), referrer: referrer, language: (navigator.language || '').slice(0, 32) }
  }
  function currentPath() {
    var path = hashRouter && location.hash.indexOf('#/') === 0 ? location.hash.slice(1).split(/[?#]/)[0] : location.pathname
    return path.replace(/\/$/, '') || '/'
  }
  function send(event) {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl || window.visora.disabled) return
    var body = JSON.stringify(event)
    // No cookies, auth headers, query strings, fragments or full referrer URLs.
    fetch(endpoint, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, credentials: 'omit', keepalive: true }).catch(function () {})
  }
  function pageview() {
    var path = currentPath()
    if (path === lastPath) return
    lastPath = path
    send(Object.assign(metadata(), { type: 'pageview' }))
  }
  window.visora = {
    disabled: false,
    pageview: pageview,
    track: function (name) {
      if (typeof name !== 'string' || !name.trim() || name.length > 80) return
      send(Object.assign(metadata(), { type: 'event', name: name.trim() }))
    }
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
    pageview()
  }
})()
