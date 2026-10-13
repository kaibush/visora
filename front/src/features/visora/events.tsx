import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { AnalyticsFilters, useAnalyticsFilter } from './filter'
import { EmptyState, ErrorState, VisoraPage } from './shared'

const actionNames: Record<string, string> = {
  click: '点击',
  change: '控件变更',
  submit: '提交尝试',
}

function EventTable({ query }: { query: string }) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<VisitEvent | null>(null)
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['visora', 'events', query, page],
    queryFn: () => api<EventPage>(`/events?${query}&page=${page}`),
    refetchInterval: page === 1 ? 10000 : false,
  })
  return (
    <>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>访问详情</DialogTitle>
            <DialogDescription>
              上海时间（Asia/Shanghai，UTC+8）
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className='space-y-5 text-sm'>
              <dl className='grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-3 [&_dd]:min-w-0 [&_dd]:break-words [&_dd]:whitespace-normal [&_dt]:text-muted-foreground'>
                <dt>时间</dt>
                <dd>{formatTime(selected.occurred_at)}</dd>
                <dt>操作</dt>
                <dd>
                  {selected.type === 'pageview'
                    ? '页面访问'
                    : actionNames[selected.action || ''] || '业务事件'}
                  {selected.label ? ` · ${selected.label}` : ''}
                </dd>
                <dt>事件名称</dt>
                <dd>{selected.name}</dd>
                <dt>页面</dt>
                <dd>{selected.path}</dd>
                {selected.target && (
                  <>
                    <dt>控件位置</dt>
                    <dd className='font-mono text-xs'>{selected.target}</dd>
                  </>
                )}
                <dt>IP 地址</dt>
                <dd>{selected.ip || '未记录'}</dd>
                <dt>来源站点</dt>
                <dd>{selected.referrer || '直接访问'}</dd>
                <dt>接入方式</dt>
                <dd>
                  {selected.source === 'browser'
                    ? '浏览器（用户身份由业务前端声明）'
                    : '服务端上报'}
                </dd>
              </dl>
              <div className='space-y-4 rounded-lg bg-muted/50 p-4 text-xs leading-6'>
                <div>
                  <p className='font-medium'>访客标识：用于识别重复访问</p>
                  <p className='text-muted-foreground'>
                    同一项目、同一浏览器通常保持一致，用于统计独立访客数（UV）。它不是账号或真实身份；换浏览器、清除存储后会变化，多人共用浏览器也可能共用此标识。
                  </p>
                  <p className='mt-1 font-mono break-all'>{selected.visitor}</p>
                </div>
                <div>
                  <p className='font-medium'>会话标识：用于归组一段连续访问</p>
                  <p className='text-muted-foreground'>
                    将同一访客的一段连续操作关联起来。浏览器采集在 30
                    分钟没有活动后生成新会话，不等于登录会话；不同标签页也可能独立。服务端接入由业务系统划分。
                  </p>
                  <p className='mt-1 font-mono break-all'>{selected.session}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
                <div className='space-y-3 md:hidden'>
                  {data.events.map((event) => (
                    <button
                      key={event.id}
                      type='button'
                      className='w-full rounded-lg border p-3 text-left'
                      onClick={() => setSelected(event)}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
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
                        <Badge variant='secondary' className='shrink-0'>
                          {event.type === 'pageview'
                            ? '页面访问'
                            : actionNames[event.action || ''] || '业务事件'}
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
                <Table className='hidden min-w-[1100px] table-fixed md:table'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-32'>时间（上海）</TableHead>
                      <TableHead className='w-36'>项目</TableHead>
                      <TableHead className='w-44'>业务用户</TableHead>
                      <TableHead className='w-36'>IP 地址</TableHead>
                      <TableHead className='w-64'>操作</TableHead>
                      <TableHead className='w-56'>页面</TableHead>
                      <TableHead className='w-40'>环境</TableHead>
                      <TableHead className='w-20'>
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
                          <Badge variant='secondary'>
                            {event.type === 'pageview'
                              ? '页面访问'
                              : actionNames[event.action || ''] || '业务事件'}
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
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setSelected(event)}
                          >
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      <EventTable key={query} query={query} />
    </VisoraPage>
  )
}
