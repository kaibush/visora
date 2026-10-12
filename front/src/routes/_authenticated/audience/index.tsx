import { createFileRoute } from '@tanstack/react-router'
import { VisoraAudience } from '@/features/visora/explore'

export const Route = createFileRoute('/_authenticated/audience/')({
  component: VisoraAudience,
})
