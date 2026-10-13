import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import browserUserTypes from '../../../../sdk/browser.d.ts?raw'
import browserUserSource from '../../../../sdk/browser.mjs?raw'
import { api, projectsQuery, type Project } from './api'
import { CodeBlock } from './code-block'
import {
  fieldMappingError,
  llmIntegrationPrompt,
  type UserFieldMapping,
} from './llm-prompt'
import { EmptyState, ErrorState, VisoraPage } from './shared'
import { PanelTitle } from './visuals'

function mappingOf(project: Project): UserFieldMapping {
  return {
    userIdField: project.userIdField,
    userNameField: project.userNameField,
    userEmailField: project.userEmailField,
  }
}

function PromptWorkspace({ project }: { project: Project }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(mappingOf(project))
  const [error, setError] = useState('')
  const mapping = {
    userIdField: draft.userIdField.trim(),
    userNameField: draft.userNameField.trim(),
    userEmailField: draft.userEmailField.trim(),
  }
  const saved = mappingOf(project)
  const dirty =
    mapping.userIdField !== saved.userIdField ||
    mapping.userNameField !== saved.userNameField ||
    mapping.userEmailField !== saved.userEmailField
  const validation = fieldMappingError(mapping)
  const prompt = validation
    ? ''
    : llmIntegrationPrompt({
        project: { ...project, ...mapping },
        origin: window.location.origin,
        sdkSource: browserUserSource,
        typeSource: browserUserTypes,
      })
  const save = useMutation({
    mutationFn: () =>
      api<{ project: Project }>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify(mapping),
      }),
    onSuccess: (result) => {
      setDraft(mappingOf(result.project))
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['visora', 'projects'] })
      toast.success('本项目的用户字段已保存')
    },
    onError: (reason) =>
      setError(reason instanceof Error ? reason.message : '保存失败'),
  })

  function update(key: keyof UserFieldMapping, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError('')
  }

  return (
    <div className='grid items-start gap-3 xl:grid-cols-[24rem_minmax(0,1fr)]'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            <PanelTitle icon={Sparkles} tone='info'>
              本项目的用户字段
            </PanelTitle>
          </CardTitle>
          <CardDescription>
            Visora 只接收 id、name、email。这里填写的是
            {project.name} 登录对象上的取值路径，和其他项目互不影响。
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <dl className='grid gap-2 text-sm'>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>站点 ID</dt>
              <dd className='truncate font-mono text-xs' title={project.siteId}>
                {project.siteId}
              </dd>
            </div>
            <div className='min-w-0'>
              <dt className='text-xs text-muted-foreground'>允许来源</dt>
              <dd
                className='truncate text-xs'
                title={project.origins.join('、')}
              >
                {project.origins.join('、') || '未配置'}
              </dd>
            </div>
          </dl>
          <Field
            id='user-id-field'
            label='用户 ID 路径'
            required
            value={draft.userIdField}
            placeholder='id'
            hint='必填。例如 id、userId'
            onChange={(value) => update('userIdField', value)}
          />
          <Field
            id='user-name-field'
            label='显示名称路径'
            value={draft.userNameField}
            placeholder='name'
            hint='可留空。例如 username、profile.displayName'
            onChange={(value) => update('userNameField', value)}
          />
          <Field
            id='user-email-field'
            label='邮箱路径'
            value={draft.userEmailField}
            placeholder='email'
            hint='可留空。例如 email、profile.email'
            onChange={(value) => update('userEmailField', value)}
          />
          {validation && (
            <p role='alert' className='text-sm text-destructive'>
              {validation}
            </p>
          )}
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <Button
            className='h-11 md:h-9'
            disabled={!dirty || Boolean(validation) || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? '保存中…' : '保存字段映射'}
          </Button>
          <p className='text-xs leading-5 text-muted-foreground'>
            {dirty
              ? '当前提示词按未保存的输入生成。保存后，下次打开仍使用这个项目的字段。'
              : '字段已保存在这个项目上。切换项目会换成该项目自己的路径。'}
          </p>
        </CardContent>
      </Card>
      <Card className='min-w-0'>
        <CardHeader>
          <CardTitle className='text-base'>交给任意大模型</CardTitle>
          <CardDescription>
            复制整段提示词即可。其中已经包含这个项目的站点
            ID、允许来源、采集脚本和登录字段，不需要再解释统计协议。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prompt ? (
            <CodeBlock label='提示词 · 可交给任意大模型' code={prompt} />
          ) : (
            <p className='text-sm text-muted-foreground'>
              字段路径修正后才会生成提示词。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  id,
  label,
  required = false,
  value,
  placeholder,
  hint,
  onChange,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  placeholder: string
  hint: string
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>
        {label}
        {required ? '（必填）' : '（可选）'}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={80}
        spellCheck={false}
        autoComplete='off'
        className='h-11 font-mono md:h-9'
        onChange={(event) => onChange(event.target.value)}
      />
      <p className='text-xs leading-5 text-muted-foreground'>{hint}</p>
    </div>
  )
}

export function VisoraPrompts({
  initialProjectId = '',
}: {
  initialProjectId?: string
}) {
  const { data, error, isPending, refetch } = useQuery(projectsQuery)
  const [projectId, setProjectId] = useState(initialProjectId)
  const projects = data?.projects ?? []
  const selected =
    projects.find((project) => project.id === projectId) ?? projects[0]

  return (
    <VisoraPage
      title='大模型接入'
      action={
        <Button asChild variant='outline' className='h-11 px-3 md:h-8'>
          <Link to='/integrations'>
            <span className='max-sm:sr-only'>接入指南</span>
            <ArrowUpRight className='size-4' />
          </Link>
        </Button>
      }
    >
      {isPending ? (
        <Skeleton className='h-80 rounded-xl' />
      ) : error ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : projects.length === 0 || !selected ? (
        <EmptyState
          title='还没有可接入的项目'
          description='先创建一个项目，再为它生成可以交给大模型的接入提示词。'
        />
      ) : (
        <div className='flex flex-col gap-3'>
          <div className='max-w-md'>
            <Select value={selected.id} onValueChange={setProjectId}>
              <SelectTrigger
                id='prompt-project'
                className='h-11 w-full md:h-9'
                aria-label='选择项目'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <PromptWorkspace key={selected.id} project={selected} />
        </div>
      )}
    </VisoraPage>
  )
}
