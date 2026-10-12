import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { api, ApiError } from '@/features/visora/api'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    try {
      await api('/auth/session')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        throw redirect({ to: '/sign-in' })
      throw error
    }
  },
  component: AuthenticatedLayout,
})
