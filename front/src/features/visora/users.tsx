import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Search,
  UserRound,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  api,
  formatNumber,
  formatTime,
  type HotIp,
  type TrackedUser,
  type UserDirectory,
} from './api'
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { EmptyState, ErrorState, VisoraPage } from './shared'
import { IconBadge, PanelTitle } from './visuals'

type RankItem = {
  key: string
  label: string
  description: string
  detail?: string
  value: number
  open: () => void
}

function hotIpDetail(ip: HotIp) {
  const labels = ip.users.map((user) => user.name || user.userId)
  const duplicated = new Set(labels).size !== labels.length
  const shown = ip.users.map((user) => {
    const name = user.name || user.userId
    return duplicated ? `${name}（${user.projectName}）` : name
  })
  if (!shown.length) return ''
  return ip.userCount > shown.length
    ? `${shown.join('、')} 等 ${formatNumber(ip.userCount)} 人`
    : shown.join('、')
}

function RankingChart({
  items,
  tone,
}: {
  items: RankItem[]
  tone: 'violet' | 'info'
}) {
  const maximum = Math.max(...items.map((item) => item.value), 1)
  return items.length ? (
    <ol
      className='flex flex-col gap-2'
      aria-label='按页面浏览量排序的横向柱状图'
    >
      {items.map((item, index) => (
        <li key={item.key}>
          <button
            type='button'
            className='group flex min-h-14 w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            onClick={item.open}
            aria-label={
              item.detail
                ? `${item.label}，${item.value} 次浏览，查看明细，${item.detail}`
                : `${item.label}，${item.value} 次浏览，查看明细`
            }
          >
            <span className='w-4 shrink-0 text-center text-xs text-muted-foreground tabular-nums'>
              {index + 1}
            </span>
            <div className='flex min-w-0 flex-1 flex-col gap-1'>
              <div className='flex items-center justify-between gap-3'>
                <span
                  className='truncate text-sm font-medium'
                  title={item.label}
                >
                  {item.label}
                </span>
                <span className='shrink-0 text-sm font-semibold tabular-nums'>
                  {formatNumber(item.value)}{' '}
                  <span className='text-xs font-normal text-muted-foreground'>
                    PV
                  </span>
                </span>
              </div>
              <div
                className='h-1.5 overflow-hidden rounded-full bg-muted'
                aria-hidden='true'
              >
                <div
                  className={
                    tone === 'violet'
                      ? 'h-full rounded-full bg-violet/70'
                      : 'h-full rounded-full bg-info/70'
                  }
                  style={{ width: `${(item.value / maximum) * 100}%` }}
                />
              </div>
              <span
                className='truncate text-xs'
                title={
                  item.detail
                    ? `${item.detail} · ${item.description}`
                    : item.description
                }
              >
                {item.detail ? (
                  <>
                    <span className='font-medium text-foreground'>
                      {item.detail}
                    </span>
                    <span className='text-muted-foreground'>
                      {' · '}
                      {item.description}
                    </span>
                  </>
                ) : (
                  <span className='text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </span>
            </div>
            <ArrowUpRight className='size-3.5 shrink-0 text-muted-foreground' />
          </button>
        </li>
      ))}
    </ol>
  ) : (
    <p className='flex min-h-36 items-center justify-center text-sm text-muted-foreground'>
      当前范围暂无浏览记录
    </p>
  )
}

function UserIdentity({ user }: { user: TrackedUser }) {
  return (
    <div className='flex min-w-0 items-center gap-2.5'>
      <IconBadge icon={UserRound} tone='violet' size='sm' />
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='truncate font-medium' title={user.name || user.userId}>
          {user.name || '未提供名称'}
        </span>
        <span
          className='truncate text-xs text-muted-foreground'
          title={user.userId}
        >
          ID：{user.userId}
        </span>
        {user.email && (
          <span
            className='truncate text-xs text-muted-foreground'
            title={user.email}
          >
            {user.email}
          </span>
        )}
      </div>
    </div>
  )
}

export function VisoraUsers() {
  const { filter, setFilter, query } = useAnalyticsFilter()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const scope = `${query}&search=${encodeURIComponent(search)}`
  const [pagination, setPagination] = useState({ scope, page: 1 })
  if (pagination.scope !== scope) setPagination({ scope, page: 1 })
  const page = pagination.scope === scope ? pagination.page : 1
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['visora', 'users', scope, page],
    queryFn: () => api<UserDirectory>(`/users?${scope}&page=${page}`),
    refetchInterval: 30000,
  })
  function openUser(user: TrackedUser) {
    setFilter({ ...filter, project: user.projectId, userId: user.userId })
    void navigate({ to: '/events' })
  }
  function openIp(ip: string) {
    setFilter({ ...filter, userId: '', ip })
    void navigate({ to: '/events' })
  }
  const metrics = data
    ? [
        {
          label: '活跃用户',
          value: data.summary.users,
          hint: '已上报身份 · 按项目隔离',
          icon: Users,
          tone: 'violet' as const,
        },
        {
          label: '访问 IP',
          value: data.summary.ips,
          hint: '产生页面浏览的 IP',
          icon: Globe2,
          tone: 'info' as const,
        },
        {
          label: '已识别浏览',
          value: data.summary.identifiedPv,
          hint: '携带用户身份的 PV',
          icon: UserRound,
          tone: 'teal' as const,
        },
        {
          label: '匿名浏览',
          value: data.summary.anonymousPv,
          hint: '未上报身份的 PV',
          icon: Eye,
          tone: 'amber' as const,
        },
      ]
    : []
  const userRanks =
    data?.hotUsers.map((user) => ({
      key: `${user.projectId}:${user.userId}`,
      label: user.name || user.userId,
      description: `${user.projectName} · ID ${user.userId}`,
      value: user.pv,
      open: () => openUser(user),
    })) ?? []
  const ipRanks =
    data?.hotIps.map((ip) => ({
      key: ip.ip,
      label: ip.ip,
      detail: hotIpDetail(ip) || undefined,
      description: `${formatNumber(ip.visitors)} 位访客 · ${formatNumber(ip.projects)} 个项目`,
      value: ip.pv,
      open: () => openIp(ip.ip),
    })) ?? []
  const charts = [
    {
      key: 'users',
      title: '热门用户',
      description: 'Top 8 · 已识别用户的页面浏览量',
      icon: Users,
      tone: 'violet' as const,
      items: userRanks,
    },
    {
      key: 'ips',
      title: '热门 IP',
      description: 'Top 8 · 包含匿名访问的页面浏览量',
      icon: Globe2,
      tone: 'info' as const,
      items: ipRanks,
    },
  ]
  return (
    <VisoraPage
      title='用户列表'
      toolbar={
        <AnalyticsFilters
          refresh={() => void refetch()}
          fetching={isFetching}
        />
      }
    >
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && (
        <>
          <Skeleton className='h-24 rounded-xl' />
          <Skeleton className='h-80 rounded-xl' />
        </>
      )}
      {data && (
        <>
          <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
            {metrics.map((metric) => (
              <Card key={metric.label} className='gap-0 py-0'>
                <CardContent className='flex items-center justify-between gap-2 p-3 sm:p-4'>
                  <div className='flex min-w-0 flex-col gap-1'>
                    <span className='text-xs text-muted-foreground'>
                      {metric.label}
                    </span>
                    <span className='text-2xl font-semibold tracking-tight tabular-nums'>
                      {formatNumber(metric.value)}
                    </span>
                    <span className='truncate text-[11px] text-muted-foreground'>
                      {metric.hint}
                    </span>
                  </div>
                  <IconBadge icon={metric.icon} tone={metric.tone} size='sm' />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className='hidden grid-cols-2 gap-4 md:grid'>
            {charts.map((chart) => (
              <Card key={chart.key} className='gap-3'>
                <CardHeader>
                  <CardTitle>
                    <PanelTitle icon={chart.icon} tone={chart.tone}>
                      {chart.title}
                    </PanelTitle>
                  </CardTitle>
                  <CardDescription>
                    {chart.description} · 点击查看明细
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankingChart items={chart.items} tone={chart.tone} />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className='gap-3 md:hidden'>
            <CardHeader>
              <CardTitle>访问排行</CardTitle>
              <CardDescription>
                Top 8 · 按 PV 排序，点击查看明细
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue='users'>
                <TabsList className='mb-3 grid w-full grid-cols-2'>
                  <TabsTrigger value='users'>热门用户</TabsTrigger>
                  <TabsTrigger value='ips'>热门 IP</TabsTrigger>
                </TabsList>
                {charts.map((chart) => (
                  <TabsContent key={chart.key} value={chart.key}>
                    <RankingChart items={chart.items} tone={chart.tone} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
          <Card className='gap-3'>
            <CardHeader className='flex flex-wrap items-center justify-between gap-3 sm:flex-row'>
              <div className='flex flex-col gap-1'>
                <CardTitle>
                  <PanelTitle icon={Users} tone='violet'>
                    用户记录{' '}
                    <Badge variant='secondary'>
                      {formatNumber(data.total)}
                    </Badge>
                  </PanelTitle>
                </CardTitle>
                <CardDescription>
                  选定日期内活跃的业务用户，不是 Visora 管理员账号
                </CardDescription>
              </div>
              <form
                className='flex w-full gap-2 sm:w-auto'
                onSubmit={(event) => {
                  event.preventDefault()
                  setSearch(draft.trim())
                }}
              >
                <Input
                  aria-label='搜索用户'
                  placeholder='ID、名称或邮箱'
                  maxLength={120}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className='min-w-0 sm:w-56'
                />
                <Button
                  type='submit'
                  variant='outline'
                  size='icon'
                  aria-label='提交用户搜索'
                >
                  <Search className='size-4' />
                </Button>
                {search && (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={() => {
                      setDraft('')
                      setSearch('')
                    }}
                  >
                    清除
                  </Button>
                )}
              </form>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              {!data.total ? (
                <EmptyState
                  title={search ? '未找到匹配的用户' : '当前范围暂无已识别用户'}
                  description='可调整项目或日期；业务系统需通过 identify 或服务端 user 字段上报用户 ID、名称和邮箱。匿名访问仍计入热门 IP。'
                  link={false}
                />
              ) : (
                <>
                  <div className='hidden md:block'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户</TableHead>
                          <TableHead>所属项目</TableHead>
                          <TableHead className='text-right'>
                            浏览 / PV
                          </TableHead>
                          <TableHead className='text-right'>事件</TableHead>
                          <TableHead className='text-right'>
                            会话 / IP
                          </TableHead>
                          <TableHead>最近访问</TableHead>
                          <TableHead className='text-right'>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.users.map((user) => (
                          <TableRow key={`${user.projectId}:${user.userId}`}>
                            <TableCell className='max-w-72'>
                              <UserIdentity user={user} />
                            </TableCell>
                            <TableCell className='max-w-40'>
                              <span
                                className='block truncate'
                                title={user.projectName}
                              >
                                {user.projectName}
                              </span>
                            </TableCell>
                            <TableCell className='text-right tabular-nums'>
                              {formatNumber(user.pv)}
                            </TableCell>
                            <TableCell className='text-right tabular-nums'>
                              {formatNumber(user.events)}
                            </TableCell>
                            <TableCell className='text-right tabular-nums'>
                              {formatNumber(user.sessions)} /{' '}
                              {formatNumber(user.ips)}
                            </TableCell>
                            <TableCell className='text-xs whitespace-nowrap text-muted-foreground'>
                              {formatTime(user.lastSeen)}
                            </TableCell>
                            <TableCell className='text-right'>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => openUser(user)}
                              >
                                明细
                                <ArrowUpRight className='size-3.5' />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className='flex flex-col divide-y md:hidden'>
                    {data.users.map((user) => (
                      <button
                        key={`${user.projectId}:${user.userId}`}
                        type='button'
                        className='flex min-w-0 flex-col gap-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                        onClick={() => openUser(user)}
                      >
                        <div className='flex min-w-0 items-center justify-between gap-3'>
                          <UserIdentity user={user} />
                          <ArrowUpRight className='size-4 shrink-0 text-muted-foreground' />
                        </div>
                        <div className='flex min-w-0 items-center justify-between gap-2 text-xs'>
                          <span className='truncate text-muted-foreground'>
                            {user.projectName}
                          </span>
                          <span className='shrink-0 tabular-nums'>
                            {formatNumber(user.pv)} PV ·{' '}
                            {formatNumber(user.events)} 事件
                          </span>
                        </div>
                        <span className='text-xs text-muted-foreground'>
                          最近访问 {formatTime(user.lastSeen)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className='flex flex-wrap items-center justify-between gap-2 border-t pt-3'>
                    <span className='text-xs text-muted-foreground'>
                      第 {page} /{' '}
                      {Math.max(1, Math.ceil(data.total / data.pageSize))} 页 ·
                      每页 {data.pageSize} 条
                    </span>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={page === 1 || isFetching}
                        onClick={() => setPagination({ scope, page: page - 1 })}
                        aria-label='上一页用户'
                      >
                        <ChevronLeft className='size-4' />
                        上一页
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={
                          page * data.pageSize >= data.total || isFetching
                        }
                        onClick={() => setPagination({ scope, page: page + 1 })}
                        aria-label='下一页用户'
                      >
                        下一页
                        <ChevronRight className='size-4' />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <p className='px-1 text-xs leading-5 text-muted-foreground'>
            用户名称、邮箱展示截至所选结束日期最近一次非空上报；同 ID
            跨项目不合并。IP 可能由多人共享，不等同于个人身份；未采集 IP
            的浏览不进入 IP 排行。列表搜索不影响上方排行。
          </p>
        </>
      )}
    </VisoraPage>
  )
}
