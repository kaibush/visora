import { z } from 'zod'

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_.:@-]+$/)
// This is business-system identity, not a Visora login or a credential.
export const userSchema = z.object({
  id: z
    .union([z.string(), z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)])
    .transform((value) => String(value).trim())
    .pipe(
      z
        .string()
        .min(1)
        .max(128)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), '用户 ID 不能包含控制字符')
    ),
  name: z.string().trim().max(120).nullish(),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.union([z.string().email(), z.literal('')]))
    .nullish(),
})

export const eventSchema = z
  .object({
    eventId: id,
    visitorId: id,
    sessionId: id,
    user: userSchema.nullish(),
    ip: z.ipv4().or(z.ipv6()).optional(),
    interaction: z.object({
      action: z.enum(['click', 'change', 'submit']),
      target: z.string().min(1).max(512),
      label: z.string().max(120).default(''),
    }).optional(),
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
