import { type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Code2,
  FolderKanban,
  LayoutDashboard,
  Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'

const mobileNav = [
  { to: '/', label: '概览', icon: LayoutDashboard, exact: true },
  { to: '/events', label: '明细', icon: Activity, exact: false },
  { to: '/projects', label: '项目', icon: FolderKanban, exact: false },
  { to: '/integrations', label: '接入', icon: Code2, exact: false },
] as const

export function VisoraMobileNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <nav
      aria-label='主导航'
      className='fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden'
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className='grid grid-cols-4'>
        {mobileNav.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]',
                  active ? 'font-medium text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className='size-5' />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function VisoraPage({
  title,
  children,
  action,
  toolbar,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  toolbar?: ReactNode
}) {
  return (
    <>
      <Header fixed className='border-b bg-background/95 backdrop-blur'>
        <h1 className='min-w-0 flex-1 truncate text-base font-semibold tracking-tight'>
          {title}
        </h1>
        <div className='ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2'>
          {action}
          <ThemeSwitch />
        </div>
      </Header>
      <Main className='flex flex-col gap-3 p-3 md:gap-4 md:p-4' fluid>
        {toolbar}
        {children}
      </Main>
    </>
  )
}

export function ErrorState({
  error,
  retry,
}: {
  error: Error
  retry: () => void
}) {
  return (
    <div
      role='alert'
      className='flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4'
    >
      <AlertCircle className='size-5 text-destructive' />
      <p className='min-w-0 flex-1 text-sm'>{error.message}</p>
      <Button variant='outline' className='min-h-11' onClick={retry}>
        重新加载
      </Button>
    </div>
  )
}

export function EmptyState({
  title = '等待第一条访问记录',
  description = '创建项目并安装采集脚本后，访问数据会自动汇聚到这里。',
  link = true,
}: {
  title?: string
  description?: string
  link?: boolean
}) {
  return (
    <Card className='border-dashed shadow-none'>
      <CardContent className='flex flex-col items-center py-8 text-center'>
        <div className='mb-4 rounded-2xl bg-primary/10 p-3'>
          <Radar className='size-7 text-primary' />
        </div>
        <h3 className='font-semibold'>{title}</h3>
        <p className='mt-2 max-w-md text-sm leading-6 text-muted-foreground'>
          {description}
        </p>
        {link && (
          <Button asChild className='mt-5 min-h-11' variant='outline'>
            <Link to='/projects'>
              接入项目
              <ArrowUpRight className='size-4' />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
