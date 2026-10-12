import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
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
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex'>
        <div className='flex items-center gap-3 text-2xl font-semibold'>
          <span className='rounded-xl bg-indigo-500 p-2'>
            <ChartNoAxesCombined />
          </span>
          Visora
        </div>
        <div className='relative z-10 max-w-lg'>
          <span className='text-sm tracking-[0.25em] text-indigo-300'>
            ONE SPACE. EVERY VISIT.
          </span>
          <h1 className='mt-6 text-5xl leading-tight font-semibold'>
            看见访问。
            <br />
            连接每一个项目。
          </h1>
          <p className='mt-6 text-base leading-8 text-slate-400'>
            将分散在各个系统的访问数据汇聚一处。
            <br />
            从第一位访客，到每一次产品增长。
          </p>
          <div className='mt-10 flex gap-6 text-sm text-slate-300'>
            <span className='flex items-center gap-2'>
              <Layers className='size-4 text-indigo-400' />
              多项目聚合
            </span>
            <span className='flex items-center gap-2'>
              <Radio className='size-4 text-indigo-400' />
              统一采集
            </span>
          </div>
        </div>
        <div
          aria-hidden
          className='absolute -right-32 bottom-32 size-[500px] rounded-full border border-indigo-400/10 shadow-[0_0_0_60px_#818cf808,0_0_0_120px_#818cf806,0_0_0_180px_#818cf804]'
        />
        <p className='text-xs text-slate-500'>Visora Analytics Platform</p>
      </div>
      <main className='flex items-center justify-center px-6 py-16'>
        <div className='w-full max-w-sm'>
          <div className='mb-10 flex items-center gap-2 text-xl font-semibold lg:hidden'>
            <ChartNoAxesCombined className='text-primary' />
            Visora
          </div>
          <div className='mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted/40'>
            <LockKeyhole className='size-5 text-primary' />
          </div>
          <h2 className='text-2xl font-semibold'>登录 Visora</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            进入你的统一访问统计工作空间。
          </p>
          <form onSubmit={submit} className='mt-8 space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor='password'>管理密码</Label>
              <Input
                id='password'
                type='password'
                autoComplete='current-password'
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='输入管理密码'
                className='h-11'
              />
            </div>
            {error && (
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
            )}
            <Button className='h-11 w-full' disabled={loading}>
              {loading ? '登录中…' : '进入工作空间'}
              <ArrowRight className='size-4' />
            </Button>
          </form>
          <p className='mt-6 text-xs leading-6 text-muted-foreground'>
            使用部署时配置的管理密码登录。
            <br />
            所有项目数据仅对工作空间管理员可见。
          </p>
        </div>
      </main>
    </div>
  )
}
