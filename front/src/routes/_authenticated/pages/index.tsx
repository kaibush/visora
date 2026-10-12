import { createFileRoute } from '@tanstack/react-router'
import { VisoraPages } from '@/features/visora/explore'

export const Route = createFileRoute('/_authenticated/pages/')({
  component: VisoraPages,
})
