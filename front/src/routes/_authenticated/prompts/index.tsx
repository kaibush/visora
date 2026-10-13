import { createFileRoute } from '@tanstack/react-router'
import { VisoraPrompts } from '@/features/visora/prompts'

type PromptSearch = {
  project?: string
}

export const Route = createFileRoute('/_authenticated/prompts/')({
  validateSearch: (search: Record<string, unknown>): PromptSearch =>
    typeof search.project === 'string' && search.project
      ? { project: search.project }
      : {},
  component: function PromptRoute() {
    const { project } = Route.useSearch()
    return <VisoraPrompts initialProjectId={project} />
  },
})
