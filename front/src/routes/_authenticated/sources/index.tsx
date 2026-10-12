import { createFileRoute } from '@tanstack/react-router'
import { VisoraSources } from '@/features/visora/explore'

export const Route = createFileRoute('/_authenticated/sources/')({
  component: VisoraSources,
})
