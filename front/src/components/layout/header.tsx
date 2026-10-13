import { cn } from '@/lib/utils'
import { SidebarTrigger } from '@/components/ui/sidebar'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        'z-50',
        fixed
          ? 'header-fixed peer/header sticky top-0 w-full max-w-full bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm'
          : 'h-16',
        className
      )}
      {...props}
    >
      <div className='relative flex h-14 min-w-0 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5'>
        <SidebarTrigger className='size-11 md:size-7' />
        {children}
      </div>
    </header>
  )
}
