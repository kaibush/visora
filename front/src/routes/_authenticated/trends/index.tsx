import { createFileRoute } from '@tanstack/react-router'
import { VisoraTrends } from '@/features/visora/explore'

export const Route = createFileRoute('/_authenticated/trends/')({
  component: VisoraTrends,
})
