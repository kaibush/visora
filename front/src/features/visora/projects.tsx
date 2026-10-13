import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Clock3,
  Code2,
  KeyRound,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  api,
  formatNumber,
  formatTime,
  projectsQuery,
  type Project,
} from './api'
import { browserSnippet, CodeBlock } from './code-block'
import { ProjectKeyDialog } from './project-key-dialog'
import { EmptyState, ErrorState, VisoraPage } from './shared'

function ProjectEditor({
  project,
  close,
  created,
}: {
  project?: Project
  close: () => void
  created: (result: { project: Project; key: string }) => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [origins, setOrigins] = useState(project?.origins.join('\n') ?? '')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (payload: { name: string; origins: string[] }) =>
      api<{ project: Project; key: string }>(
        project ? `/projects/${project.id}` : '/projects',
        { method: project ? 'PATCH' : 'POST', body: JSON.stringify(payload) }
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['visora'] })
      if (!project) created(result)
      toast.success(project ? '项目设置已保存' : '项目已创建')
      close()
    },
    onError: (error) => setError(error.message),
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    mutation.mutate({
      name,
      origins: origins
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? '编辑项目' : '接入新项目'}</DialogTitle>
          <DialogDescription>
            为每个系统建立独立项目，访问数据自动汇总至 Visora。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='space-y-5'>
          <div className='space-y-2'>
            <Label htmlFor='project-name'>项目名称</Label>
            <Input
              id='project-name'
              placeholder='例如 new-api、grok-iq'
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='project-origins'>允许的网站来源</Label>
            <Textarea
              id='project-origins'
              placeholder={'https://app.example.com\nhttp://localhost:5173'}
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={4}
            />
            <p className='text-xs leading-5 text-muted-foreground'>
              每行一个完整来源，包含协议和端口，不含路径。子域名需单独添加。仅使用服务端接入时可留空。
            </p>
          </div>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={close}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button disabled={mutation.isPending}>
              {mutation.isPending
                ? '保存中…'
                : project
                  ? '保存设置'
                  : '创建项目'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const touchMenuQuery = '(max-width: 767px), (pointer: coarse)'

function useTouchMenu() {
  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia(touchMenuQuery)
      query.addEventListener('change', callback)
      return () => query.removeEventListener('change', callback)
    },
    () => window.matchMedia(touchMenuQuery).matches,
    () => false
  )
}

function ProjectActions({
  name,
  enabled,
  pending,
  onEdit,
  onRotate,
  onToggle,
  onDelete,
}: {
  name: string
  enabled: boolean
  pending: boolean
  onEdit: () => void
  onRotate: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const touchMenu = useTouchMenu()
  const [open, setOpen] = useState(false)
  const label = `${name} 项目操作`
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }
  const items = [
    {
      label: '编辑设置',
      icon: Pencil,
      action: onEdit,
      destructive: false,
    },
    {
      label: '轮换服务端密钥',
      icon: KeyRound,
      action: onRotate,
      destructive: false,
    },
    {
      label: enabled ? '暂停采集' : '恢复采集',
      icon: enabled ? Pause : Play,
      action: onToggle,
      destructive: false,
    },
    {
      label: '删除项目',
      icon: Trash2,
      action: onDelete,
      destructive: true,
    },
  ]
  if (touchMenu) {
    return (
      <>
        <Button
          variant='ghost'
          size='icon'
          className='size-11 shrink-0'
          aria-label={label}
          aria-haspopup='dialog'
          onClick={() => setOpen(true)}
        >
          <MoreHorizontal className='size-4' />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side='bottom'
            className='rounded-t-2xl px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'
          >
            <SheetHeader className='px-2 text-left'>
              <SheetTitle className='truncate'>{name}</SheetTitle>
              <SheetDescription>项目操作</SheetDescription>
            </SheetHeader>
            <div className='grid gap-1 pb-2'>
              {items.map((item) => (
                <Button
                  key={item.label}
                  variant='ghost'
                  className={`h-12 justify-start px-3 ${item.destructive ? 'text-destructive hover:text-destructive' : ''}`}
                  disabled={pending}
                  onClick={() => run(item.action)}
                >
                  <item.icon className='size-4' />
                  {item.label}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-11 shrink-0 md:size-8'
          aria-label={label}
        >
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuGroup>
          {items.slice(0, -1).map((item) => (
            <DropdownMenuItem
              key={item.label}
              disabled={pending}
              onClick={item.action}
            >
              <item.icon className='size-4' />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant='destructive'
            disabled={pending}
            onClick={items[items.length - 1]?.action}
          >
            <Trash2 className='size-4' />
            删除项目
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function VisoraProjects() {
  const queryClient = useQueryClient()
  const { data, error, isPending, refetch } = useQuery(projectsQuery)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Project | 'new' | null>(null)
  const [credentials, setCredentials] = useState<{
    project: Project
    key?: string
  } | null>(null)
  const [install, setInstall] = useState<Project | null>(null)
  const [rotate, setRotate] = useState<Project | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Project | null>(null)
  const update = useMutation({
    mutationFn: (project: Project) =>
      api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !project.enabled }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visora'] })
      toast.success('采集状态已更新')
    },
    onError: (error) => toast.error(error.message),
  })
  const rotateKey = useMutation({
    mutationFn: (project: Project) =>
      api<{ key: string }>(`/projects/${project.id}/rotate-key`, {
        method: 'POST',
      }),
    onSuccess: (data, project) => {
      setCredentials({ project, key: data.key })
      setRotate(null)
      void queryClient.invalidateQueries({ queryKey: ['visora', 'projects'] })
    },
    onError: (error) => toast.error(error.message),
  })
  const remove = useMutation({
    mutationFn: (project: Project) =>
      api(`/projects/${project.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRemoveTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['visora'] })
      toast.success('项目已删除')
    },
    onError: (error) => toast.error(error.message),
  })
  const projects =
    data?.projects.filter((p) =>
      `${p.name} ${p.origins.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) ?? []
  return (
    <VisoraPage
      title='项目管理'
      action={
        <Button className='h-11 px-3 md:h-8' onClick={() => setEditor('new')}>
          <Plus className='size-4' />
          <span className='max-sm:sr-only'>新建项目</span>
        </Button>
      }
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            全部项目
            <Badge variant='secondary'>{data?.projects.length ?? 0}</Badge>
          </div>
          <span className='text-xs text-muted-foreground'>
            {data?.projects.filter((p) => p.enabled).length ?? 0} 个已启用
          </span>
        </div>
        <div className='relative w-full sm:w-72'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            aria-label='搜索项目'
            placeholder='搜索项目或域名…'
            className='h-11 pl-9 md:h-9'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && (
        <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4'>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className='h-64 rounded-xl md:h-60' />
          ))}
        </div>
      )}
      {data && !projects.length && (
        <EmptyState
          title={search ? '没有匹配的项目' : '从第一个项目开始'}
          description={
            search
              ? '尝试搜索其他名称或域名。'
              : '点击「新建项目」，为 new-api、grok-iq 或其他系统创建统一统计入口。'
          }
          link={false}
        />
      )}
      <div className='grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4'>
        {projects.map((project) => (
          <Card
            key={project.id}
            role='article'
            aria-label={`${project.name} 项目`}
            className='gap-5 py-0'
          >
            <CardHeader className='flex flex-row items-center gap-3 px-5 pt-5'>
              <div
                aria-hidden='true'
                className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-base font-semibold text-info'
              >
                {project.name.slice(0, 1).toUpperCase()}
              </div>
              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <CardTitle
                  role='heading'
                  aria-level={2}
                  className='truncate text-base'
                  title={project.name}
                >
                  {project.name}
                </CardTitle>
                <CardDescription
                  className='flex min-w-0 items-center gap-2 text-xs'
                  title={project.origins.join('\n') || '仅服务端接入'}
                >
                  <span className='truncate'>
                    {project.origins.length
                      ? project.origins[0].replace(/^https?:\/\//, '')
                      : '仅服务端接入'}
                  </span>
                  {project.origins.length > 1 && (
                    <span
                      className='shrink-0'
                      aria-label={`另有 ${project.origins.length - 1} 个来源`}
                    >
                      +{project.origins.length - 1}
                    </span>
                  )}
                </CardDescription>
              </div>
              <ProjectActions
                name={project.name}
                enabled={project.enabled}
                pending={update.isPending || remove.isPending}
                onEdit={() => setEditor(project)}
                onRotate={() => setRotate(project)}
                onToggle={() => update.mutate(project)}
                onDelete={() => setRemoveTarget(project)}
              />
            </CardHeader>
            <CardContent className='flex flex-col gap-3 px-5'>
              <div className='flex flex-wrap items-end justify-between gap-3'>
                <dl className='flex min-w-0 flex-col gap-1.5'>
                  <dt className='text-xs text-muted-foreground'>
                    保留期内事件
                  </dt>
                  <dd className='text-3xl leading-none font-semibold tracking-tight tabular-nums'>
                    {formatNumber(project.totalEvents)}
                  </dd>
                </dl>
                <Badge
                  variant={
                    !project.enabled
                      ? 'outline'
                      : project.lastEvent
                        ? 'success'
                        : 'warning'
                  }
                >
                  {!project.enabled
                    ? '已暂停'
                    : project.lastEvent
                      ? '已收到数据'
                      : '等待接入'}
                </Badge>
              </div>
              <p
                className='flex items-center gap-1.5 text-xs text-muted-foreground'
                title='时间按上海时区显示'
              >
                <Clock3 aria-hidden='true' className='size-3.5 shrink-0' />
                <span className='flex flex-wrap gap-x-1'>
                  {project.lastEvent ? (
                    <>
                      最近访问
                      <time
                        dateTime={new Date(project.lastEvent).toISOString()}
                      >
                        {formatTime(project.lastEvent)}
                      </time>
                      <span className='sr-only'>上海时间</span>
                    </>
                  ) : (
                    '尚未收到访问数据'
                  )}
                </span>
              </p>
            </CardContent>
            <CardFooter className='mx-5 mt-auto grid grid-cols-2 gap-2 border-t px-0 py-2 [.border-t]:pt-2'>
              <Button
                variant='link'
                size='sm'
                className='h-11 min-w-0 md:h-9'
                onClick={() => setInstall(project)}
              >
                <Code2 data-icon='inline-start' />
                <span className='truncate'>接入代码</span>
              </Button>
              <Button
                variant='ghost'
                size='sm'
                className='h-11 min-w-0 md:h-9'
                onClick={() => setCredentials({ project })}
              >
                <KeyRound data-icon='inline-start' />
                <span className='truncate'>查看密钥</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      {editor && (
        <ProjectEditor
          project={editor === 'new' ? undefined : editor}
          close={() => setEditor(null)}
          created={setCredentials}
        />
      )}
      {credentials && (
        <ProjectKeyDialog
          key={credentials.project.id}
          project={credentials.project}
          initialKey={credentials.key}
          close={() => setCredentials(null)}
          rotate={() => {
            setRotate(credentials.project)
            setCredentials(null)
          }}
        />
      )}
      <Dialog
        open={!!install}
        onOpenChange={(open) => {
          if (!open) setInstall(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>接入 {install?.name}</DialogTitle>
            <DialogDescription>
              将脚本添加到页面的 &lt;head&gt;
              中即可记录匿名访问；需要登录用户详情时，按通用接入指南同步用户状态。
            </DialogDescription>
          </DialogHeader>
          {install && (
            <>
              <CodeBlock
                label='HTML · 公开站点 ID'
                code={browserSnippet(install.siteId)}
              />
              <p className='text-xs leading-6 text-muted-foreground'>
                已允许来源：
                {install.origins.join('、') ||
                  '未配置，请先编辑项目添加网站来源'}
                <br />
                安装后打开目标网站，再返回访问明细查看第一条数据。
              </p>
              <Button asChild variant='outline'>
                <Link to='/integrations'>
                  查看通用接入指南
                  <ArrowUpRight className='size-4' />
                </Link>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoveTarget(null)
        }}
        title='删除项目？'
        desc={
          removeTarget
            ? `将永久删除「${removeTarget.name}」及其 ${formatNumber(removeTarget.totalEvents)} 条访问记录，无法恢复。已接入的网站和密钥会立即失效。`
            : ''
        }
        cancelBtnText='取消'
        confirmText='删除项目'
        destructive
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (removeTarget) remove.mutate(removeTarget)
        }}
      />
      <ConfirmDialog
        open={!!rotate}
        onOpenChange={(open) => {
          if (!open) setRotate(null)
        }}
        title='轮换服务端密钥？'
        desc='旧密钥将立即失效。使用该密钥的服务需要更新环境变量；网页采集脚本不受影响。'
        cancelBtnText='取消'
        confirmText='生成新密钥'
        isLoading={rotateKey.isPending}
        handleConfirm={() => {
          if (rotate) rotateKey.mutate(rotate)
        }}
      />
    </VisoraPage>
  )
}
