import { createFileRoute } from '@tanstack/react-router'
import { VisoraOverview } from '@/features/visora/overview'

export const Route = createFileRoute('/_authenticated/')({
  component: VisoraOverview,
})
