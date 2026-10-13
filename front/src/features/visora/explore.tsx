import { useState } from 'react'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ChartNoAxesCombined,
  FileText,
  Globe2,
  Monitor,
  MousePointer2,
  Users,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { useMinWidth } from './use-min-width'
import { PanelTitle } from './visuals'

const dimensionIcons: Record<string, LucideIcon> = {
  path: FileText,
  referrer: Globe2,
  device: Monitor,
  browser: Globe2,
  os: Monitor,
  language: Globe2,
  action: MousePointer2,
  event: MousePointer2,
}

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
            fill='var(--chart-1)'
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
                fill={
                  point.key === selected ? 'var(--chart-5)' : 'var(--chart-1)'
                }
              />
            ))}
          </Bar>
          <Bar
            dataKey='visitors'
            name={visitorLabel}
            fill='var(--chart-2)'
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
    <div className='flex flex-col gap-1.5'>
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
  const desktop = useMinWidth(1280)
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

  const detail = selected ? (
    <div className='flex flex-col gap-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium' title={series.data?.name}>
            {series.data?.name || '加载中'}
          </p>
          <p className='text-xs text-muted-foreground'>
            {countLabel}与{visitorLabel}按天展开
          </p>
        </div>
        {desktop && (
          <Button variant='ghost' size='sm' onClick={() => setSelected(null)}>
            关闭
          </Button>
        )}
      </div>
      {series.isPending && <Skeleton className='h-52 rounded-lg' />}
      {series.error && (
        <ErrorState error={series.error} retry={() => void series.refetch()} />
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
      {companions.length > 0 && (
        <Tabs defaultValue={companions[0]?.dimension}>
          <TabsList className='w-full'>
            {companions.map((companion) => (
              <TabsTrigger
                key={companion.dimension}
                value={companion.dimension}
              >
                {companion.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {companions.map((companion, index) => {
            const query = companionData[index]
            return (
              <TabsContent
                key={companion.dimension}
                value={companion.dimension}
              >
                {query?.isPending && <Skeleton className='h-28 rounded-lg' />}
                {query?.error && (
                  <ErrorState
                    error={query.error}
                    retry={() => void query.refetch()}
                  />
                )}
                {query?.data && (
                  <RankList rows={query.data.rows} total={query.data.total} />
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  ) : (
    <p className='py-16 text-center text-sm text-muted-foreground'>
      从左侧选择一条记录
    </p>
  )

  return (
    <>
      <div className='grid items-start gap-3 xl:grid-cols-2'>
        <Card className='gap-3 py-4'>
          <CardHeader className='px-4'>
            <CardTitle className='text-sm'>
              <PanelTitle
                icon={dimensionIcons[dimension] || ChartNoAxesCombined}
                tone='violet'
              >
                {rankTitle}
              </PanelTitle>
            </CardTitle>
          </CardHeader>
          <CardContent className='px-3'>
            {breakdown.isPending && <Skeleton className='h-52 rounded-lg' />}
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
        {desktop ? (
          <Card className='gap-3 py-4'>
            <CardContent className='px-4'>{detail}</CardContent>
          </Card>
        ) : (
          <Sheet
            open={selected !== null}
            onOpenChange={(open) => {
              if (!open) setSelected(null)
            }}
          >
            <SheetContent
              side='bottom'
              className='max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
            >
              <SheetHeader>
                <SheetTitle>{series.data?.name || rankTitle}</SheetTitle>
                <SheetDescription>
                  每日趋势和构成。再次点选可关闭。
                </SheetDescription>
              </SheetHeader>
              <div className='px-4 pb-4'>{detail}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </>
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

function DayBreakdown({
  day,
  showProjects,
}: {
  day: DayReport
  showProjects: boolean
}) {
  const groups = [
    { id: 'pages', title: '页面', group: day.pages },
    { id: 'referrers', title: '来源', group: day.referrers },
    { id: 'devices', title: '设备', group: day.devices },
    { id: 'actions', title: '操作', group: day.actions },
    ...(showProjects
      ? [{ id: 'projects', title: '系统', group: day.projects }]
      : []),
  ]
  return (
    <Tabs defaultValue='pages'>
      <TabsList className='w-full'>
        {groups.map((item) => (
          <TabsTrigger key={item.id} value={item.id}>
            {item.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((item) => (
        <TabsContent key={item.id} value={item.id}>
          <RankList rows={item.group.rows} total={item.group.total} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function VisoraTrends() {
  const desktop = useMinWidth(1280)
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

  const detail = (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium'>
          {activeDate ? dayTitle(activeDate) : '选择一天'}
        </p>
        {activeDate && (
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='min-h-11 xl:min-h-8'
              onClick={() => {
                setFilter({ ...filter, from: activeDate, to: activeDate })
                void navigate({ to: '/events' })
              }}
            >
              当天明细
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='min-h-11 xl:min-h-8'
              onClick={() => setDate(null)}
            >
              关闭
            </Button>
          </div>
        )}
      </div>
      {!activeDate && (
        <p className='py-16 text-center text-sm text-muted-foreground'>
          点击柱子查看这一天的小时、页面和来源。
        </p>
      )}
      {activeDate && day.isPending && <Skeleton className='h-52 rounded-lg' />}
      {activeDate && day.error && (
        <ErrorState error={day.error} retry={() => void day.refetch()} />
      )}
      {activeDate && day.data && (
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
          <DayBreakdown
            day={day.data}
            showProjects={filter.project === 'all'}
          />
        </>
      )}
    </div>
  )

  return (
    <div className='flex flex-col gap-3'>
      <FilterBar />
      {report.error && (
        <ErrorState error={report.error} retry={() => void report.refetch()} />
      )}
      {report.isPending && <Skeleton className='h-64 rounded-xl' />}
      {report.data && (
        <div className='grid items-stretch gap-3 xl:grid-cols-5'>
          <Card className='gap-3 py-4 xl:col-span-3'>
            <CardHeader className='flex flex-row items-center justify-between px-4'>
              <CardTitle className='text-sm'>
                <PanelTitle icon={ChartNoAxesCombined}>每日访问</PanelTitle>
              </CardTitle>
              <div className='flex gap-3 text-xs text-muted-foreground'>
                <span className='inline-flex items-center gap-1.5'>
                  <i className='size-2 rounded-full bg-chart-1' />
                  PV
                </span>
                <span className='inline-flex items-center gap-1.5'>
                  <i className='size-2 rounded-full bg-chart-2' />
                  UV
                </span>
              </div>
            </CardHeader>
            <CardContent className='px-2'>
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
          {desktop ? (
            <Card className='gap-3 py-4 xl:col-span-2'>
              <CardContent className='px-4'>{detail}</CardContent>
            </Card>
          ) : (
            <Sheet
              open={activeDate !== null}
              onOpenChange={(open) => {
                if (!open) setDate(null)
              }}
            >
              <SheetContent
                side='bottom'
                className='max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
              >
                <SheetHeader>
                  <SheetTitle>
                    {activeDate ? dayTitle(activeDate) : '当天'}
                  </SheetTitle>
                  <SheetDescription>
                    小时分布，以及页面、来源和设备。
                  </SheetDescription>
                </SheetHeader>
                <div className='px-4 pb-4'>{detail}</div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      )}
    </div>
  )
}

export function VisoraPages() {
  const { filter } = useAnalyticsFilter()
  return (
    <div className='flex flex-col gap-3'>
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
    </div>
  )
}

export function VisoraSources() {
  const { filter } = useAnalyticsFilter()
  return (
    <div className='flex flex-col gap-3'>
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
    </div>
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
  return (
    <div className='flex flex-col gap-3'>
      <FilterBar />
      {visitors.error && (
        <ErrorState
          error={visitors.error}
          retry={() => void visitors.refetch()}
        />
      )}
      {visitors.isPending && <Skeleton className='h-16 rounded-xl' />}
      {visitors.data && (
        <div className='grid grid-cols-2 gap-2'>
          <Card tone='violet' className='gap-3 py-4'>
            <CardHeader className='px-3 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                <PanelTitle icon={Users} tone='violet'>
                  新访客
                </PanelTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className='px-3 text-2xl font-semibold tabular-nums'>
              {formatNumber(visitors.data.newVisitors)}
            </CardContent>
          </Card>
          <Card tone='teal' className='gap-3 py-4'>
            <CardHeader className='px-3 pb-0'>
              <CardTitle className='text-xs font-medium text-muted-foreground'>
                <PanelTitle icon={UserRoundCheck} tone='teal'>
                  回访
                </PanelTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className='px-3 text-2xl font-semibold tabular-nums'>
              {formatNumber(visitors.data.returningVisitors)}
            </CardContent>
          </Card>
        </div>
      )}
      <Tabs defaultValue='device'>
        <TabsList className='w-full'>
          {audiences.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {audiences.map((item) => (
          <TabsContent key={item.value} value={item.value}>
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
    </div>
  )
}

export function VisoraBehavior() {
  return (
    <div className='flex flex-col gap-3'>
      <FilterBar />
      <Tabs defaultValue='auto'>
        <TabsList>
          <TabsTrigger value='auto'>自动采集</TabsTrigger>
          <TabsTrigger value='custom'>业务事件</TabsTrigger>
        </TabsList>
        <TabsContent value='auto' className='flex flex-col gap-3'>
          <p className='text-xs text-muted-foreground'>
            按钮、链接、菜单、开关和表单提交。只记录操作名称。
          </p>
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
        </TabsContent>
        <TabsContent value='custom' className='flex flex-col gap-3'>
          <p className='text-xs text-muted-foreground'>
            手动上报的结果，例如注册成功或任务完成。
          </p>
          <DimensionExplorer
            dimension='name'
            rankTitle='事件名称'
            countLabel='次数'
            visitorLabel='访客'
            companions={[{ dimension: 'path', title: '发生页面' }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
