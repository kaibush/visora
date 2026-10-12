import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Download, Layers, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectsQuery } from './api'

const date = (offset = 0) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
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
  return { ...context, query: new URLSearchParams(context.filter).toString() }
}

export function AnalyticsFilters({
  refresh,
  fetching,
}: {
  refresh: () => void
  fetching: boolean
}) {
  const { filter, setFilter, query } = useAnalyticsFilter()
  const { data } = useQuery(projectsQuery)
  const [custom, setCustom] = useState(false)
  const range =
    !custom && filter.to === date()
      ? ([1, 7, 30]
          .find((days) => filter.from === date(1 - days))
          ?.toString() ?? 'custom')
      : 'custom'
  const [draftUser, setDraftUser] = useState(filter.userId)
  const [exporting, setExporting] = useState(false)
  const [draft, setDraft] = useState({ from: filter.from, to: filter.to })

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

  return (
    <div className='flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3'>
      <Select
        value={filter.project}
        onValueChange={(project) => setFilter({ ...filter, project })}
      >
        <SelectTrigger className='w-full sm:w-48' aria-label='筛选项目'>
          <Layers className='size-4 text-muted-foreground' />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>全部项目</SelectItem>
          {data?.projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={range}
        onValueChange={(value) => {
          setCustom(value === 'custom')
          if (value !== 'custom')
            setFilter({ ...filter, from: date(1 - Number(value)), to: date() })
          else setDraft({ from: filter.from, to: filter.to })
        }}
      >
        <SelectTrigger className='w-40' aria-label='日期范围'>
          <CalendarDays className='size-4 text-muted-foreground' />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='1'>今天</SelectItem>
          <SelectItem value='7'>最近 7 天</SelectItem>
          <SelectItem value='30'>最近 30 天</SelectItem>
          <SelectItem value='custom'>自定义日期</SelectItem>
        </SelectContent>
      </Select>
      {range === 'custom' && (
        <form
          className='flex flex-wrap items-center gap-2'
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
          <Label className='sr-only' htmlFor='range-from'>
            开始日期
          </Label>
          <Input
            id='range-from'
            type='date'
            className='w-40'
            required
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
          <span className='text-muted-foreground'>至</span>
          <Label className='sr-only' htmlFor='range-to'>
            结束日期
          </Label>
          <Input
            id='range-to'
            type='date'
            className='w-40'
            required
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
          <Button variant='secondary' size='sm'>
            应用
          </Button>
        </form>
      )}
      <form
        className='flex w-full flex-wrap items-center gap-2 sm:w-auto'
        onSubmit={(event) => {
          event.preventDefault()
          setFilter({ ...filter, userId: draftUser.trim() })
        }}
      >
        <Input
          aria-label='用户 ID'
          placeholder='按用户 ID 精确筛选'
          className='w-44'
          maxLength={128}
          value={draftUser}
          onChange={(event) => setDraftUser(event.target.value)}
        />
        <Button type='submit' variant='secondary' size='sm'>
          筛选用户
        </Button>
        {filter.userId && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              setDraftUser('')
              setFilter({ ...filter, userId: '' })
            }}
          >
            清除用户筛选
          </Button>
        )}
      </form>
      <span className='hidden text-xs text-muted-foreground xl:inline'>
        {filter.from} — {filter.to} · UTC
      </span>
      <div className='ms-auto flex gap-2'>
        <Button
          variant='ghost'
          size='icon'
          onClick={refresh}
          disabled={fetching}
          aria-label='刷新数据'
        >
          <RefreshCw className={fetching ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
        <Button variant='outline' onClick={exportCsv} disabled={exporting}>
          <Download className='size-4' />
          <span className='hidden sm:inline'>
            {exporting ? '导出中…' : '导出 CSV'}
          </span>
        </Button>
      </div>
    </div>
  )
}
