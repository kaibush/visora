import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/behavior/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { view: 'behavior' } })
  },
})
