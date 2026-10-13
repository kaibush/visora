import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type AnalysisView } from './analysis-views'
import {
  VisoraAudience,
  VisoraBehavior,
  VisoraPages,
  VisoraSources,
  VisoraTrends,
} from './explore'
import { OverviewPanel } from './overview'
import { VisoraPage } from './shared'
import { useMinWidth } from './use-min-width'

const sections: { id: AnalysisView; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'trends', label: '趋势' },
  { id: 'pages', label: '页面' },
  { id: 'sources', label: '来源' },
  { id: 'audience', label: '受众' },
  { id: 'behavior', label: '行为' },
]

function AnalysisSwitch({ current }: { current: AnalysisView }) {
  const desktop = useMinWidth(768)
  const navigate = useNavigate()
  if (!desktop) {
    return (
      <Select
        value={current}
        onValueChange={(value) =>
          void navigate({
            to: '/',
            search: {
              view: value === 'overview' ? undefined : (value as AnalysisView),
            },
          })
        }
      >
        <SelectTrigger className='h-11 w-full' aria-label='分析内容'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {sections.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }
  return (
    <nav aria-label='分析内容' className='flex flex-wrap gap-1'>
      {sections.map((item) => {
        const active = item.id === current
        return (
          <Link
            key={item.id}
            to='/'
            search={{ view: item.id === 'overview' ? undefined : item.id }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center rounded-md px-3 text-sm',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function VisoraAnalytics() {
  const { view } = useSearch({ from: '/_authenticated/' })
  const current = view ?? 'overview'
  return (
    <VisoraPage
      title='访问分析'
      toolbar={<AnalysisSwitch current={current} />}
      action={
        current === 'overview' ? (
          <Button asChild className='h-11 px-3 md:h-8'>
            <Link to='/projects'>
              <Plus className='size-4' />
              <span className='max-sm:sr-only'>接入项目</span>
            </Link>
          </Button>
        ) : undefined
      }
    >
      {current === 'overview' && <OverviewPanel />}
      {current === 'trends' && <VisoraTrends />}
      {current === 'pages' && <VisoraPages />}
      {current === 'sources' && <VisoraSources />}
      {current === 'audience' && <VisoraAudience />}
      {current === 'behavior' && <VisoraBehavior />}
    </VisoraPage>
  )
}
