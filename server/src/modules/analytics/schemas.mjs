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
  const timezone = z.enum(['UTC', 'Asia/Shanghai']).default('UTC').parse(query.timezone)
  const offset = timezone === 'Asia/Shanghai' ? 8 * 3600000 : 0
  const today = new Date(now + offset).toISOString().slice(0, 10)
  const input = z
    .object({
      project: z.string().max(80).default('all'),
      userId: z.string().trim().max(128).default(''),
      from: dateString.default(new Date(now + offset - 6 * day).toISOString().slice(0, 10)),
      to: dateString.default(today),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    })
    .parse(query)
  const start = Date.parse(input.from) - offset
  const end = Date.parse(input.to) - offset + day
  if (end <= start || end - start > 366 * day) {
    throw new AppError('INVALID_INPUT', '日期范围必须在 1–366 天之间')
  }
  return { ...input, start, end, timezone, offset }
}

const exploreDimension = z.enum([
  'path',
  'referrer',
  'browser',
  'os',
  'device',
  'language',
  'action',
  'name',
  'label',
  'project',
])

function rejectMixedEventDrill(dimension, focus) {
  const paired = [dimension, focus].filter(Boolean)
  if (paired.includes('name') && paired.some((item) => item === 'action' || item === 'label')) {
    throw new AppError('INVALID_INPUT', '业务事件不能和自动采集操作混在一起下钻')
  }
}

export function parseDay(query, now) {
  const date = dateString.parse(query.date)
  return parseFilter({ ...query, from: date, to: date }, now)
}

export function parseBreakdown(query, now) {
  const filter = parseFilter(query, now)
  const extra = z
    .object({
      dimension: exploreDimension,
      focus: exploreDimension.optional(),
      focusValue: z.string().max(512).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .parse(query)
  if (extra.focus && extra.focus === extra.dimension) {
    throw new AppError('INVALID_INPUT', '下钻维度不能与当前维度相同')
  }
  if (extra.focus && extra.focusValue === undefined) {
    throw new AppError('INVALID_INPUT', '请指定下钻的取值')
  }
  rejectMixedEventDrill(extra.dimension, extra.focus)
  return { ...filter, ...extra, focusValue: extra.focusValue ?? '' }
}

export function parseSeries(query, now) {
  const filter = parseFilter(query, now)
  const extra = z
    .object({
      dimension: exploreDimension,
      value: z.string().max(512),
    })
    .parse(query)
  return { ...filter, dimension: extra.dimension, value: extra.value }
}
