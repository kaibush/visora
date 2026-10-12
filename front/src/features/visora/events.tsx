import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react'
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
import { api, formatNumber, formatTime, type EventPage } from './api'
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { EmptyState, ErrorState, VisoraPage } from './shared'

function EventTable({ query }: { query: string }) {
  const [page, setPage] = useState(1)
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['visora', 'events', query, page],
    queryFn: () => api<EventPage>(`/events?${query}&page=${page}`),
    refetchInterval: page === 1 ? 10000 : false,
  })
  return (
    <>
      <AnalyticsFilters refresh={() => void refetch()} fetching={isFetching} />
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && <Skeleton className='h-80 rounded-xl' />}
      {data && (
        <Card className='shadow-none'>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
            <CardTitle className='text-base'>
              访问与事件明细{' '}
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {formatNumber(data.total)} 条
              </span>
            </CardTitle>
            <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Radio className='size-3.5 text-emerald-500' />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间（UTC）</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>业务用户</TableHead>
                      <TableHead>事件</TableHead>
                      <TableHead>页面</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>环境</TableHead>
                      <TableHead>接入方式</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className='text-xs whitespace-nowrap tabular-nums'>
                          {formatTime(event.occurred_at)}
                        </TableCell>
                        <TableCell
                          className='max-w-40 truncate font-medium'
                          title={event.project_name}
                        >
                          {event.project_name}
                        </TableCell>
                        <TableCell className='max-w-60'>
                          {event.user_id !== null ? (
                            <div className='space-y-1 text-xs'>
                              <p
                                className='truncate font-medium'
                                title={event.user_name || event.user_id}
                              >
                                {event.user_name || event.user_id}
                              </p>
                              <p
                                className='truncate font-mono text-muted-foreground'
                                title={event.user_id}
                              >
                                ID: {event.user_id}
                              </p>
                              {event.user_email && (
                                <p
                                  className='truncate text-muted-foreground'
                                  title={event.user_email}
                                >
                                  {event.user_email}
                                </p>
                              )}
                              <span className='text-[10px] text-muted-foreground'>
                                {event.source === 'browser'
                                  ? '浏览器声明'
                                  : '服务端上报'}
                              </span>
                            </div>
                          ) : (
                            <span className='text-xs text-muted-foreground'>
                              匿名访客
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.type === 'pageview'
                                ? 'secondary'
                                : 'outline'
                            }
                            className='max-w-48 truncate'
                          >
                            {event.type === 'pageview'
                              ? '页面访问'
                              : event.name}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className='max-w-64 truncate font-mono text-xs'
                          title={event.path}
                        >
                          {event.path}
                        </TableCell>
                        <TableCell
                          className='max-w-40 truncate text-xs'
                          title={event.referrer}
                        >
                          {event.referrer || '直接访问'}
                        </TableCell>
                        <TableCell className='text-xs whitespace-nowrap text-muted-foreground'>
                          <p>
                            {event.browser} · {event.device}
                          </p>
                          <p className='mt-1'>
                            {event.os} · {event.language || '语言未知'}
                          </p>
                        </TableCell>
                        <TableCell className='text-xs'>
                          {event.source === 'browser' ? '浏览器' : '服务端'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className='mt-5 flex items-center justify-between gap-2 border-t pt-4 text-sm'>
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
    <VisoraPage
      title='访问明细'
      description='查看页面访问、业务事件及接入系统主动上报的用户信息。未上报身份的记录显示为匿名访客。'
    >
      <EventTable key={query} query={query} />
    </VisoraPage>
  )
}
