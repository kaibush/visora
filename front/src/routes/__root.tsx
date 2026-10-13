import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, '') || '/'
    const allowed = new Set([
      '/',
      '/sign-in',
      '/projects',
      '/events',
      '/users',
      '/integrations',
      '/prompts',
      '/trends',
      '/pages',
      '/sources',
      '/audience',
      '/behavior',
    ])
    if (!allowed.has(path)) throw redirect({ to: '/' })
  },
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <Toaster duration={5000} />
      </>
    )
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
