import { createFileRoute } from '@tanstack/react-router'
import { VisoraUsers } from '@/features/visora/users'

export const Route = createFileRoute('/_authenticated/users/')({
  component: VisoraUsers,
})
