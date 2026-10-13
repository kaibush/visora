import { Op, fn, col, literal } from 'sequelize'
import { createUsersRepository } from './users-repository.mjs'

function eventFilter(filter, type) {
  return {
    occurredAt: { [Op.gte]: filter.start, [Op.lt]: filter.end },
    ...(filter.project === 'all' ? {} : { projectId: filter.project }),
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.ip ? { ip: filter.ip } : {}),
    ...(type ? { type } : {}),
  }
}

const count = (column, alias) => [fn('COUNT', col(column)), alias]
const distinct = (column, alias) => [fn('COUNT', fn('DISTINCT', col(column))), alias]
const pageviewAttributes = () => [count('id', 'pv'), distinct('visitor', 'uv')]
const pageviewNumbers = (row = {}) => ({ pv: Number(row.pv ?? 0), uv: Number(row.uv ?? 0) })

const exploreDimensions = {
  path: 'path',
  referrer: 'referrer',
  browser: 'browser',
  os: 'os',
  device: 'device',
  language: 'language',
  action: 'action',
  name: 'name',
  label: 'label',
  project: 'projectId',
}
const eventDimensions = new Set(['action', 'name', 'label'])

function exploreMetric(dimension, focus) {
  return eventDimensions.has(dimension) || eventDimensions.has(focus) ? 'event' : 'pageview'
}

function timeBucket(model, unit, timezone) {
  const dialect = model.sequelize.getDialect()
  const shanghai = timezone === 'Asia/Shanghai'
  const expression = {
    sqlite:
      unit === 'hour'
        ? `strftime('%H', occurred_at / 1000, 'unixepoch'${shanghai ? ", '+8 hours'" : ''})`
        : `strftime('%Y-%m-%d', occurred_at / 1000, 'unixepoch'${shanghai ? ", '+8 hours'" : ''})`,
    postgres: `to_char(to_timestamp(occurred_at / 1000.0) AT TIME ZONE '${shanghai ? 'Asia/Shanghai' : 'UTC'}', '${unit === 'hour' ? 'HH24' : 'YYYY-MM-DD'}')`,
    mysql: `DATE_FORMAT(DATE_ADD('1970-01-01 00:00:00', INTERVAL (occurred_at / 1000${shanghai ? ' + 28800' : ''}) SECOND), '${unit === 'hour' ? '%H' : '%Y-%m-%d'}')`,
  }[dialect]
  return literal(expression)
}

function exploreWhere(filter, { dimension, value, focus, focusValue } = {}) {
  const where = eventFilter(filter, exploreMetric(dimension, focus))
  const apply = (dim, dimValue, active) => {
    if (!dim || !active) return
    const column = exploreDimensions[dim]
    if (dim === 'project') {
      if (dimValue === undefined) return
      where.projectId = filter.project !== 'all' && dimValue !== filter.project ? '__none__' : dimValue
      return
    }
    if (dim === 'name') where.action = null
    if (dimValue !== undefined) where[column] = dimValue
    else if (dim === 'action' || dim === 'label') {
      where[column] = { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    }
  }
  apply(focus, focusValue, Boolean(focus))
  apply(dimension, value, true)
  return where
}


/** Read model: ORM queries and dialect value conversions stay in this repository. */
export function createAnalyticsRepository({ models }) {
  const { Event, Project } = models
  return {
    users: createUsersRepository(models),
    async counts(filter) {
      const [rows, events] = await Promise.all([
        Event.findAll({
          attributes: [...pageviewAttributes(), distinct('session', 'sessions')],
          where: eventFilter(filter, 'pageview'),
          raw: true,
        }),
        Event.count({ where: eventFilter(filter, 'event') }),
      ])
      return {
        ...pageviewNumbers(rows[0]),
        sessions: Number(rows[0]?.sessions ?? 0),
        events: Number(events),
      }
    },
    async activeVisitors(filter) {
      return Number(
        await Event.count({ where: eventFilter(filter), distinct: true, col: 'visitor' })
      )
    },
    async dailyTrend(filter) {
      const dialect = Event.sequelize.getDialect()
      const bucket = filter.timezone !== 'Asia/Shanghai' ? col('day') : literal({
        sqlite: "strftime('%Y-%m-%d', occurred_at / 1000, 'unixepoch', '+8 hours')",
        postgres: "to_char(to_timestamp(occurred_at / 1000.0) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')",
        mysql: "DATE_FORMAT(DATE_ADD('1970-01-01 00:00:00', INTERVAL (occurred_at / 1000 + 28800) SECOND), '%Y-%m-%d')",
      }[dialect])
      const rows = await Event.findAll({
        attributes: [[bucket, 'dateBucket'], ...pageviewAttributes()],
        where: eventFilter(filter, 'pageview'),
        group: [bucket],
        order: [[bucket, 'ASC']],
        raw: true,
      })
      return rows.map((row) => ({ date: row.dateBucket, ...pageviewNumbers(row) }))
    },
    async dimensions(filter) {
      const entries = await Promise.all(
        ['path', 'referrer', 'browser', 'os', 'device', 'language'].map(async (dimension) => {
          const rows = await Event.findAll({
            attributes: [dimension, ...pageviewAttributes()],
            where: eventFilter(filter, 'pageview'),
            group: [dimension],
            order: [
              [fn('COUNT', col('id')), 'DESC'],
              [dimension, 'ASC'],
            ],
            limit: 10,
            raw: true,
          })
          return [dimension, rows.map((row) => ({ name: row[dimension], ...pageviewNumbers(row) }))]
        })
      )
      return Object.fromEntries(entries)
    },
    async customEvents(filter) {
      const rows = await Event.findAll({
        attributes: ['name', count('id', 'count'), distinct('visitor', 'visitors')],
        where: eventFilter(filter, 'event'),
        group: ['name'],
        order: [
          [fn('COUNT', col('id')), 'DESC'],
          ['name', 'ASC'],
        ],
        limit: 20,
        raw: true,
      })
      return rows.map((row) => ({
        name: row.name,
        count: Number(row.count),
        visitors: Number(row.visitors),
      }))
    },
    async projectPerformance(filter) {
      const [projects, pageviews, activity] = await Promise.all([
        Project.findAll({
          attributes: ['id', 'name', 'enabled'],
          where: filter.project === 'all' ? {} : { id: filter.project },
          raw: true,
        }),
        Event.findAll({
          attributes: ['projectId', ...pageviewAttributes()],
          where: eventFilter(filter, 'pageview'),
          group: [col('project_id')],
          raw: true,
        }),
        Event.findAll({
          attributes: [
            'projectId',
            count('id', 'events'),
            [fn('MAX', col('occurred_at')), 'lastEvent'],
          ],
          where: eventFilter(filter),
          group: [col('project_id')],
          raw: true,
        }),
      ])
      const byProject = new Map(pageviews.map((row) => [row.projectId, row]))
      const activityByProject = new Map(activity.map((row) => [row.projectId, row]))
      return projects
        .map((project) => {
          const stats = activityByProject.get(project.id)
          return {
            id: project.id,
            name: project.name,
            enabled: Number(Boolean(project.enabled)),
            ...pageviewNumbers(byProject.get(project.id)),
            events: Number(stats?.events ?? 0),
            last_event: stats?.lastEvent == null ? null : Number(stats.lastEvent),
          }
        })
        .sort((a, b) => b.pv - a.pv || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    },

    async projectNames() {
      return Project.findAll({ attributes: ['id', 'name'], raw: true })
    },
    async breakdown(filter, dimension, limit, focus, focusValue) {
      const where = exploreWhere(filter, {
        dimension,
        focus,
        focusValue: focus ? focusValue : undefined,
      })
      const column = exploreDimensions[dimension]
      const [rows, total] = await Promise.all([
        Event.findAll({
          attributes: [
            column,
            [fn('COUNT', col('id')), 'count'],
            [fn('COUNT', fn('DISTINCT', col('visitor'))), 'visitors'],
          ],
          where,
          group: [column],
          order: [
            [fn('COUNT', col('id')), 'DESC'],
            [column, 'ASC'],
          ],
          limit,
          raw: true,
        }),
        Event.count({ where }),
      ])
      return {
        total: Number(total),
        rows: rows.map((row) => ({
          key: row[column] == null ? '' : String(row[column]),
          count: Number(row.count),
          visitors: Number(row.visitors),
        })),
      }
    },
    async series(filter, dimension, value) {
      const where = exploreWhere(filter, { dimension, value })
      const bucket = timeBucket(Event, 'day', filter.timezone)
      const rows = await Event.findAll({
        attributes: [
          [bucket, 'date'],
          [fn('COUNT', col('id')), 'count'],
          [fn('COUNT', fn('DISTINCT', col('visitor'))), 'visitors'],
        ],
        where,
        group: [bucket],
        order: [[bucket, 'ASC']],
        raw: true,
      })
      return {
        metric: exploreMetric(dimension),
        rows: rows.map((row) => ({
          date: String(row.date),
          count: Number(row.count),
          visitors: Number(row.visitors),
        })),
      }
    },
    async hourly(filter) {
      const bucket = timeBucket(Event, 'hour', filter.timezone)
      const rows = await Event.findAll({
        attributes: [
          [bucket, 'hour'],
          [fn('COUNT', col('id')), 'count'],
          [fn('COUNT', fn('DISTINCT', col('visitor'))), 'visitors'],
        ],
        where: eventFilter(filter, 'pageview'),
        group: [bucket],
        raw: true,
      })
      return rows.map((row) => ({
        hour: String(row.hour).padStart(2, '0'),
        count: Number(row.count),
        visitors: Number(row.visitors),
      }))
    },
    async visitorSplit(filter) {
      const [rows] = await Event.sequelize.query(
        `SELECT
           COALESCE(SUM(CASE WHEN first_seen >= :start THEN 1 ELSE 0 END), 0) AS newVisitors,
           COALESCE(SUM(CASE WHEN first_seen < :start THEN 1 ELSE 0 END), 0) AS returningVisitors
         FROM (
           SELECT visitor, MIN(occurred_at) AS first_seen
           FROM events
           WHERE type = 'pageview'
             AND (:projectId IS NULL OR project_id = :projectId)
             AND (:userId IS NULL OR user_id = :userId)
             AND (:ip IS NULL OR ip = :ip)
           GROUP BY visitor
           HAVING MAX(CASE WHEN occurred_at >= :start AND occurred_at < :end THEN 1 ELSE 0 END) = 1
         ) AS visitor_first_seen`,
        {
          replacements: {
            start: filter.start,
            end: filter.end,
            projectId: filter.project === 'all' ? null : filter.project,
            userId: filter.userId || null,
            ip: filter.ip || null,
          },
        }
      )
      return {
        newVisitors: Number(rows[0]?.newVisitors ?? 0),
        returningVisitors: Number(rows[0]?.returningVisitors ?? 0),
      }
    },
    async eventRows(filter, limit, offset) {
      const rows = await Event.findAll({
        attributes: [
          'id',
          'eventId',
          'projectId',
          'userId',
          'userName',
          'userEmail',
          'ip', 'action', 'target', 'label', 'visitor', 'session',
          'type',
          'name',
          'occurredAt',
          'path',
          'referrer',
          'browser',
          'os',
          'device',
          'language',
          'source',
        ],
        include: [{ model: Project, as: 'project', attributes: ['name'], required: true }],
        where: eventFilter(filter),
        order: [
          ['occurredAt', 'DESC'],
          ['id', 'DESC'],
        ],
        limit,
        offset,
        raw: true,
      })
      return rows.map((row) => ({
        id: Number(row.id),
        event_id: row.eventId,
        project_id: row.projectId,
        project_name: row['project.name'],
        ip: row.ip ?? null,
        action: row.action ?? null,
        target: row.target ?? null,
        label: row.label ?? null,
        visitor: row.visitor,
        session: row.session,
        user_id: row.userId ?? null,
        user_name: row.userName ?? null,
        user_email: row.userEmail ?? null,
        type: row.type,
        name: row.name,
        occurred_at: Number(row.occurredAt),
        path: row.path,
        referrer: row.referrer,
        browser: row.browser,
        os: row.os,
        device: row.device,
        language: row.language,
        source: row.source,
      }))
    },
    async eventCount(filter) {
      return Number(await Event.count({ where: eventFilter(filter) }))
    },
  }
}
