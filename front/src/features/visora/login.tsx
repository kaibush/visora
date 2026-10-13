import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChartNoAxesCombined,
  Layers,
  LockKeyhole,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from './api'

export function VisoraLogin() {
  const setup = useQuery({
    queryKey: ['visora-setup'],
    queryFn: () => api<{ required: boolean }>('/auth/setup'),
    retry: false,
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const required = setup.data?.required === true

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (required && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api(required ? '/auth/setup' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      queryClient.clear()
      await navigate({ to: '/' })
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='grid min-h-svh max-w-full overflow-x-hidden lg:grid-cols-2'>
      <div className='relative hidden flex-col justify-between overflow-hidden bg-foreground p-10 text-background lg:flex'>
        <div className='flex items-center gap-3 text-2xl font-semibold'>
          <span className='rounded-xl bg-primary p-2 text-primary-foreground'>
            <ChartNoAxesCombined />
          </span>
          Visora
        </div>
        <div className='relative z-10 max-w-lg'>
          <span className='text-xs tracking-[0.22em] text-primary'>
            ONE SPACE. EVERY VISIT.
          </span>
          <h1 className='mt-6 text-5xl leading-tight font-semibold'>
            看见访问。
            <br />
            连接每一个项目。
          </h1>
          <p className='mt-6 max-w-md text-sm leading-7 text-background/70'>
            将分散在各个系统的访问数据汇聚一处。
            <br />
            从第一位访客，到每一次产品增长。
          </p>
          <div className='mt-8 flex gap-6 text-sm text-background/80'>
            <span className='flex items-center gap-2'>
              <Layers className='size-4 text-primary' />
              多项目聚合
            </span>
            <span className='flex items-center gap-2'>
              <Radio className='size-4 text-primary' />
              统一采集
            </span>
          </div>
        </div>
        <div
          aria-hidden
          className='absolute -right-24 bottom-16 size-80 rounded-full border border-primary/20'
        />
        <p className='text-xs text-background/50'>Visora</p>
      </div>
      <main className='flex min-w-0 items-center justify-center px-4 py-10 sm:px-6 sm:py-16'>
        <div className='w-full max-w-sm'>
          <div className='mb-10 flex items-center gap-2 text-xl font-semibold lg:hidden'>
            <ChartNoAxesCombined className='text-primary' />
            Visora
          </div>
          <div className='mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted/40'>
            <LockKeyhole className='size-5 text-primary' />
          </div>
          {!setup.isSuccess ? (
            <p className='text-sm text-muted-foreground'>
              {setup.isError
                ? setup.error instanceof Error
                  ? setup.error.message
                  : '无法确认工作空间状态'
                : '正在确认工作空间状态…'}
            </p>
          ) : (
            <>
              <h2 className='text-2xl font-semibold'>
                {required ? '创建管理员账号' : '登录 Visora'}
              </h2>
              <p className='mt-2 text-sm text-muted-foreground'>
                {required
                  ? '设置唯一的管理员账号和密码，创建后立即进入工作空间。'
                  : '进入你的统一访问统计工作空间。'}
              </p>
              <form onSubmit={submit} className='mt-8 flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                  <Label htmlFor='username'>账号</Label>
                  <Input
                    id='username'
                    autoComplete='username'
                    autoFocus
                    required
                    maxLength={64}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder='输入管理员账号'
                    className='h-11'
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <Label htmlFor='password'>密码</Label>
                  <Input
                    id='password'
                    type='password'
                    autoComplete={
                      required ? 'new-password' : 'current-password'
                    }
                    required
                    minLength={required ? 12 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={required ? '至少 12 位' : '输入密码'}
                    className='h-11'
                  />
                </div>
                {required && (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor='confirm-password'>确认密码</Label>
                    <Input
                      id='confirm-password'
                      type='password'
                      autoComplete='new-password'
                      required
                      minLength={12}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder='再次输入密码'
                      className='h-11'
                    />
                  </div>
                )}
                {error && (
                  <p role='alert' className='text-sm text-destructive'>
                    {error}
                  </p>
                )}
                <Button className='h-11 w-full' disabled={loading}>
                  {loading
                    ? required
                      ? '创建中…'
                      : '登录中…'
                    : required
                      ? '创建并进入'
                      : '进入工作空间'}
                  <ArrowRight className='size-4' />
                </Button>
              </form>
              <p className='mt-6 text-xs leading-6 text-muted-foreground'>
                {required
                  ? '只会创建这一个管理员，没有默认密码。请妥善保存账号和密码。'
                  : '使用首次初始化时创建的管理员账号登录。'}
                <br />
                所有项目数据仅对工作空间管理员可见。
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
