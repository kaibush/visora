import { createFileRoute } from '@tanstack/react-router'
import { VisoraProjects } from '@/features/visora/projects'

export const Route = createFileRoute('/_authenticated/projects/')({
  component: VisoraProjects,
})
