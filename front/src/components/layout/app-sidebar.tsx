import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChartNoAxesCombined, LogOut, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useLayout } from '@/context/layout-provider'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { api } from '@/features/visora/api'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  async function logout() {
    setLoading(true)
    try {
      await api('/auth/logout', { method: 'POST' })
      queryClient.clear()
      await navigate({ to: '/sign-in' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退出失败')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader className='px-3 py-3'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size='lg'
              className='hover:bg-transparent'
            >
              <Link to='/'>
                <span className='flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                  <ChartNoAxesCombined className='size-5' />
                </span>
                <span className='grid gap-0.5'>
                  <span className='text-xl font-semibold tracking-tight'>
                    Visora
                  </span>
                  <span className='text-xs tracking-wider text-muted-foreground'>
                    统一访问统计平台
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='px-2'>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter className='gap-4 p-4'>
        <div className='flex items-center gap-2 border-t pt-4'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <ShieldCheck className='size-4' />
          </div>
          <div className='min-w-0 flex-1 group-data-[collapsible=icon]:hidden'>
            <p className='text-xs font-medium'>工作空间管理员</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Visora · 自托管
            </p>
          </div>
          <Button
            size='icon'
            variant='ghost'
            className='size-11 group-data-[collapsible=icon]:hidden'
            aria-label='退出登录'
            disabled={loading}
            onClick={logout}
          >
            <LogOut className='size-4' />
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
