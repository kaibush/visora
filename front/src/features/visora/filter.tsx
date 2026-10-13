import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  Download,
  Layers,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { projectsQuery } from './api'
import { useMinWidth } from './use-min-width'

const date = (offset = 0) =>
  new Date(Date.now() + offset * 86400000 + 8 * 3600000)
    .toISOString()
    .slice(0, 10)
type Filter = { project: string; from: string; to: string; userId: string }
const FilterContext = createContext<{
  filter: Filter
  setFilter: (filter: Filter) => void
} | null>(null)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>({
    project: 'all',
    userId: '',
    from: date(-6),
    to: date(),
  })
  return <FilterContext value={{ filter, setFilter }}>{children}</FilterContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalyticsFilter() {
  const context = useContext(FilterContext)
  if (!context) throw new Error('AnalyticsProvider is required')
  return {
    ...context,
    query: new URLSearchParams({
      ...context.filter,
      timezone: 'Asia/Shanghai',
    }).toString(),
  }
}

export function AnalyticsFilters({
  refresh,
  fetching,
}: {
  refresh: () => void
  fetching: boolean
}) {
  const desktop = useMinWidth(768)
  const { filter, setFilter, query } = useAnalyticsFilter()
  const { data } = useQuery(projectsQuery)
  const [custom, setCustom] = useState(false)
  const [open, setOpen] = useState(false)
  const range =
    !custom && filter.to === date()
      ? ([1, 7, 30]
          .find((days) => filter.from === date(1 - days))
          ?.toString() ?? 'custom')
      : 'custom'
  const [draftUser, setDraftUser] = useState(filter.userId)
  const [exporting, setExporting] = useState(false)
  const [draft, setDraft] = useState({ from: filter.from, to: filter.to })
  const projectName =
    filter.project === 'all'
      ? '全部项目'
      : (data?.projects.find((project) => project.id === filter.project)
          ?.name ?? '项目')
  const rangeLabel =
    range === '1'
      ? '今天'
      : range === '7'
        ? '最近 7 天'
        : range === '30'
          ? '最近 30 天'
          : `${filter.from} 至 ${filter.to}`

  async function exportCsv() {
    setExporting(true)
    try {
      const response = await fetch(`/api/export?${query}`)
      if (!response.ok)
        throw new Error((await response.json()).error || '导出失败')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `visora-${filter.from}-${filter.to}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('访问明细已导出')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  function controls(prefix: string, stacked: boolean) {
    return (
      <>
        <Select
          value={filter.project}
          onValueChange={(project) => setFilter({ ...filter, project })}
        >
          <SelectTrigger
            className={stacked ? 'h-11 w-full' : 'h-9 w-44'}
            aria-label='筛选项目'
          >
            <Layers className='size-4 text-muted-foreground' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='all'>全部项目</SelectItem>
              {data?.projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={range}
          onValueChange={(value) => {
            setCustom(value === 'custom')
            if (value !== 'custom')
              setFilter({
                ...filter,
                from: date(1 - Number(value)),
                to: date(),
              })
            else setDraft({ from: filter.from, to: filter.to })
          }}
        >
          <SelectTrigger
            className={stacked ? 'h-11 w-full' : 'h-9 w-36'}
            aria-label='日期范围'
          >
            <CalendarDays className='size-4 text-muted-foreground' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='1'>今天</SelectItem>
              <SelectItem value='7'>最近 7 天</SelectItem>
              <SelectItem value='30'>最近 30 天</SelectItem>
              <SelectItem value='custom'>自定义日期</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {range === 'custom' && (
          <form
            className={
              stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'
            }
            onSubmit={(event) => {
              event.preventDefault()
              const days =
                (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000
              if (!Number.isFinite(days) || days < 0 || days > 365) {
                toast.error('请选择 1–366 天的有效日期范围')
                return
              }
              setFilter({ ...filter, ...draft })
            }}
          >
            <Label className='sr-only' htmlFor={`${prefix}-from`}>
              开始日期
            </Label>
            <Input
              id={`${prefix}-from`}
              type='date'
              className={stacked ? 'h-11 w-full' : 'h-9 w-36'}
              required
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
            <span className='text-center text-muted-foreground'>至</span>
            <Label className='sr-only' htmlFor={`${prefix}-to`}>
              结束日期
            </Label>
            <Input
              id={`${prefix}-to`}
              type='date'
              className={stacked ? 'h-11 w-full' : 'h-9 w-36'}
              required
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
            <Button variant='secondary' className={stacked ? 'h-11' : 'h-9'}>
              应用
            </Button>
          </form>
        )}
        <form
          className={
            stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'
          }
          onSubmit={(event) => {
            event.preventDefault()
            setFilter({ ...filter, userId: draftUser.trim() })
          }}
        >
          <Input
            aria-label='用户 ID'
            placeholder='用户 ID'
            className={stacked ? 'h-11 w-full' : 'h-9 w-36'}
            maxLength={128}
            value={draftUser}
            onChange={(event) => setDraftUser(event.target.value)}
          />
          <Button
            type='submit'
            variant='secondary'
            className={stacked ? 'h-11' : 'h-9'}
          >
            筛选用户
          </Button>
          {filter.userId && (
            <Button
              type='button'
              variant='ghost'
              className={stacked ? 'h-11' : 'h-9'}
              onClick={() => {
                setDraftUser('')
                setFilter({ ...filter, userId: '' })
              }}
            >
              清除
            </Button>
          )}
        </form>
      </>
    )
  }

  return (
    <>
      {desktop ? (
        <div className='flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-card px-2 py-2'>
          {controls('desk', false)}
          <span className='hidden text-xs text-muted-foreground xl:inline'>
            {filter.from} — {filter.to}
          </span>
          <div className='ms-auto flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              onClick={refresh}
              disabled={fetching}
              aria-label='刷新数据'
            >
              <RefreshCw
                className={fetching ? 'size-4 animate-spin' : 'size-4'}
              />
            </Button>
            <Button
              variant='outline'
              className='h-9'
              onClick={exportCsv}
              disabled={exporting}
            >
              <Download className='size-4' />
              {exporting ? '导出中…' : '导出'}
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            className='h-11 min-w-0 flex-1 justify-start px-3'
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal className='size-4 shrink-0' />
            <span className='truncate'>
              {projectName} · {rangeLabel}
              {filter.userId ? ` · ${filter.userId}` : ''}
            </span>
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-11'
            onClick={refresh}
            disabled={fetching}
            aria-label='刷新数据'
          >
            <RefreshCw
              className={fetching ? 'size-4 animate-spin' : 'size-4'}
            />
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-11'
            onClick={exportCsv}
            disabled={exporting}
            aria-label={exporting ? '导出中' : '导出 CSV'}
          >
            <Download className='size-4' />
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side='bottom'
              className='max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
            >
              <SheetHeader>
                <SheetTitle>筛选</SheetTitle>
                <SheetDescription>
                  项目、日期和用户。时间按上海时区。
                </SheetDescription>
              </SheetHeader>
              <div className='flex flex-col gap-3 px-4 pb-4'>
                {controls('sheet', true)}
                <Button className='h-11' onClick={() => setOpen(false)}>
                  完成
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  )
}
