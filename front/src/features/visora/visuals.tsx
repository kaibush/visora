import { type ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconBadgeVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&>svg]:size-4 [&>svg]:stroke-[1.8]',
  {
    variants: {
      tone: {
        info: 'bg-info/10 text-info ring-info/10',
        teal: 'bg-teal/10 text-teal ring-teal/10',
        violet: 'bg-violet/10 text-violet ring-violet/10',
        amber: 'bg-amber/10 text-amber ring-amber/10',
      },
      size: {
        sm: 'size-8 rounded-lg',
        default: 'size-10',
        lg: 'size-12 [&>svg]:size-5',
      },
    },
    defaultVariants: { tone: 'info', size: 'default' },
  }
)

export function IconBadge({
  icon: Icon,
  tone,
  size,
  className,
  ...props
}: ComponentProps<'span'> &
  VariantProps<typeof iconBadgeVariants> & { icon: LucideIcon }) {
  return (
    <span
      aria-hidden='true'
      className={cn(iconBadgeVariants({ tone, size }), className)}
      {...props}
    >
      <Icon />
    </span>
  )
}

export function PanelTitle({
  icon,
  children,
  tone = 'info',
}: {
  icon: LucideIcon
  children: React.ReactNode
  tone?: 'info' | 'teal' | 'violet' | 'amber'
}) {
  return (
    <span className='inline-flex items-center gap-2.5'>
      <IconBadge icon={icon} tone={tone} size='sm' />
      {children}
    </span>
  )
}
