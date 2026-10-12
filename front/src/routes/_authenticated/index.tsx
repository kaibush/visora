import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { analysisViews } from '@/features/visora/analysis-views'
import { VisoraAnalytics } from '@/features/visora/analytics'

const searchSchema = z.object({
  view: z.enum(analysisViews).optional().catch('overview'),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: searchSchema,
  component: VisoraAnalytics,
})
