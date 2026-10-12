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
        timeZone: 'UTC',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(n)
    : '尚未收到数据'
