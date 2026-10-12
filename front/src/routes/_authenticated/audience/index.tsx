import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/audience/')({
  beforeLoad: () => {
    throw redirect({ to: '/', search: { view: 'audience' } })
  },
})
