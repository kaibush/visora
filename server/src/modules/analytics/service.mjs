import { AppError } from '../../shared/errors.mjs'
import { parseFilter } from './schemas.mjs'
import { toCsv } from './csv.mjs'

const day = 86400000
const pageSize = 20
const exportLimit = 10000

export function createAnalyticsService({ repository, projects, clock }) {
  async function filterFor(query) {
    const filter = parseFilter(query, clock())
    if (filter.project !== 'all') await projects.get(filter.project)
    return filter
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
      for (let t = filter.start; t < filter.end; t += day) {
        const date = new Date(t).toISOString().slice(0, 10)
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
        range: { from: filter.from, to: filter.to, timezone: 'UTC' },
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
      return { csv: toCsv(rows), filename: `visora-${filter.from}-${filter.to}.csv` }
    },
  }
}
