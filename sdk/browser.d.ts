/** Optional declarations for apps loading the Visora browser script. */
export type VisoraUser = {
  id: string | number
  name?: string | null
  email?: string | null
}

/** Syncs the latest login even before tracker.js loads. undefined = loading; null = guest. */
export function syncVisoraUser(user: VisoraUser | null | undefined): void

export interface VisoraTracker {
  disabled: boolean
  pageview(): void
  track(name: string): void
  /** Sets identity; releases data-wait-for-user on valid input. false clears invalid identity. */
  identify(user: VisoraUser | null): boolean
  /** Resolves a guest identity; preserves anonymous visitor/session IDs. */
  reset(): void
}

declare global {
  interface Window {
    visora?: VisoraTracker
  }
}
