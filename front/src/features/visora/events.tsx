import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Radio,
} from 'lucide-react'
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
import {
  api,
  formatNumber,
  formatTime,
  type VisitEvent,
  type EventPage,
} from './api'
import { EventDetail } from './event-detail'
import { eventKind } from './event-kind'
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { EmptyState, ErrorState, VisoraPage } from './shared'
import { IconBadge, PanelTitle } from './visuals'

function EventTable({ query }: { query: string }) {
  const [pagination, setPagination] = useState({ query, page: 1 })
  if (pagination.query !== query) setPagination({ query, page: 1 })
  const page = pagination.query === query ? pagination.page : 1
  const setPage = (nextPage: number) => setPagination({ query, page: nextPage })
  const [detailTrigger, setDetailTrigger] = useState<HTMLElement | null>(null)
  function showDetail(event: VisitEvent, trigger: HTMLElement) {
    setDetailTrigger(trigger)
    setSelected(event)
  }
  const [selected, setSelected] = useState<VisitEvent | null>(null)
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['visora', 'events', query, page],
    queryFn: () => api<EventPage>(`/events?${query}&page=${page}`),
    refetchInterval: page === 1 ? 10000 : false,
  })
  return (
    <>
      <EventDetail
        event={selected}
        close={() => setSelected(null)}
        returnFocus={detailTrigger}
      />
      <AnalyticsFilters refresh={() => void refetch()} fetching={isFetching} />
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && <Skeleton className='h-80 rounded-xl' />}
      {data && (
        <Card>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
            <CardTitle className='text-base'>
              <PanelTitle icon={ListFilter} tone='violet'>
                访问与事件明细
              </PanelTitle>{' '}
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {formatNumber(data.total)} 条
              </span>
            </CardTitle>
            <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Radio className='size-3.5 text-teal' />
              {page === 1 ? '每 10 秒自动刷新' : '历史记录'}
            </span>
          </CardHeader>
          <CardContent>
            {!data.total ? (
              <EmptyState
                title='当前范围内没有记录'
                description='调整项目或日期范围，或在接入的网站产生一次访问。'
                link={false}
              />
            ) : (
              <>
                <div className='flex flex-col gap-2 md:hidden'>
                  {data.events.map((event) => (
                    <button
                      key={event.id}
                      type='button'
                      className='group w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-info/30 hover:bg-info/5 focus-visible:ring-2 focus-visible:ring-ring'
                      onClick={(e) => showDetail(event, e.currentTarget)}
                    >
                      <div className='flex items-start gap-3'>
                        <IconBadge
                          icon={eventKind(event).icon}
                          tone={eventKind(event).tone}
                        />
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {event.type === 'pageview'
                              ? '页面访问'
                              : event.label ||
                                (event.action ? '未命名控件' : event.name)}
                          </p>
                          <p className='mt-1 truncate font-mono text-xs text-muted-foreground'>
                            {event.path}
                          </p>
                        </div>
                        <Badge
                          variant={eventKind(event).variant}
                          className='shrink-0'
                        >
                          {eventKind(event).label}
                        </Badge>
                      </div>
                      <p className='mt-2 truncate text-xs text-muted-foreground'>
                        {formatTime(event.occurred_at)} · {event.project_name} ·{' '}
                        {event.user_name || event.user_id || '匿名访客'} ·{' '}
                        {event.ip || '未记录'}
                      </p>
                    </button>
                  ))}
                </div>
                <div className='hidden md:block'>
                  <Table className='min-w-[1040px] table-fixed'>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-32'>时间（上海）</TableHead>
                        <TableHead className='w-28'>项目</TableHead>
                        <TableHead className='w-36'>业务用户</TableHead>
                        <TableHead className='w-28'>IP 地址</TableHead>
                        <TableHead className='w-44'>操作</TableHead>
                        <TableHead className='w-44'>页面</TableHead>
                        <TableHead className='w-32'>环境</TableHead>
                        <TableHead className='sticky right-0 w-24 bg-muted'>
                          <span className='sr-only'>详情</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className='text-xs tabular-nums'>
                            {formatTime(event.occurred_at)}
                          </TableCell>
                          <TableCell className='font-medium'>
                            <p className='truncate' title={event.project_name}>
                              {event.project_name}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className='space-y-1 text-xs'>
                              <p
                                className='truncate font-medium'
                                title={
                                  event.user_name || event.user_id || '匿名访客'
                                }
                              >
                                {event.user_name || event.user_id || '匿名访客'}
                              </p>
                              {event.user_id && (
                                <p
                                  className='truncate text-muted-foreground'
                                  title={event.user_id}
                                >
                                  ID: {event.user_id}
                                </p>
                              )}
                              {event.user_email && (
                                <p
                                  className='truncate text-muted-foreground'
                                  title={event.user_email}
                                >
                                  {event.user_email}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='font-mono text-xs'>
                            <p className='truncate' title={event.ip || ''}>
                              {event.ip || '未记录'}
                            </p>
                          </TableCell>
                          <TableCell className='space-y-1'>
                            <Badge variant={eventKind(event).variant}>
                              {eventKind(event).label}
                            </Badge>
                            {event.type !== 'pageview' && (
                              <p
                                className='truncate text-sm'
                                title={event.label || event.name}
                              >
                                {event.label ||
                                  (event.action ? '未命名控件' : event.name)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className='font-mono text-xs'>
                            <p className='truncate' title={event.path}>
                              {event.path}
                            </p>
                          </TableCell>
                          <TableCell className='text-xs text-muted-foreground'>
                            <p className='truncate'>
                              {event.browser} · {event.device}
                            </p>
                            <p className='mt-1 truncate'>
                              {event.os} · {event.language || '语言未知'}
                            </p>
                          </TableCell>
                          <TableCell className='sticky right-0 bg-card'>
                            <Button
                              variant='secondary'
                              size='sm'
                              onClick={(e) =>
                                showDetail(event, e.currentTarget)
                              }
                            >
                              详情
                              <ArrowUpRight data-icon='inline-end' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className='mt-5 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between'>
                  <span className='text-muted-foreground'>
                    第 {page} /{' '}
                    {Math.max(1, Math.ceil(data.total / data.pageSize))} 页
                  </span>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={page === 1 || isFetching}
                      onClick={() => setPage(page - 1)}
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
                      onClick={() => setPage(page + 1)}
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
      )}
    </>
  )
}

export function VisoraEvents() {
  const { query } = useAnalyticsFilter()
  return (
    <VisoraPage title='访问明细'>
      <EventTable query={query} />
    </VisoraPage>
  )
}
