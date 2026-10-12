import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Code2,
  Globe2,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function VisoraProjects() {
  const queryClient = useQueryClient()
  const { data, error, isPending, refetch } = useQuery(projectsQuery)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Project | 'new' | null>(null)
  const [credentials, setCredentials] = useState<{
    project: Project
    key: string
  } | null>(null)
  const [install, setInstall] = useState<Project | null>(null)
  const [rotate, setRotate] = useState<Project | null>(null)
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
  const projects =
    data?.projects.filter((p) =>
      `${p.name} ${p.origins.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) ?? []
  return (
    <VisoraPage
      title='项目管理'
      description='一个工作空间，连接你的所有产品与服务。'
      action={
        <Button onClick={() => setEditor('new')}>
          <Plus className='size-4' />
          新建项目
        </Button>
      }
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <span className='font-medium text-foreground'>
            {data?.projects.length ?? 0}
          </span>{' '}
          个项目<span className='mx-2 text-border'>|</span>
          <span className='size-1.5 rounded-full bg-emerald-500' />
          {data?.projects.filter((p) => p.enabled).length ?? 0} 个已启用
        </div>
        <div className='relative w-full sm:w-72'>
          <Search className='absolute top-3 left-3 size-4 text-muted-foreground' />
          <Input
            aria-label='搜索项目'
            placeholder='搜索项目或域名…'
            className='pl-9'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error && <ErrorState error={error} retry={() => void refetch()} />}
      {isPending && (
        <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className='h-64 rounded-xl' />
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
      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {projects.map((project) => (
          <Card key={project.id} className='gap-5 shadow-none'>
            <CardHeader className='flex flex-row items-start gap-3'>
              <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary'>
                {project.name.slice(0, 1).toUpperCase()}
              </div>
              <div className='min-w-0 flex-1 space-y-2'>
                <CardTitle className='truncate text-base' title={project.name}>
                  {project.name}
                </CardTitle>
                <Badge
                  variant='outline'
                  className='gap-1.5 text-[11px] font-normal'
                >
                  <span
                    className={`size-1.5 rounded-full ${!project.enabled ? 'bg-slate-400' : project.lastEvent ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  {!project.enabled
                    ? '已暂停'
                    : project.lastEvent
                      ? '已收到数据'
                      : '等待接入'}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-8'
                    aria-label={`${project.name} 项目操作`}
                  >
                    <MoreHorizontal className='size-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem onClick={() => setEditor(project)}>
                    <Pencil className='size-4' />
                    编辑设置
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRotate(project)}>
                    <KeyRound className='size-4' />
                    轮换服务端密钥
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={update.isPending}
                    onClick={() => update.mutate(project)}
                  >
                    {project.enabled ? '暂停采集' : '恢复采集'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Globe2 className='size-3.5 shrink-0' />
                <span className='truncate' title={project.origins.join(', ')}>
                  {project.origins.length
                    ? project.origins.join(', ')
                    : '仅服务端接入'}
                </span>
              </div>
              <div className='grid grid-cols-2 gap-4 border-t pt-4'>
                <div>
                  <p className='text-xs text-muted-foreground'>保留期内事件</p>
                  <p className='mt-1 text-xl font-semibold tabular-nums'>
                    {formatNumber(project.totalEvents)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>
                    最近访问 · UTC
                  </p>
                  <p className='mt-2 text-xs'>
                    {formatTime(project.lastEvent)}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className='gap-2'>
              <Button
                variant='outline'
                className='flex-1'
                onClick={() => setInstall(project)}
              >
                <Code2 className='size-4' />
                接入代码
              </Button>
              <Button
                variant='ghost'
                size='icon'
                aria-label={`编辑 ${project.name}`}
                onClick={() => setEditor(project)}
              >
                <Pencil className='size-4' />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className='flex flex-wrap items-center gap-4 rounded-xl border bg-muted/30 p-5'>
        <ShieldCheck className='size-6 text-primary' />
        <div className='flex-1 space-y-1'>
          <p className='text-sm font-medium'>
            每个项目独立采集，所有数据统一查看
          </p>
          <p className='text-xs leading-5 text-muted-foreground'>
            浏览器使用公开站点
            ID，服务端使用独立密钥。暂停项目后，两种接入方式都会停止接受新事件。
          </p>
        </div>
        <Button variant='ghost' asChild>
          <Link to='/integrations'>
            接入指南
            <ArrowUpRight className='size-4' />
          </Link>
        </Button>
      </div>
      {editor && (
        <ProjectEditor
          project={editor === 'new' ? undefined : editor}
          close={() => setEditor(null)}
          created={setCredentials}
        />
      )}
      <Dialog
        open={!!credentials}
        onOpenChange={(open) => {
          if (!open) setCredentials(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              保存 {credentials?.project.name} 的服务端密钥
            </DialogTitle>
            <DialogDescription>
              密钥只在此处展示一次，请保存到服务端环境变量。关闭后无法重新查看，可通过轮换生成新密钥。
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <CodeBlock
              label='VISORA_SERVER_KEY · 仅服务端使用'
              code={credentials.key}
            />
          )}
          <p className='text-xs text-muted-foreground'>
            网页脚本不需要此密钥。请勿将密钥放入前端源码。
          </p>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
              将脚本添加到页面的 &lt;head&gt; 中，自动记录页面访问和 SPA
              路由切换。
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
                  查看服务端与自定义事件接入
                  <ArrowUpRight className='size-4' />
                </Link>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
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
