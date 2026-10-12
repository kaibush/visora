import { useState } from 'react'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  api,
  formatNumber,
  type Breakdown,
  type DayReport,
  type ExploreRow,
  type Series,
  type VisitorSplit,
} from './api'
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { ErrorState } from './shared'

type Companion = { dimension: string; title: string }
type BarPoint = { key: string; label: string; count: number; visitors: number }

function search(query: string, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams(query)
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) params.set(key, value)
  }
  return params.toString()
}

function useBreakdown(
  dimension: string,
  focus?: { dimension: string; value: string },
  enabled = true
) {
  const { query } = useAnalyticsFilter()
  return useQuery({
    queryKey: ['visora', 'breakdown', query, dimension, focus],
    enabled,
    queryFn: () =>
      api<Breakdown>(
        `/analytics/breakdown?${search(query, {
          dimension,
          ...(focus ? { focus: focus.dimension, focusValue: focus.value } : {}),
        })}`
      ),
  })
}

function useSeries(dimension: string, value: string | null) {
  const { query } = useAnalyticsFilter()
  return useQuery({
    queryKey: ['visora', 'series', query, dimension, value],
    enabled: value !== null,
    queryFn: () =>
      api<Series>(
        `/analytics/series?${search(query, { dimension, value: value ?? '' })}`
      ),
  })
}

function ClickableBars({
  data,
  selected,
  onSelect,
  countLabel,
  visitorLabel,
  label,
}: {
  data: BarPoint[]
  selected?: string | null
  onSelect?: (key: string) => void
  countLabel: string
  visitorLabel: string
  label: string
}) {
  return (
    <div className='h-56 w-full min-w-0 sm:h-72' role='img' aria-label={label}>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray='3 5'
            vertical={false}
            stroke='var(--border)'
          />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            interval={data.length > 16 ? 'equidistantPreserveStart' : 0}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
            contentStyle={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey='count'
            name={countLabel}
            fill='#6366f1'
            radius={[4, 4, 0, 0]}
            minPointSize={onSelect ? 3 : 0}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={(bar) => {
              const key = bar.payload?.key
              if (onSelect && typeof key === 'string') onSelect(key)
            }}
          >
            {data.map((point) => (
              <Cell
                key={point.key}
                fill={point.key === selected ? '#0f766e' : '#6366f1'}
              />
            ))}
          </Bar>
          <Bar
            dataKey='visitors'
            name={visitorLabel}
            fill='#14b8a6'
            radius={[4, 4, 0, 0]}
            minPointSize={onSelect ? 3 : 0}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={(bar) => {
              const key = bar.payload?.key
              if (onSelect && typeof key === 'string') onSelect(key)
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function RankList({
  rows,
  total,
  selected,
  onSelect,
}: {
  rows: ExploreRow[]
  total: number
  selected?: string | null
  onSelect?: (key: string) => void
}) {
  if (!rows.length) {
    return (
      <p className='py-10 text-center text-sm text-muted-foreground'>
        这段时间没有数据
      </p>
    )
  }
  return (
    <div className='space-y-2'>
      {rows.map((row) => {
        const share = total ? Math.round((row.count / total) * 100) : 0
        const active = selected === row.key
        const className = `relative w-full min-h-11 overflow-hidden rounded-md px-3 py-2.5 text-left ${active ? 'bg-primary/5 ring-1 ring-primary' : onSelect ? 'hover:bg-muted/70' : ''}`
        if (!onSelect) {
          return (
            <div key={row.key || row.name} className={className}>
              <span
                className='absolute inset-y-0 left-0 bg-primary/8'
                style={{ width: `${Math.max(share, row.count ? 2 : 0)}%` }}
              />
              <span className='relative flex items-center justify-between gap-3 text-sm'>
                <span className='truncate' title={row.name}>
                  {row.name}
                </span>
                <span className='flex shrink-0 items-baseline gap-3 tabular-nums'>
                  <span className='font-medium'>{formatNumber(row.count)}</span>
                  <span className='w-10 text-right text-xs text-muted-foreground'>
                    {share}%
                  </span>
                </span>
              </span>
            </div>
          )
        }
        return (
          <button
            key={row.key || row.name}
            type='button'
            aria-pressed={active}
            className={className}
            onClick={() => onSelect(row.key)}
          >
            <span
              className='absolute inset-y-0 left-0 bg-primary/8'
              style={{ width: `${Math.max(share, row.count ? 2 : 0)}%` }}
            />
            <span className='relative flex items-center justify-between gap-3 text-sm'>
              <span className='truncate' title={row.name}>
                {row.name}
              </span>
              <span className='flex shrink-0 items-baseline gap-3 tabular-nums'>
                <span className='font-medium'>{formatNumber(row.count)}</span>
                <span className='w-10 text-right text-xs text-muted-foreground'>
                  {share}%
                </span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function isExploreQuery(queryKey: readonly unknown[]) {
  return queryKey[0] === 'visora' && queryKey[1] !== 'projects'
}

function FilterBar() {
  const client = useQueryClient()
  const fetching =
    useIsFetching({ predicate: (query) => isExploreQuery(query.queryKey) }) > 0
  return (
    <AnalyticsFilters
      fetching={fetching}
      refresh={() =>
        void client.invalidateQueries({
          predicate: (query) => isExploreQuery(query.queryKey),
        })
      }
    />
  )
}

function DimensionExplorer({
  dimension,
  companions,
  countLabel,
  visitorLabel,
  rankTitle,
}: {
  dimension: string
  companions: Companion[]
  countLabel: string
  visitorLabel: string
  rankTitle: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const breakdown = useBreakdown(dimension)
  const series = useSeries(dimension, selected)
  const focus = selected === null ? undefined : { dimension, value: selected }
  const first = useBreakdown(
    companions[0]?.dimension ?? 'path',
    focus,
    Boolean(selected && companions[0])
  )
  const second = useBreakdown(
    companions[1]?.dimension ?? 'path',
    focus,
    Boolean(selected && companions[1])
  )
  const companionData = [first, second]
  const choose = (key: string) =>
    setSelected((current) => (current === key ? null : key))

  return (
    <div className='grid items-start gap-5 xl:grid-cols-2'>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>{rankTitle}</CardTitle>
          <CardDescription>
            点击一行，查看它的每日柱状趋势和构成。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.isPending && <Skeleton className='h-64 rounded-lg' />}
          {breakdown.error && (
            <ErrorState
              error={breakdown.error}
              retry={() => void breakdown.refetch()}
            />
          )}
          {breakdown.data && (
            <RankList
              rows={breakdown.data.rows}
              total={breakdown.data.total}
              selected={selected}
              onSelect={choose}
            />
          )}
        </CardContent>
      </Card>
      <div className='space-y-5'>
        {!selected && (
          <Card className='shadow-none'>
            <CardContent className='py-16 text-center text-sm text-muted-foreground'>
              从列表中选择一个条目。切换上方的项目后，这里只保留该系统自己的数据。
            </CardContent>
          </Card>
        )}
        {selected && (
          <Card className='shadow-none'>
            <CardHeader className='flex flex-row items-start justify-between gap-3'>
              <div className='min-w-0 space-y-1'>
                <CardTitle
                  className='truncate text-base'
                  title={series.data?.name}
                >
                  {series.data?.name || '加载中'}
                </CardTitle>
                <CardDescription>
                  {countLabel}与{visitorLabel}按天展开，再次点击可取消。
                </CardDescription>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setSelected(null)}
              >
                关闭
              </Button>
            </CardHeader>
            <CardContent>
              {series.isPending && <Skeleton className='h-64 rounded-lg' />}
              {series.error && (
                <ErrorState
                  error={series.error}
                  retry={() => void series.refetch()}
                />
              )}
              {series.data && (
                <ClickableBars
                  label={`${series.data.name}的每日${countLabel}`}
                  countLabel={countLabel}
                  visitorLabel={visitorLabel}
                  data={series.data.trend.map((point) => ({
                    key: point.date,
                    label: point.date.slice(5),
                    count: point.count,
                    visitors: point.visitors,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        )}
        {selected && (
          <div className='grid gap-5 sm:grid-cols-2'>
            {companions.map((companion, index) => {
              const query = companionData[index]
              return (
                <Card key={companion.dimension} className='shadow-none'>
                  <CardHeader>
                    <CardTitle className='text-base'>
                      {companion.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {query?.isPending && (
                      <Skeleton className='h-36 rounded-lg' />
                    )}
                    {query?.error && (
                      <ErrorState
                        error={query.error}
                        retry={() => void query.refetch()}
                      />
                    )}
                    {query?.data && (
                      <RankList
                        rows={query.data.rows}
                        total={query.data.total}
                      />
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function dayTitle(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00+08:00`))
}

export function VisoraTrends() {
  const { query, filter, setFilter } = useAnalyticsFilter()
  const navigate = useNavigate()
  const [date, setDate] = useState<string | null>(null)
  const activeDate =
    date && date >= filter.from && date <= filter.to ? date : null
  const report = useQuery({
    queryKey: ['visora', 'analytics', query],
    queryFn: () =>
      api<{ trend: { date: string; pv: number; uv: number }[] }>(
        `/analytics?${query}`
      ),
  })
  const day = useQuery({
    queryKey: ['visora', 'day', query, activeDate],
    enabled: Boolean(activeDate),
    queryFn: () =>
      api<DayReport>(
        `/analytics/day?${search(query, { date: activeDate ?? '' })}`
      ),
  })
  const points =
    report.data?.trend.map((point) => ({
      key: point.date,
      label: point.date.slice(5),
      count: point.pv,
      visitors: point.uv,
    })) ?? []
  const choose = (key: string) =>
    setDate((current) => (current === key ? null : key))

  return (
    <>
      <FilterBar />
      {report.error && (
        <ErrorState error={report.error} retry={() => void report.refetch()} />
      )}
      {report.isPending && <Skeleton className='h-80 rounded-xl' />}
      {report.data && (
        <Card className='shadow-none'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='text-base'>每日访问</CardTitle>
              <CardDescription>
                紫色是浏览量，青色是独立访客。点击柱子下钻当天。
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-4 text-xs text-muted-foreground'>
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
          <CardContent>
            <ClickableBars
              label='每日浏览量和独立访客'
              countLabel='浏览量'
              visitorLabel='独立访客'
              data={points}
              selected={activeDate}
              onSelect={choose}
            />
          </CardContent>
        </Card>
      )}
      {activeDate && (
        <Card className='shadow-none'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='text-base'>
                {dayTitle(activeDate)}
              </CardTitle>
              <CardDescription>
                这一天的小时分布。明细仍按当前项目隔离。
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setFilter({ ...filter, from: activeDate, to: activeDate })
                  void navigate({ to: '/events' })
                }}
              >
                查看当天明细
              </Button>
              <Button variant='ghost' size='sm' onClick={() => setDate(null)}>
                关闭
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-5'>
            {day.isPending && <Skeleton className='h-64 rounded-lg' />}
            {day.error && (
              <ErrorState error={day.error} retry={() => void day.refetch()} />
            )}
            {day.data && (
              <>
                <ClickableBars
                  label={`${activeDate}的小时访问`}
                  countLabel='浏览量'
                  visitorLabel='独立访客'
                  data={day.data.hours.map((hour) => ({
                    key: hour.hour,
                    label: hour.hour,
                    count: hour.count,
                    visitors: hour.visitors,
                  }))}
                />
                <div className='grid gap-5 lg:grid-cols-2'>
                  {[
                    { title: '页面', group: day.data.pages },
                    { title: '来源', group: day.data.referrers },
                    { title: '设备', group: day.data.devices },
                    { title: '操作', group: day.data.actions },
                    ...(filter.project === 'all'
                      ? [{ title: '系统', group: day.data.projects }]
                      : []),
                  ].map((item) => (
                    <Card key={item.title} className='shadow-none'>
                      <CardHeader>
                        <CardTitle className='text-base'>
                          {item.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RankList
                          rows={item.group.rows}
                          total={item.group.total}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

export function VisoraPages() {
  const { filter } = useAnalyticsFilter()
  return (
    <>
      <FilterBar />
      <DimensionExplorer
        dimension='path'
        rankTitle='页面'
        countLabel='浏览量'
        visitorLabel='访客'
        companions={[
          { dimension: 'referrer', title: '访问来源' },
          ...(filter.project === 'all'
            ? [{ dimension: 'project', title: '所属系统' }]
            : []),
        ]}
      />
    </>
  )
}

export function VisoraSources() {
  const { filter } = useAnalyticsFilter()
  return (
    <>
      <FilterBar />
      <DimensionExplorer
        dimension='referrer'
        rankTitle='来源'
        countLabel='浏览量'
        visitorLabel='访客'
        companions={[
          { dimension: 'path', title: '落地页' },
          ...(filter.project === 'all'
            ? [{ dimension: 'project', title: '所属系统' }]
            : []),
        ]}
      />
    </>
  )
}

const audiences = [
  { value: 'device', title: '设备', dimension: 'device' },
  { value: 'browser', title: '浏览器', dimension: 'browser' },
  { value: 'os', title: '操作系统', dimension: 'os' },
  { value: 'language', title: '语言', dimension: 'language' },
] as const

export function VisoraAudience() {
  const { query } = useAnalyticsFilter()
  const visitors = useQuery({
    queryKey: ['visora', 'visitors', query],
    queryFn: () => api<VisitorSplit>(`/analytics/visitors?${query}`),
  })
  const cards = visitors.data
    ? [
        ['新访客', visitors.data.newVisitors, '这段时间内第一次出现在当前项目'],
        [
          '回访访客',
          visitors.data.returningVisitors,
          '当前项目里更早来过，这次又出现',
        ],
      ]
    : []
  return (
    <>
      <FilterBar />
      {visitors.error && (
        <ErrorState
          error={visitors.error}
          retry={() => void visitors.refetch()}
        />
      )}
      {visitors.isPending && (
        <div className='grid gap-4 sm:grid-cols-2'>
          <Skeleton className='h-28 rounded-xl' />
          <Skeleton className='h-28 rounded-xl' />
        </div>
      )}
      {visitors.data && (
        <div className='grid gap-4 sm:grid-cols-2'>
          {cards.map(([title, value, detail]) => (
            <Card key={String(title)} className='shadow-none'>
              <CardHeader className='pb-0'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-3xl font-semibold tabular-nums'>
                  {formatNumber(Number(value))}
                </p>
                <p className='mt-2 text-xs text-muted-foreground'>{detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Tabs defaultValue='device'>
        <TabsList className='flex h-auto w-full flex-wrap justify-start'>
          {audiences.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {audiences.map((item) => (
          <TabsContent key={item.value} value={item.value} className='mt-5'>
            <DimensionExplorer
              dimension={item.dimension}
              rankTitle={item.title}
              countLabel='浏览量'
              visitorLabel='访客'
              companions={[{ dimension: 'path', title: '热门页面' }]}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}

export function VisoraBehavior() {
  return (
    <>
      <FilterBar />
      <section className='space-y-3'>
        <div>
          <h2 className='text-base font-medium'>自动采集</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            按钮、链接、菜单、开关和表单提交。点击后可看到操作名称和发生页面。
          </p>
        </div>
        <DimensionExplorer
          dimension='action'
          rankTitle='操作类型'
          countLabel='次数'
          visitorLabel='访客'
          companions={[
            { dimension: 'label', title: '操作名称' },
            { dimension: 'path', title: '所在页面' },
          ]}
        />
      </section>
      <section className='space-y-3'>
        <div>
          <h2 className='text-base font-medium'>业务事件</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            手动上报的结果，例如注册成功或任务完成。自动采集的点击不会混进这里。
          </p>
        </div>
        <DimensionExplorer
          dimension='name'
          rankTitle='事件名称'
          countLabel='次数'
          visitorLabel='访客'
          companions={[{ dimension: 'path', title: '发生页面' }]}
        />
      </section>
    </>
  )
}
