import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  FolderKanban,
  ChartNoAxesCombined,
  MousePointer2,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { api, formatNumber, formatTime, type Ranking, type Report } from './api'
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { EmptyState, ErrorState } from './shared'
import { IconBadge, PanelTitle } from './visuals'

function Change({ value, previous }: { value: number; previous: number }) {
  if (!previous)
    return (
      <span className='text-xs text-muted-foreground'>
        {value ? '新出现' : '暂无'}
      </span>
    )
  const delta = Math.round(((value - previous) / previous) * 100)
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center text-xs ${delta >= 0 ? 'text-success' : 'text-warning'}`}
    >
      <Icon className='size-3.5' />
      {Math.abs(delta)}%
    </span>
  )
}

function RankingList({
  items,
  total,
  emptyLabel = '暂无访问数据',
}: {
  items: Ranking[]
  total: number
  emptyLabel?: string
}) {
  if (!items.length) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        {emptyLabel}
      </p>
    )
  }
  return (
    <div className='flex flex-col gap-1.5'>
      {items.map((row) => (
        <div
          key={row.name}
          className='relative overflow-hidden rounded-md px-2.5 py-2'
        >
          <div
            className='absolute inset-y-0 left-0 rounded-md bg-primary/8'
            style={{
              width: `${total ? Math.max((row.pv / total) * 100, 2) : 0}%`,
            }}
          />
          <div className='relative flex items-center justify-between gap-3 text-sm'>
            <span className='truncate' title={row.name}>
              {row.name || '直接访问'}
            </span>
            <span className='flex shrink-0 items-baseline gap-3 tabular-nums'>
              <span className='font-medium'>{formatNumber(row.pv)}</span>
              <span className='w-8 text-right text-xs text-muted-foreground'>
                {total ? Math.round((row.pv / total) * 100) : 0}%
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OverviewPanel() {
  const { query } = useAnalyticsFilter()
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['visora', 'analytics', query],
    queryFn: () => api<Report>(`/analytics?${query}`),
    refetchInterval: 30000,
  })
  const metrics = data
    ? [
        {
          label: '浏览量',
          unit: 'PV',
          value: data.totals.pv,
          previous: data.previous.pv,
          icon: Eye,
          tone: 'info' as const,
        },
        {
          label: '访客',
          unit: 'UV',
          value: data.totals.uv,
          previous: data.previous.uv,
          icon: Users,
          tone: 'violet' as const,
        },
        {
          label: '会话',
          unit: 'Sessions',
          value: data.totals.sessions,
          previous: data.previous.sessions,
          icon: MousePointer2,
          tone: 'amber' as const,
        },
        {
          label: '实时',
          unit: 'Live',
          value: data.active,
          previous: 0,
          icon: Activity,
          tone: 'teal' as const,
        },
      ]
    : []
  return (
    <div className='flex flex-col gap-3'>
      <AnalyticsFilters refresh={() => void refetch()} fetching={isFetching} />
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && (
        <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className='h-16 rounded-xl' />
          ))}
        </div>
      )}
      {data && (
        <div className='grid gap-3 xl:grid-cols-12'>
          <section className='grid grid-cols-2 gap-2 md:grid-cols-4 xl:col-span-12'>
            {metrics.map((metric) => (
              <Card key={metric.unit} tone={metric.tone} className='gap-3 py-4'>
                <CardHeader className='px-3 pb-0'>
                  <CardTitle className='flex items-center justify-between text-xs font-medium text-muted-foreground'>
                    <span className='inline-flex items-center gap-1.5'>
                      <IconBadge
                        icon={metric.icon}
                        tone={metric.tone}
                        size='sm'
                      />
                      {metric.label}
                    </span>
                    <span className='font-normal'>{metric.unit}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className='flex items-end justify-between gap-2 px-3'>
                  <p className='text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl'>
                    {formatNumber(metric.value)}
                    {metric.unit === 'Live' && (
                      <span className='ml-2 inline-block size-2 rounded-full bg-success align-middle' />
                    )}
                  </p>
                  {metric.unit === 'Live' ? (
                    <span className='pb-1 text-[11px] text-muted-foreground'>
                      5 分钟
                    </span>
                  ) : (
                    <Change value={metric.value} previous={metric.previous} />
                  )}
                </CardContent>
              </Card>
            ))}
          </section>

          {!data.projects.length ? (
            <div className='xl:col-span-12'>
              <EmptyState />
            </div>
          ) : (
            <>
              <Card className='gap-3 py-4 xl:col-span-8'>
                <CardHeader className='flex flex-row items-center justify-between gap-3 px-4'>
                  <CardTitle className='text-sm'>
                    <PanelTitle icon={ChartNoAxesCombined}>访问趋势</PanelTitle>
                  </CardTitle>
                  <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                    <span className='inline-flex items-center gap-1.5'>
                      <i className='size-2 rounded-full bg-chart-1' />
                      PV
                    </span>
                    <span className='inline-flex items-center gap-1.5'>
                      <i className='size-2 rounded-full bg-chart-2' />
                      UV
                    </span>
                    <Link
                      to='/'
                      search={{ view: 'trends' }}
                      className='font-medium text-info'
                    >
                      下钻
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className='px-2 pb-2'>
                  <div
                    className='h-52 w-full min-w-0 sm:h-64'
                    aria-label='每日浏览量和独立访客趋势图'
                  >
                    <ResponsiveContainer width='100%' height='100%'>
                      <AreaChart
                        data={data.trend}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id='visora-pv'
                            x1='0'
                            y1='0'
                            x2='0'
                            y2='1'
                          >
                            <stop
                              offset='0%'
                              stopColor='var(--chart-1)'
                              stopOpacity={0.22}
                            />
                            <stop
                              offset='100%'
                              stopColor='var(--chart-1)'
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey='date'
                          tickFormatter={(value: string) =>
                            value.slice(5).replace('-', '/')
                          }
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fill: 'var(--muted-foreground)',
                            fontSize: 11,
                          }}
                          minTickGap={28}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={32}
                          tick={{
                            fill: 'var(--muted-foreground)',
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'var(--card)',
                            color: 'var(--foreground)',
                            fontSize: 12,
                          }}
                          labelFormatter={(value) =>
                            `${String(value)} · 上海时间`
                          }
                        />
                        <Area
                          isAnimationActive={false}
                          type='monotone'
                          dataKey='pv'
                          name='浏览量 PV'
                          stroke='var(--chart-1)'
                          strokeWidth={2}
                          fill='url(#visora-pv)'
                          dot={data.trend.length === 1}
                        />
                        <Area
                          isAnimationActive={false}
                          type='monotone'
                          dataKey='uv'
                          name='独立访客 UV'
                          stroke='var(--chart-2)'
                          strokeWidth={2}
                          fill='transparent'
                          dot={data.trend.length === 1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className='gap-3 py-4 xl:col-span-4'>
                <CardContent className='px-4'>
                  <Tabs defaultValue='path'>
                    <TabsList className='w-full'>
                      <TabsTrigger value='path' className='min-h-9'>
                        页面
                      </TabsTrigger>
                      <TabsTrigger value='referrer' className='min-h-9'>
                        来源
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value='path'>
                      <RankingList
                        items={data.dimensions.path}
                        total={data.totals.pv}
                      />
                    </TabsContent>
                    <TabsContent value='referrer'>
                      <RankingList
                        items={data.dimensions.referrer}
                        total={data.totals.pv}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className='gap-3 py-4 xl:col-span-7'>
                <CardHeader className='px-4'>
                  <CardTitle className='text-sm'>
                    <PanelTitle icon={FolderKanban} tone='teal'>
                      项目表现
                    </PanelTitle>
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-2 sm:px-4'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>项目</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className='text-right'>PV</TableHead>
                        <TableHead className='text-right'>UV</TableHead>
                        <TableHead className='hidden text-right md:table-cell'>
                          最近访问
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className='max-w-40 truncate font-medium'>
                            {project.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                project.enabled ? 'success' : 'secondary'
                              }
                              className='gap-1.5 font-normal'
                            >
                              <span
                                className={`size-1.5 rounded-full ${project.enabled ? 'bg-success' : 'bg-muted-foreground'}`}
                              />
                              {project.enabled ? '启用' : '暂停'}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {formatNumber(project.pv)}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {formatNumber(project.uv)}
                          </TableCell>
                          <TableCell className='hidden text-right text-xs text-muted-foreground md:table-cell'>
                            {formatTime(project.last_event)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className='gap-3 py-4 xl:col-span-5'>
                <CardContent className='px-4'>
                  <Tabs defaultValue='browser'>
                    <TabsList className='w-full'>
                      <TabsTrigger value='browser'>浏览器</TabsTrigger>
                      <TabsTrigger value='device'>设备</TabsTrigger>
                      <TabsTrigger value='os'>系统</TabsTrigger>
                      <TabsTrigger value='events'>事件</TabsTrigger>
                    </TabsList>
                    {(['browser', 'device', 'os'] as const).map((key) => (
                      <TabsContent key={key} value={key}>
                        <RankingList
                          items={data.dimensions[key]}
                          total={data.totals.pv}
                        />
                      </TabsContent>
                    ))}
                    <TabsContent value='events'>
                      {data.customEvents.length ? (
                        <div className='flex flex-col gap-1.5'>
                          {data.customEvents.map((event) => (
                            <div
                              key={event.name}
                              className='flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm'
                            >
                              <span className='truncate'>{event.name}</span>
                              <span className='shrink-0 text-muted-foreground tabular-nums'>
                                {formatNumber(event.count)} 次 ·{' '}
                                {formatNumber(event.visitors)} 人
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className='flex flex-col items-center gap-2 py-8 text-center'>
                          <p className='text-sm text-muted-foreground'>
                            还没有自定义事件
                          </p>
                          <Button variant='link' asChild>
                            <Link to='/integrations'>查看接入</Link>
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
