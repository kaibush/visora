import { z } from 'zod'

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_.:@-]+$/)
export const eventSchema = z
  .object({
    eventId: id,
    visitorId: id,
    sessionId: id,
    type: z.enum(['pageview', 'event']).default('pageview'),
    name: z.string().trim().min(1).max(80).optional(),
    path: z
      .string()
      .min(1)
      .max(2048)
      .refine((s) => s.startsWith('/') && !s.startsWith('//'), 'path 必须是站内路径'),
    referrer: z.string().max(2048).default(''),
    language: z.string().max(32).default(''),
    userAgent: z.string().max(1024).optional(),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((event, ctx) => {
    if (event.type === 'event' && !event.name)
      ctx.addIssue({ code: 'custom', message: '自定义事件必须指定 name', path: ['name'] })
  })

export const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(100) })
