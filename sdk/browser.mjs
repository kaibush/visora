// Copy this module into the connected app, e.g. src/lib/visora.js.
// Pass undefined while auth is loading, null for guests, or { id, name?, email? }.
let latestUser
let waitingForTracker = false

function applyUser() {
  waitingForTracker = false
  if (latestUser !== undefined) window.visora?.identify(latestUser)
}

export function syncVisoraUser(user) {
  if (typeof window === 'undefined' || user === undefined) return
  // Keep only the latest snapshot if login changes before the script has loaded.
  latestUser = user === null ? null : { id: user.id, name: user.name, email: user.email }
  if (window.visora) {
    applyUser()
  } else if (!waitingForTracker) {
    waitingForTracker = true
    window.addEventListener('visora:ready', applyUser, { once: true })
  }
}
