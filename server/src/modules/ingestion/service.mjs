import { createHmac } from 'node:crypto'
import { AppError } from '../../shared/errors.mjs'
import { parseAgent } from './user-agent.mjs'
import { eventSchema, batchSchema } from './schemas.mjs'

export function createIngestionService({ repository, projects, salt, clock, retentionDays }) {
  async function write(project, events, source, userAgent = '') {
    const now = clock()
    const identity = (...parts) =>
      createHmac('sha256', salt)
        .update(JSON.stringify([project.id, ...parts]))
        .digest('hex')
    // Normalize and validate the whole batch before the repository starts a transaction.
    const records = events.map((event) => {
      const timestamp = source === 'server' && event.occurredAt ? Date.parse(event.occurredAt) : now
      if (timestamp < now - retentionDays * 86400000 || timestamp > now + 300000) {
        throw new AppError(
          'INVALID_INPUT',
          `事件时间必须在保留期 ${retentionDays} 天内，且不能超过未来 5 分钟`
        )
      }
      let referrer = ''
      try {
        const url = new URL(event.referrer)
        if (['https:', 'http:'].includes(url.protocol)) referrer = url.hostname
      } catch {
        /* Absent or invalid referrer is direct traffic. */
      }
      const agent = parseAgent(source === 'server' ? (event.userAgent ?? '') : userAgent)
      return {
        projectId: project.id,
        eventId: event.eventId,
        type: event.type,
        name: event.type === 'pageview' ? 'pageview' : event.name,
        occurredAt: timestamp,
        receivedAt: now,
        day: new Date(timestamp).toISOString().slice(0, 10),
        visitor: identity(event.visitorId),
        session: identity(event.visitorId, event.sessionId),
        userId: event.user?.id ?? null,
        userName: event.user?.name || null,
        userEmail: event.user?.email || null,
        path: event.path.split(/[?#]/, 1)[0].slice(0, 512).replace(/\/$/, '') || '/',
        referrer,
        ...agent,
        language: event.language,
        source,
      }
    })
    return repository.insertBatch(records)
  }
  return {
    authorizeBrowser: projects.authorizeBrowser,
    async collect({ siteId, origin, payload, userAgent }) {
      const project = await projects.authorizeBrowser(siteId, origin)
      return write(project, [eventSchema.parse(payload)], 'browser', userAgent)
    },
    async ingest({ token, payload }) {
      const project = await projects.authorizeServer(token)
      return write(project, batchSchema.parse(payload).events, 'server')
    },
  }
}
