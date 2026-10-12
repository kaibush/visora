import { createFileRoute } from '@tanstack/react-router'
import { VisoraIntegrations } from '@/features/visora/integrations'

export const Route = createFileRoute('/_authenticated/integrations/')({
  component: VisoraIntegrations,
})
