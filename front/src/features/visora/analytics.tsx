import { Link, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const sections: {
  id: AnalysisView
  label: string
  title: string
  description: string
}[] = [
  {
    id: 'overview',
    label: '概览',
    title: '访问概览',
    description:
      '每一个项目的访问表现，一目了然。趋势、页面、来源、受众和行为都在这一页切换。',
  },
  {
    id: 'trends',
    label: '趋势',
    title: '访问趋势',
    description:
      '用柱状图看每天的浏览量和访客。点击某一天可以下钻到小时、页面和来源；选择单个项目后只看该系统。',
  },
  {
    id: 'pages',
    label: '页面',
    title: '页面分析',
    description:
      '查看哪些页面被访问。点击页面可下钻每日趋势、来源，以及它属于哪个系统。',
  },
  {
    id: 'sources',
    label: '来源',
    title: '来源分析',
    description:
      '查看访客从哪里进入。没有来源时记为直接访问。点击来源可看到落地页和每天的变化。',
  },
  {
    id: 'audience',
    label: '受众',
    title: '受众环境',
    description:
      '按设备、浏览器、系统和语言查看访客。新访客与回访按项目分别计算，不会把其他系统的历史访问算进来。',
  },
  {
    id: 'behavior',
    label: '行为',
    title: '交互行为',
    description:
      '自动记录点击、切换和提交，以及各系统手动上报的业务结果。这里只记录操作名称，不记录输入内容。',
  },
]

function AnalysisNav({ current }: { current: AnalysisView }) {
  return (
    <div className='-mx-1 overflow-x-auto'>
      <nav
        aria-label='分析内容'
        className='flex w-max min-w-full gap-1 rounded-xl bg-muted p-1'
      >
        {sections.map((item) => {
          const active = item.id === current
          return (
            <Link
              key={item.id}
              to='/'
              search={{ view: item.id === 'overview' ? undefined : item.id }}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm whitespace-nowrap ${
                active
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function VisoraAnalytics() {
  const { view } = useSearch({ from: '/_authenticated/' })
  const current = view ?? 'overview'
  const section = sections.find((item) => item.id === current) ?? sections[0]
  return (
    <VisoraPage
      title={section.title}
      description={section.description}
      action={
        current === 'overview' ? (
          <Button asChild>
            <Link to='/projects'>
              <Plus className='size-4' />
              接入项目
            </Link>
          </Button>
        ) : undefined
      }
    >
      <AnalysisNav current={current} />
      {current === 'overview' && <OverviewPanel />}
      {current === 'trends' && <VisoraTrends />}
      {current === 'pages' && <VisoraPages />}
      {current === 'sources' && <VisoraSources />}
      {current === 'audience' && <VisoraAudience />}
      {current === 'behavior' && <VisoraBehavior />}
    </VisoraPage>
  )
}
