import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Layers,
  MousePointer2,
  Plus,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { EmptyState, ErrorState, VisoraPage } from './shared'

function Change({ value, previous }: { value: number; previous: number }) {
  if (!previous)
    return (
      <span className='text-xs text-muted-foreground'>
        {value ? '上一周期暂无数据' : '等待访问数据'}
      </span>
    )
  const delta = Math.round(((value - previous) / previous) * 100)
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className='flex items-center gap-1 text-xs'>
      <span
        className={`flex items-center ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
      >
        <Icon className='size-3.5' />
        {Math.abs(delta)}%
      </span>
      <span className='text-muted-foreground'>较上一等长周期</span>
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
  return (
    <div className='space-y-3'>
      {items.length ? (
        items.map((row) => (
          <div
            key={row.name}
            className='relative overflow-hidden rounded-md px-3 py-2.5'
          >
            <div
              className='absolute inset-y-0 left-0 rounded-md bg-primary/6'
              style={{
                width: `${total ? Math.max((row.pv / total) * 100, 2) : 0}%`,
              }}
            />
            <div className='relative flex items-center justify-between gap-4 text-sm'>
              <span className='truncate' title={row.name}>
                {row.name || '直接访问'}
              </span>
              <span className='flex shrink-0 gap-5 tabular-nums'>
                <span className='font-medium'>{formatNumber(row.pv)}</span>
                <span className='w-10 text-right text-xs text-muted-foreground'>
                  {total ? Math.round((row.pv / total) * 100) : 0}%
                </span>
              </span>
            </div>
          </div>
        ))
      ) : (
        <p className='py-12 text-center text-sm text-muted-foreground'>
          {emptyLabel}
        </p>
      )}
    </div>
  )
}

export function VisoraOverview() {
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
        },
        {
          label: '独立访客',
          unit: 'UV',
          value: data.totals.uv,
          previous: data.previous.uv,
          icon: Users,
        },
        {
          label: '访问会话',
          unit: 'Sessions',
          value: data.totals.sessions,
          previous: data.previous.sessions,
          icon: MousePointer2,
        },
        {
          label: '活跃访客',
          unit: 'Live',
          value: data.active,
          previous: 0,
          icon: Activity,
        },
      ]
    : []
  return (
    <VisoraPage
      title='访问概览'
      description='每一个项目的访问表现，一目了然。'
      action={
        <Button asChild>
          <Link to='/projects'>
            <Plus className='size-4' />
            接入项目
          </Link>
        </Button>
      }
    >
      <AnalyticsFilters refresh={() => void refetch()} fetching={isFetching} />
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && (
        <div className='grid gap-4 md:grid-cols-4'>
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className='h-36 rounded-xl' />
          ))}
        </div>
      )}
      {data && (
        <>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            {metrics.map((metric) => (
              <Card key={metric.unit} className='gap-4 shadow-none'>
                <CardHeader className='flex flex-row items-center justify-between pb-0'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                    {metric.label}
                    <span className='text-[10px] font-normal tracking-wide opacity-70'>
                      {metric.unit}
                    </span>
                  </CardTitle>
                  <metric.icon className='size-4 text-primary/65' />
                </CardHeader>
                <CardContent>
                  <div className='mb-3 text-3xl font-semibold tracking-tight tabular-nums'>
                    {formatNumber(metric.value)}
                    {metric.unit === 'Live' && (
                      <span className='ml-3 inline-block size-2 rounded-full bg-emerald-500 align-middle' />
                    )}
                  </div>
                  {metric.unit === 'Live' ? (
                    <p className='text-xs text-muted-foreground'>
                      最近 5 分钟产生事件的访客 · 每 30 秒更新
                    </p>
                  ) : (
                    <Change value={metric.value} previous={metric.previous} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {!data.projects.length && <EmptyState />}
          <Card className='shadow-none'>
            <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-3'>
              <div className='space-y-2'>
                <CardTitle className='text-base'>访问趋势</CardTitle>
                <CardDescription>
                  观察流量变化，了解项目的每一天。
                  <Link to='/trends' className='ml-2 text-primary'>
                    打开柱状图并下钻
                  </Link>
                </CardDescription>
              </div>
              <div className='flex gap-5 text-xs text-muted-foreground'>
                <span className='flex items-center gap-2'>
                  <i className='size-2 rounded-full bg-indigo-500' />
                  浏览量
                </span>
                <span className='flex items-center gap-2'>
                  <i className='size-2 rounded-full bg-teal-500' />
                  独立访客
                </span>
              </div>
            </CardHeader>
            <CardContent className='px-2 pb-2 sm:px-6'>
              <div
                className='h-72 w-full'
                aria-label='每日浏览量和独立访客趋势图'
              >
                <ResponsiveContainer width='100%' height='100%'>
                  <AreaChart
                    data={data.trend}
                    margin={{ top: 10, right: 16, left: -20, bottom: 0 }}
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
                          stopColor='#6366f1'
                          stopOpacity={0.18}
                        />
                        <stop
                          offset='100%'
                          stopColor='#6366f1'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 5'
                      vertical={false}
                      stroke='var(--border)'
                    />
                    <XAxis
                      dataKey='date'
                      tickFormatter={(v: string) =>
                        v.slice(5).replace('-', '/')
                      }
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      minTickGap={30}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        color: 'var(--foreground)',
                        fontSize: 12,
                      }}
                      labelFormatter={(value) => `${String(value)} · 上海时间`}
                    />
                    <Area
                      isAnimationActive={false}
                      type='monotone'
                      dataKey='pv'
                      name='浏览量 PV'
                      stroke='#6366f1'
                      strokeWidth={2.5}
                      fill='url(#visora-pv)'
                      dot={data.trend.length === 1}
                    />
                    <Area
                      isAnimationActive={false}
                      type='monotone'
                      dataKey='uv'
                      name='独立访客 UV'
                      stroke='#14b8a6'
                      strokeWidth={2}
                      fill='transparent'
                      dot={data.trend.length === 1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <div className='grid gap-5 lg:grid-cols-2'>
            <Card className='shadow-none'>
              <CardHeader className='flex flex-row items-center justify-between'>
                <CardTitle className='text-base'>热门页面</CardTitle>
                <span className='text-xs text-muted-foreground'>
                  浏览量 / 占比
                </span>
              </CardHeader>
              <CardContent>
                <RankingList
                  items={data.dimensions.path}
                  total={data.totals.pv}
                />
              </CardContent>
            </Card>
            <Card className='shadow-none'>
              <CardHeader className='flex flex-row items-center justify-between'>
                <CardTitle className='text-base'>访问来源</CardTitle>
                <span className='text-xs text-muted-foreground'>
                  浏览量 / 占比
                </span>
              </CardHeader>
              <CardContent>
                <RankingList
                  items={data.dimensions.referrer}
                  total={data.totals.pv}
                />
              </CardContent>
            </Card>
          </div>
          <Card className='gap-4 shadow-none'>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div className='space-y-2'>
                <CardTitle className='text-base'>项目表现</CardTitle>
                <CardDescription>
                  所选日期内的项目流量，按浏览量排序。
                </CardDescription>
              </div>
              <Layers className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目</TableHead>
                    <TableHead>采集状态</TableHead>
                    <TableHead className='text-right'>浏览量</TableHead>
                    <TableHead className='text-right'>访客</TableHead>
                    <TableHead className='hidden text-right sm:table-cell'>
                      最近访问（上海时间）
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className='font-medium'>
                        {project.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className='gap-1.5 font-normal'
                        >
                          <span
                            className={`size-1.5 rounded-full ${project.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`}
                          />
                          {project.enabled ? '已启用' : '已暂停'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {formatNumber(project.pv)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {formatNumber(project.uv)}
                      </TableCell>
                      <TableCell className='hidden text-right text-xs text-muted-foreground sm:table-cell'>
                        {formatTime(project.last_event)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data.projects.length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='h-20 text-center text-muted-foreground'
                      >
                        还没有接入项目
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className='grid gap-5 lg:grid-cols-2'>
            <Card className='shadow-none'>
              <CardHeader>
                <CardTitle className='text-base'>访客环境</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue='browser'>
                  <TabsList className='mb-4'>
                    <TabsTrigger value='browser'>浏览器</TabsTrigger>
                    <TabsTrigger value='device'>设备</TabsTrigger>
                    <TabsTrigger value='os'>操作系统</TabsTrigger>
                    <TabsTrigger value='language'>语言</TabsTrigger>
                  </TabsList>
                  {(['browser', 'device', 'os', 'language'] as const).map(
                    (key) => (
                      <TabsContent key={key} value={key}>
                        <RankingList
                          items={data.dimensions[key]}
                          total={data.totals.pv}
                        />
                      </TabsContent>
                    )
                  )}
                </Tabs>
              </CardContent>
            </Card>
            <Card className='shadow-none'>
              <CardHeader className='flex flex-row items-center justify-between'>
                <CardTitle className='text-base'>自定义事件</CardTitle>
                <Badge variant='secondary'>
                  {formatNumber(data.totals.events)} 次
                </Badge>
              </CardHeader>
              <CardContent>
                {data.customEvents.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>事件名称</TableHead>
                        <TableHead className='text-right'>触发次数</TableHead>
                        <TableHead className='text-right'>访客数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customEvents.map((event) => (
                        <TableRow key={event.name}>
                          <TableCell>{event.name}</TableCell>
                          <TableCell className='text-right'>
                            {formatNumber(event.count)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {formatNumber(event.visitors)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className='py-10 text-center'>
                    <p className='text-sm text-muted-foreground'>
                      记录注册、点击、任务完成等关键行为
                    </p>
                    <Button variant='link' asChild className='mt-2'>
                      <Link to='/integrations'>
                        查看自定义事件接入
                        <ArrowUpRight className='size-4' />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </VisoraPage>
  )
}
