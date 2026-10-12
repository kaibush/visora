import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

/** Await outside the critical business transaction; enqueue durably if events must not be lost. */
export async function sendEvents({ url, key, events, attempts = 3, timeoutMs = 5000 }) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('attempts must be 1–5')
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be positive')
  if (!key) throw new Error('A Visora server key is required')
  // Serialize once so retries reuse event IDs and cannot duplicate accepted events.
  const records = events.map((event) => ({ ...event, eventId: event.eventId ?? randomUUID() }))
  let accepted = 0
  let duplicates = 0
  for (let offset = 0; offset < records.length; offset += 100) {
    const body = JSON.stringify({ events: records.slice(offset, offset + 100) })
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response
      try {
        response = await fetch(new URL('/api/ingest', url), {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body, signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
        })
      } catch (error) {
        if (attempt === attempts - 1) throw error
        await setTimeout(250 * 2 ** attempt)
        continue
      }
      const result = await response.json().catch(() => ({}))
      if (response.ok) {
        accepted += result.accepted
        duplicates += result.duplicates
        break
      }
      if ((response.status !== 429 && response.status < 500) || attempt === attempts - 1) {
        throw new Error(`Visora ${response.status}: ${result.error ?? 'ingestion failed'}`)
      }
      const retryAfter = Number(response.headers.get('retry-after'))
      await setTimeout(Math.min(60000, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt))
    }
  }
  return { accepted, duplicates }
}
