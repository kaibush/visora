import { type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertCircle, ArrowUpRight, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'

export function VisoraPage({
  title,
  description,
  children,
  action,
}: {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <>
      <Header fixed className='border-b bg-background/95 backdrop-blur'>
        <span className='min-w-0 flex-1 truncate text-sm text-muted-foreground'>
          <span className='hidden sm:inline'>
            工作空间 <span className='mx-2 text-border'>/</span>
          </span>
          <span className='font-medium text-foreground'>{title}</span>
        </span>
        <div className='ms-auto flex shrink-0 items-center gap-2 sm:gap-3'>
          <span className='hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground md:flex'>
            <span className='size-1.5 rounded-full bg-emerald-500' />
            Visora
          </span>
          <ThemeSwitch />
        </div>
      </Header>
      <Main
        className='min-w-0 space-y-5 p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:p-4 md:p-8'
        fluid
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between'>
          <div className='min-w-0'>
            <h1 className='text-xl font-semibold tracking-tight sm:text-2xl'>
              {title}
            </h1>
            <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>
              {description}
            </p>
          </div>
          {action && (
            <div className='w-full shrink-0 sm:w-auto [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto'>
              {action}
            </div>
          )}
        </div>
        {children}
        <footer className='flex flex-wrap justify-between gap-2 border-t pt-5 text-xs text-muted-foreground'>
          <span>Visora · 让每一次访问，都有迹可循</span>
          <span>上海时区 · 访客身份按项目隔离</span>
        </footer>
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
      className='flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5'
    >
      <AlertCircle className='size-5 text-destructive' />
      <p className='flex-1 text-sm'>{error.message}</p>
      <Button variant='outline' onClick={retry}>
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
          <Button asChild className='mt-5' variant='outline'>
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
