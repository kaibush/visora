import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CodeBlock({
  code,
  label = '代码',
}: {
  code: string
  label?: string
}) {
  return (
    <div className='max-w-full min-w-0 overflow-hidden rounded-lg border bg-muted/40'>
      <div className='flex items-center justify-between gap-2 border-b px-3 py-2 sm:px-4'>
        <span className='min-w-0 truncate text-xs text-muted-foreground'>
          {label}
        </span>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 shrink-0 text-xs'
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code)
              toast.success('已复制到剪贴板')
            } catch {
              toast.error('无法访问剪贴板，请手动选中代码复制')
            }
          }}
        >
          <Copy className='size-3.5' />
          复制
        </Button>
      </div>
      <pre className='max-h-96 max-w-full overflow-auto p-3 text-xs leading-6 break-all whitespace-pre-wrap sm:p-4 sm:break-normal sm:whitespace-pre'>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const browserSnippet = (siteId: string, waitForUser = false) =>
  `<script defer\n  src="${window.location.origin}/tracker.js"\n  data-site="${siteId}"${waitForUser ? '\n  data-wait-for-user="true"' : ''}>\n</script>`
