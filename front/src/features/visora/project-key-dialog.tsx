import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, type Project } from './api'
import { CodeBlock } from './code-block'

type KeyState =
  | { status: 'loading' }
  | { status: 'ready'; key: string | null }
  | { status: 'error'; message: string }

export function ProjectKeyDialog({
  project,
  initialKey,
  close,
  rotate,
}: {
  project: Project
  initialKey?: string
  close: () => void
  rotate: () => void
}) {
  const [state, setState] = useState<KeyState>(
    initialKey ? { status: 'ready', key: initialKey } : { status: 'loading' }
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (initialKey) return
    const controller = new AbortController()
    // Keep revealed credentials in this dialog only, outside the shared query cache.
    void api<{ key: string | null }>(`/projects/${project.id}/key`, {
      signal: controller.signal,
      cache: 'no-store',
    }).then(
      ({ key }) => {
        if (!controller.signal.aborted) setState({ status: 'ready', key })
      },
      (error: Error) => {
        if (!controller.signal.aborted)
          setState({ status: 'error', message: error.message })
      }
    )
    return () => controller.abort()
  }, [project.id, initialKey, attempt])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project.name} 的服务端密钥</DialogTitle>
          <DialogDescription>
            可随时通过项目卡片上的「查看密钥」重新打开，复制到服务端环境变量中使用。
          </DialogDescription>
        </DialogHeader>
        {state.status === 'loading' && (
          <p
            role='status'
            className='py-6 text-center text-sm text-muted-foreground'
          >
            读取密钥中…
          </p>
        )}
        {state.status === 'ready' &&
          (state.key ? (
            <CodeBlock
              label='VISORA_SERVER_KEY · 仅服务端使用'
              code={state.key}
            />
          ) : (
            <div className='rounded-lg border bg-muted/40 p-4 text-sm leading-6'>
              此项目的旧密钥无法回显。你可以继续使用已保存的旧密钥，或轮换生成可随时查看的新密钥。
            </div>
          ))}
        {state.status === 'error' && (
          <div className='space-y-3'>
            <p role='alert' className='text-sm text-destructive'>
              {state.message}
            </p>
            <Button
              variant='outline'
              onClick={() => {
                setState({ status: 'loading' })
                setAttempt((value) => value + 1)
              }}
            >
              重试
            </Button>
          </div>
        )}
        <p className='text-xs text-muted-foreground'>
          网页脚本不需要此密钥。请勿将密钥放入前端源码。
        </p>
        <DialogFooter>
          {state.status !== 'loading' && (
            <Button variant='outline' onClick={rotate}>
              轮换密钥
            </Button>
          )}
          <Button onClick={close}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
