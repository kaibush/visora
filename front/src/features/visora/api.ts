export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new ApiError(response.status, data?.error || '请求失败，请稍后重试')
  return data as T
}

export type Project = {
  id: string
  name: string
  siteId: string
  origins: string[]
  enabled: boolean
  keyPrefix: string
  userIdField: string
  userNameField: string
  userEmailField: string
  createdAt: number
  lastEvent: number | null
  totalEvents: number
}
export type Counts = {
  pv: number
  uv: number
  sessions: number
  events: number
}
export type Ranking = { name: string; pv: number; uv: number }
export type Report = {
  totals: Counts
  previous: Counts
  active: number
  trend: { date: string; pv: number; uv: number }[]
  dimensions: Record<
    'path' | 'referrer' | 'browser' | 'os' | 'device' | 'language',
    Ranking[]
  >
  customEvents: { name: string; count: number; visitors: number }[]
  projects: {
    id: string
    name: string
    enabled: number
    pv: number
    uv: number
    events: number
    last_event: number | null
  }[]
  range: { from: string; to: string; timezone: string }
}
export type VisitEvent = {
  id: number
  project_id: string
  project_name: string
  user_id: string | null
  user_name: string | null
  ip: string | null
  action: string | null
  target: string | null
  label: string | null
  visitor: string
  session: string
  user_email: string | null
  type: 'pageview' | 'event'
  name: string
  occurred_at: number
  path: string
  referrer: string
  browser: string
  os: string
  device: string
  language: string
  source: 'browser' | 'server'
}
export type EventPage = {
  events: VisitEvent[]
  total: number
  page: number
  pageSize: number
}
export type TrackedUser = {
  projectId: string
  projectName: string
  userId: string
  name: string | null
  email: string | null
  pv: number
  events: number
  sessions: number
  ips: number
  lastSeen: number
}
export type HotIp = {
  ip: string
  pv: number
  visitors: number
  projects: number
  lastSeen: number
}
export type UserDirectory = {
  users: TrackedUser[]
  total: number
  page: number
  pageSize: number
  hotUsers: TrackedUser[]
  hotIps: HotIp[]
  summary: {
    users: number
    ips: number
    identifiedPv: number
    anonymousPv: number
  }
}
export type ExploreRow = {
  key: string
  name: string
  count: number
  visitors: number
}
export type ExploreGroup = { total: number; rows: ExploreRow[] }
export type ExplorePoint = { date: string; count: number; visitors: number }
export type Breakdown = ExploreGroup & {
  dimension: string
  metric: 'pageview' | 'event'
}
export type Series = {
  dimension: string
  value: string
  name: string
  metric: 'pageview' | 'event'
  trend: ExplorePoint[]
}
export type DayReport = {
  date: string
  hours: { hour: string; count: number; visitors: number }[]
  pages: ExploreGroup
  referrers: ExploreGroup
  devices: ExploreGroup
  projects: ExploreGroup
  actions: ExploreGroup
}
export type VisitorSplit = { newVisitors: number; returningVisitors: number }
export const projectsQuery = {
  queryKey: ['visora', 'projects'],
  queryFn: () => api<{ projects: Project[] }>('/projects'),
  refetchInterval: 30000,
}
export const formatNumber = (n: number) =>
  new Intl.NumberFormat('zh-CN').format(n)
export const formatTime = (n: number | null) =>
  n
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(n)
    : '尚未收到数据'
