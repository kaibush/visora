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
    <div className='overflow-hidden rounded-lg border bg-muted/40'>
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <span className='text-xs text-muted-foreground'>{label}</span>
        <Button
          variant='ghost'
          size='sm'
          className='h-7 text-xs'
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
      <pre className='max-h-96 overflow-auto p-4 text-xs leading-6'>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const browserSnippet = (siteId: string) =>
  `<script defer\n  src="${window.location.origin}/tracker.js"\n  data-site="${siteId}">\n</script>`
