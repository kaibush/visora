import { z } from 'zod'
import { AppError } from '../../shared/errors.mjs'

const day = 86400000
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const parsed = new Date(s)
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s
  }, '日期无效')

export function parseFilter(query, now) {
  const today = new Date(now).toISOString().slice(0, 10)
  const input = z
    .object({
      project: z.string().max(80).default('all'),
      from: dateString.default(new Date(now - 6 * day).toISOString().slice(0, 10)),
      to: dateString.default(today),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    })
    .parse(query)
  const start = Date.parse(input.from)
  const end = Date.parse(input.to) + day
  if (end <= start || end - start > 366 * day) {
    throw new AppError('INVALID_INPUT', '日期范围必须在 1–366 天之间')
  }
  return { ...input, start, end }
}
