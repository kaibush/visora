import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/sources/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { view: 'sources' } })
  },
})
