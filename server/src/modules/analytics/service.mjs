import { AppError } from '../../shared/errors.mjs'
import { parseBreakdown, parseDay, parseFilter, parseSeries } from './schemas.mjs'
import { toCsv } from './csv.mjs'

const day = 86400000
const pageSize = 20
const exportLimit = 10000
const deviceLabels = { Desktop: '桌面', Mobile: '手机', Tablet: '平板', Unknown: '未知' }
const actionLabels = { click: '点击', change: '切换', submit: '提交' }

function fillTrend(filter, rows) {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  const trend = []
  for (let timestamp = filter.start; timestamp < filter.end; timestamp += day) {
    const date = new Date(timestamp + filter.offset).toISOString().slice(0, 10)
    const row = byDate.get(date)
    trend.push({ date, count: row?.count ?? 0, visitors: row?.visitors ?? 0 })
  }
  return trend
}

function labelFor(dimension, key, names) {
  if (dimension === 'project') return names.get(key) || '已删除项目'
  if (dimension === 'referrer') return key || '直接访问'
  if (dimension === 'device') return deviceLabels[key] || key || '未知'
  if (dimension === 'action') return actionLabels[key] || key || '未命名操作'
  if (dimension === 'language' || dimension === 'label') return key || '未知'
  return key || '未知'
}

function present(dimension, result, names) {
  return {
    total: result.total,
    rows: result.rows.map((row) => ({
      ...row,
      name: labelFor(dimension, row.key, names),
    })),
  }
}

export function createAnalyticsService({ repository, projects, clock }) {
  async function filterFor(query) {
    const filter = parseFilter(query, clock())
    if (filter.project !== 'all') await projects.get(filter.project)
    return filter
  }
  async function namesFor() {
    return new Map((await repository.projectNames()).map((project) => [project.id, project.name]))
  }
  return {
    async report(query) {
      const filter = await filterFor(query)
      const now = clock()
      const [totals, previous, active, trendRows, dimensions, customEvents, performance] =
        await Promise.all([
          repository.counts(filter),
          repository.counts({
            ...filter,
            start: filter.start - (filter.end - filter.start),
            end: filter.start,
          }),
          repository.activeVisitors({ ...filter, start: now - 300000, end: now + 1 }),
          repository.dailyTrend(filter),
          repository.dimensions(filter),
          repository.customEvents(filter),
          repository.projectPerformance(filter),
        ])
      const byDate = new Map(trendRows.map((row) => [row.date, row]))
      const trend = []
      for (let timestamp = filter.start; timestamp < filter.end; timestamp += day) {
        const date = new Date(timestamp + filter.offset).toISOString().slice(0, 10)
        trend.push(byDate.get(date) ?? { date, pv: 0, uv: 0 })
      }
      return {
        totals,
        previous,
        active,
        trend,
        dimensions,
        customEvents,
        projects: performance,
        range: { from: filter.from, to: filter.to, timezone: filter.timezone },
      }
    },
    async events(query) {
      const filter = await filterFor(query)
      const [events, total] = await Promise.all([
        repository.eventRows(filter, pageSize, (filter.page - 1) * pageSize),
        repository.eventCount(filter),
      ])
      return { events, total, page: filter.page, pageSize }
    },
    async export(query) {
      const filter = await filterFor(query)
      if ((await repository.eventCount(filter)) > exportLimit)
        throw new AppError('INVALID_INPUT', '单次最多导出 10,000 条，请缩小日期范围或选择单个项目')
      const rows = await repository.eventRows(filter, exportLimit, 0)
      return { csv: toCsv(rows, filter.timezone), filename: `visora-${filter.from}-${filter.to}.csv` }
    },
    async day(query) {
      const filter = await filterFor({ ...query, from: query.date, to: query.date })
      parseDay(query, clock())
      const names = await namesFor()
      const [hours, pages, referrers, devices, projectsRows, actions] = await Promise.all([
        repository.hourly(filter),
        repository.breakdown(filter, 'path', 8),
        repository.breakdown(filter, 'referrer', 8),
        repository.breakdown(filter, 'device', 8),
        repository.breakdown(filter, 'project', 8),
        repository.breakdown(filter, 'action', 8),
      ])
      const byHour = new Map(hours.map((row) => [row.hour, row]))
      return {
        date: filter.from,
        hours: Array.from({ length: 24 }, (_, hour) => {
          const key = String(hour).padStart(2, '0')
          const row = byHour.get(key)
          return { hour: key, count: row?.count ?? 0, visitors: row?.visitors ?? 0 }
        }),
        pages: present('path', pages, names),
        referrers: present('referrer', referrers, names),
        devices: present('device', devices, names),
        projects: present('project', projectsRows, names),
        actions: present('action', actions, names),
      }
    },
    async breakdown(query) {
      const parsed = parseBreakdown(query, clock())
      if (parsed.project !== 'all') await projects.get(parsed.project)
      const names = await namesFor()
      const result = await repository.breakdown(
        parsed,
        parsed.dimension,
        parsed.limit,
        parsed.focus,
        parsed.focusValue
      )
      return {
        dimension: parsed.dimension,
        metric: parsed.dimension === 'action' || parsed.dimension === 'name' || parsed.dimension === 'label' || ['action', 'name', 'label'].includes(parsed.focus) ? 'event' : 'pageview',
        ...present(parsed.dimension, result, names),
      }
    },
    async series(query) {
      const parsed = parseSeries(query, clock())
      if (parsed.project !== 'all') await projects.get(parsed.project)
      const names = await namesFor()
      const result = await repository.series(parsed, parsed.dimension, parsed.value)
      const trend = fillTrend(parsed, result.rows)
      return {
        dimension: parsed.dimension,
        value: parsed.value,
        name: labelFor(parsed.dimension, parsed.value, names),
        metric: result.metric,
        trend,
      }
    },
    async visitors(query) {
      const filter = await filterFor(query)
      return repository.visitorSplit(filter)
    },
  }
}
