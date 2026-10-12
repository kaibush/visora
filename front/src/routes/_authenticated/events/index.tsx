import { createFileRoute } from '@tanstack/react-router'
import { VisoraEvents } from '@/features/visora/events'

export const Route = createFileRoute('/_authenticated/events/')({
  component: VisoraEvents,
})
