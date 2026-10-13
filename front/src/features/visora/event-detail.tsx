import { type ReactNode } from 'react'
import {
  Clock3,
  Copy,
  Fingerprint,
  Globe2,
  Monitor,
  Server,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime, type VisitEvent } from './api'
import { eventKind } from './event-kind'
import { IconBadge, PanelTitle } from './visuals'

function DetailField({
  label,
  children,
  mono = false,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd
        className={
          mono
            ? 'font-mono text-xs leading-6 [overflow-wrap:anywhere]'
            : 'text-sm leading-6 [overflow-wrap:anywhere]'
        }
      >
        {children}
      </dd>
    </div>
  )
}

function IdentityValue({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className='rounded-xl border bg-muted/25 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm font-medium'>{label}</p>
        <Button
          variant='ghost'
          size='sm'
          aria-label={`复制${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              toast.success(`${label}已复制`)
            } catch {
              toast.error('无法复制，请手动选中标识')
            }
          }}
        >
          <Copy data-icon='inline-start' />
          复制
        </Button>
      </div>
      <p className='mt-1 font-mono text-xs leading-6 [overflow-wrap:anywhere] select-all'>
        {value}
      </p>
      <p className='mt-2 text-xs leading-5 text-muted-foreground'>
        {description}
      </p>
    </div>
  )
}

export function EventDetail({
  event,
  close,
  returnFocus,
}: {
  event: VisitEvent | null
  close: () => void
  returnFocus: HTMLElement | null
}) {
  const kind = event ? eventKind(event) : null
  return (
    <Dialog
      open={event !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        variant='detail'
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocus?.focus()
        }}
      >
        {event && kind && (
          <>
            <DialogHeader className='shrink-0 gap-4 border-b bg-info/5 p-5 pe-14 sm:p-6 sm:pe-16'>
              <div className='flex items-center gap-3'>
                <IconBadge icon={kind.icon} tone={kind.tone} size='lg' />
                <div className='flex min-w-0 flex-col gap-2'>
                  <DialogTitle>访问详情</DialogTitle>
                  <DialogDescription className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
                    <span className='max-w-56 truncate'>
                      {event.project_name}
                    </span>
                    <span aria-hidden='true'>·</span>
                    <span>{formatTime(event.occurred_at)} · 上海时间</span>
                  </DialogDescription>
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={kind.variant}>{kind.label}</Badge>
                <Badge variant='outline'>
                  {event.source === 'browser' ? <Monitor /> : <Server />}
                  {event.source === 'browser' ? '浏览器采集' : '服务端上报'}
                </Badge>
              </div>
            </DialogHeader>
            <Tabs
              key={event.id}
              defaultValue='overview'
              className='min-h-0 gap-0 overflow-hidden'
            >
              <TabsList className='mx-5 my-4 h-10 w-auto shrink-0 sm:mx-6'>
                <TabsTrigger value='overview'>
                  <Globe2 />
                  访问概况
                </TabsTrigger>
                <TabsTrigger value='identity'>
                  <Fingerprint />
                  身份与会话
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value='overview'
                className='min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6'
              >
                <div className='flex flex-col gap-5'>
                  <div className='flex flex-col gap-3 rounded-xl border bg-muted/25 p-4'>
                    <p className='text-xs text-muted-foreground'>
                      访问页面{event.type === 'event' ? '与操作' : ''}
                    </p>
                    {event.type === 'event' && (
                      <p className='text-base font-semibold [overflow-wrap:anywhere]'>
                        {event.label || event.name}
                      </p>
                    )}
                    <p className='font-mono text-sm leading-6 [overflow-wrap:anywhere]'>
                      {event.path || '/'}
                    </p>
                    {event.target && (
                      <details className='text-xs'>
                        <summary className='cursor-pointer py-1 text-info'>
                          查看控件位置
                        </summary>
                        <p className='mt-2 font-mono leading-5 [overflow-wrap:anywhere] select-all'>
                          {event.target}
                        </p>
                      </details>
                    )}
                  </div>
                  <dl className='grid grid-cols-2 gap-x-5 gap-y-5'>
                    <DetailField label='事件名称' mono>
                      {event.name}
                    </DetailField>
                    <DetailField label='来源站点'>
                      {event.referrer || '直接访问'}
                    </DetailField>
                    <DetailField label='IP 地址' mono>
                      {event.ip || '未记录'}
                    </DetailField>
                    <DetailField label='访问用户'>
                      {event.user_name || event.user_id || '匿名访客'}
                    </DetailField>
                  </dl>
                  <section className='border-t pt-4'>
                    <h3 className='mb-4 text-sm font-medium'>
                      <PanelTitle icon={Monitor} tone='teal'>
                        访问环境
                      </PanelTitle>
                    </h3>
                    <dl className='grid grid-cols-2 gap-x-5 gap-y-4'>
                      <DetailField label='浏览器'>
                        {event.browser || '未知'}
                      </DetailField>
                      <DetailField label='操作系统'>
                        {event.os || '未知'}
                      </DetailField>
                      <DetailField label='设备类型'>
                        {(
                          {
                            desktop: '电脑',
                            mobile: '手机',
                            tablet: '平板',
                          } as Record<string, string>
                        )[event.device.toLowerCase()] ||
                          event.device ||
                          '未知'}
                      </DetailField>
                      <DetailField label='语言'>
                        {event.language || '未记录'}
                      </DetailField>
                    </dl>
                  </section>
                </div>
              </TabsContent>
              <TabsContent
                value='identity'
                className='min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6'
              >
                <div className='flex flex-col gap-5'>
                  <section>
                    <h3 className='mb-4 text-sm font-medium'>
                      <PanelTitle icon={UserRound} tone='violet'>
                        业务用户
                      </PanelTitle>
                    </h3>
                    <dl className='grid grid-cols-2 gap-4'>
                      <DetailField label='用户名称'>
                        {event.user_name || '匿名访客'}
                      </DetailField>
                      <DetailField label='用户 ID' mono>
                        {event.user_id || '未提供'}
                      </DetailField>
                      <DetailField label='邮箱'>
                        {event.user_email || '未提供'}
                      </DetailField>
                    </dl>
                  </section>
                  <IdentityValue
                    label='访客标识'
                    value={event.visitor}
                    description='用于识别同一浏览器的重复访问、统计 UV；不代表登录账号。'
                  />
                  <IdentityValue
                    label='会话标识'
                    value={event.session}
                    description='用于关联一段连续访问；浏览器采集在 30 分钟无活动后开启新会话。'
                  />
                  <p className='text-xs leading-5 text-muted-foreground'>
                    {event.source === 'browser'
                      ? '用户身份由接入网站提供，Visora 不读取网站的登录状态。'
                      : '用户身份与会话标识由接入服务提供。'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            <div className='flex shrink-0 items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3 sm:px-6'>
              <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Clock3 className='size-3.5' />
                记录 #{event.id}
              </span>
              <Button variant='secondary' onClick={close}>
                完成
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
