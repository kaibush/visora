import { createFileRoute } from '@tanstack/react-router'
import { VisoraBehavior } from '@/features/visora/explore'

export const Route = createFileRoute('/_authenticated/behavior/')({
  component: VisoraBehavior,
})
