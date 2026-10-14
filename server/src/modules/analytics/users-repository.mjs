import { QueryTypes } from 'sequelize'

export function createUsersRepository({ Event }) {
  return async function users(filter, search, pageSize) {
    const where = [
      'occurred_at >= :start',
      'occurred_at < :end',
      ...(filter.project === 'all' ? [] : ['project_id = :project']),
      ...(filter.userId ? ['user_id = :userId'] : []),
      ...(filter.ip ? ['ip = :ip'] : []),
    ].join(' AND ')
    const replacements = {
      ...filter,
      search: `%${search.replace(/[!%_]/g, (character) => `!${character}`)}%`,
      pageSize,
      offset: (filter.page - 1) * pageSize,
    }
    const select = (sql, extra = {}) =>
      Event.sequelize.query(sql, { replacements: { ...replacements, ...extra }, type: QueryTypes.SELECT })
    const hotIpNameLimit = 3
    const hotIpUsers = async (ips) => {
      if (!ips.length) return []
      const pageviews = [
        'pageviews.occurred_at >= :start',
        'pageviews.occurred_at < :end',
        "pageviews.type = 'pageview'",
        'pageviews.ip IN (:hotIps)',
        "pageviews.visitor <> ''",
        ...(filter.project === 'all' ? [] : ['pageviews.project_id = :project']),
        ...(filter.userId ? ['pageviews.user_id = :userId'] : []),
        ...(filter.ip ? ['pageviews.ip = :ip'] : []),
      ].join(' AND ')
      const identity = [
        'identified.project_id = pageviews.project_id',
        'identified.visitor = pageviews.visitor',
        'identified.occurred_at >= :start',
        'identified.occurred_at < :end',
        'identified.user_id IS NOT NULL',
        "identified.user_id <> ''",
        ...(filter.userId ? ['identified.user_id = :userId'] : []),
      ].join(' AND ')
      return select(
        `SELECT ranked.ip, ranked.project_id, ranked.user_id, ranked.user_name, ranked.project_name, ranked.user_count
         FROM (
           SELECT directory.ip, directory.project_id, directory.user_id, directory.last_seen,
             directory.project_name, directory.user_name,
             ROW_NUMBER() OVER (
               PARTITION BY directory.ip
               ORDER BY directory.last_seen DESC, directory.project_id ASC, directory.user_id ASC
             ) AS row_rank,
             COUNT(*) OVER (PARTITION BY directory.ip) AS user_count
           FROM (
             SELECT grouped.ip, grouped.project_id, grouped.user_id, grouped.last_seen, projects.name AS project_name,
               (SELECT profile.user_name FROM events AS profile
                WHERE profile.project_id = grouped.project_id AND profile.user_id = grouped.user_id
                  AND profile.occurred_at < :end AND profile.user_name IS NOT NULL AND profile.user_name <> ''
                ORDER BY profile.occurred_at DESC, profile.id DESC LIMIT 1) AS user_name
             FROM (
               SELECT pageviews.ip AS ip, identified.project_id AS project_id, identified.user_id AS user_id,
                 MAX(identified.occurred_at) AS last_seen
               FROM events AS pageviews
               JOIN events AS identified ON ${identity}
               WHERE ${pageviews}
               GROUP BY pageviews.ip, identified.project_id, identified.user_id
             ) AS grouped
             JOIN projects ON projects.id = grouped.project_id
           ) AS directory
         ) AS ranked
         WHERE ranked.row_rank <= ${hotIpNameLimit}
         ORDER BY ranked.ip ASC, ranked.row_rank ASC`,
        { hotIps: ips }
      )
    }
    const userGroups = `SELECT project_id, user_id,
      SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pv,
      SUM(CASE WHEN type = 'event' THEN 1 ELSE 0 END) AS event_count,
      COUNT(DISTINCT session) AS sessions, COUNT(DISTINCT ip) AS ip_count,
      MAX(occurred_at) AS last_seen
      FROM events WHERE ${where} AND user_id IS NOT NULL AND user_id <> ''
      GROUP BY project_id, user_id`
    const profiles = `SELECT grouped.*, projects.name AS project_name,
      (SELECT profile.user_name FROM events AS profile
       WHERE profile.project_id = grouped.project_id AND profile.user_id = grouped.user_id
         AND profile.occurred_at < :end AND profile.user_name IS NOT NULL AND profile.user_name <> ''
       ORDER BY profile.occurred_at DESC, profile.id DESC LIMIT 1) AS user_name,
      (SELECT profile.user_email FROM events AS profile
       WHERE profile.project_id = grouped.project_id AND profile.user_id = grouped.user_id
         AND profile.occurred_at < :end AND profile.user_email IS NOT NULL AND profile.user_email <> ''
       ORDER BY profile.occurred_at DESC, profile.id DESC LIMIT 1) AS user_email
      FROM (${userGroups}) AS grouped JOIN projects ON projects.id = grouped.project_id`
    const searchWhere = search
      ? `WHERE user_id LIKE :search ESCAPE '!' OR user_name LIKE :search ESCAPE '!' OR user_email LIKE :search ESCAPE '!'`
      : ''
    const [rows, totals, hotUsers, hotIpRows, summary, usersCount] = await Promise.all([
      select(`SELECT * FROM (${profiles}) AS directory ${searchWhere}
        ORDER BY last_seen DESC, project_id ASC, user_id ASC LIMIT :pageSize OFFSET :offset`),
      select(`SELECT COUNT(*) AS total FROM (${profiles}) AS directory ${searchWhere}`),
      select(`SELECT * FROM (${profiles}) AS directory WHERE pv > 0
        ORDER BY pv DESC, project_id ASC, user_id ASC LIMIT 8`),
      select(`SELECT ip, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS visitors,
        COUNT(DISTINCT project_id) AS projects, MAX(occurred_at) AS last_seen
        FROM events WHERE ${where} AND type = 'pageview' AND ip IS NOT NULL AND ip <> ''
        GROUP BY ip ORDER BY pv DESC, ip ASC LIMIT 8`),
      select(`SELECT COUNT(DISTINCT CASE WHEN type = 'pageview' THEN ip ELSE NULL END) AS ips,
        COALESCE(SUM(CASE WHEN type = 'pageview' AND user_id IS NOT NULL AND user_id <> '' THEN 1 ELSE 0 END), 0) AS identified_pv,
        COALESCE(SUM(CASE WHEN type = 'pageview' AND (user_id IS NULL OR user_id = '') THEN 1 ELSE 0 END), 0) AS anonymous_pv
        FROM events WHERE ${where}`),
      select(`SELECT COUNT(*) AS total FROM (${userGroups}) AS directory`),
    ])
    const presentUser = (row) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      userId: row.user_id,
      name: row.user_name ?? null,
      email: row.user_email ?? null,
      pv: Number(row.pv),
      events: Number(row.event_count),
      sessions: Number(row.sessions),
      ips: Number(row.ip_count),
      lastSeen: Number(row.last_seen),
    })
    const usersByIp = new Map()
    for (const row of await hotIpUsers(hotIpRows.map((row) => row.ip))) {
      const entry = usersByIp.get(row.ip) ?? { count: Number(row.user_count), users: [] }
      entry.users.push({
        projectId: row.project_id,
        projectName: row.project_name,
        userId: row.user_id,
        name: row.user_name ?? null,
      })
      usersByIp.set(row.ip, entry)
    }
    return {
      users: rows.map(presentUser),
      total: Number(totals[0].total),
      hotUsers: hotUsers.map(presentUser),
      hotIps: hotIpRows.map((row) => {
        const identity = usersByIp.get(row.ip)
        return {
          ip: row.ip,
          pv: Number(row.pv),
          visitors: Number(row.visitors),
          projects: Number(row.projects),
          lastSeen: Number(row.last_seen),
          users: identity?.users ?? [],
          userCount: identity?.count ?? 0,
        }
      }),
      summary: {
        users: Number(usersCount[0].total),
        ips: Number(summary[0].ips),
        identifiedPv: Number(summary[0].identified_pv),
        anonymousPv: Number(summary[0].anonymous_pv),
      },
    }
  }
}
