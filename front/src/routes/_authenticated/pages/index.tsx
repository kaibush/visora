import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/pages/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { view: 'pages' } })
  },
})
