import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/trends/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { view: 'trends' } })
  },
})
