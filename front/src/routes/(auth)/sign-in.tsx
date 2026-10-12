import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { VisoraLogin } from '@/features/visora/login'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: VisoraLogin,
  validateSearch: searchSchema,
})
