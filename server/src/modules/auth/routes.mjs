import { z } from 'zod'
import { SESSION_LIFETIME_SECONDS } from './service.mjs'
import { requireSameOrigin } from './guards.mjs'

const loginSchema = z.object({ password: z.string().min(1).max(1024) })

export async function authRoutes(app, { service, requireAdmin, config }) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.secureCookie,
  }
  app.post(
    '/login',
    {
      onRequest: requireSameOrigin,
      config: { rateLimit: { max: config.limits.login, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { password } = loginSchema.parse(request.body)
      const token = await service.login(password, request.cookies.visora_session)
      reply.setCookie('visora_session', token, {
        ...cookieOptions,
        maxAge: SESSION_LIFETIME_SECONDS,
      })
      return { name: config.name, role: 'admin' }
    }
  )
  app.get('/session', { onRequest: requireAdmin }, async () => ({
    name: config.name,
    role: 'admin',
    retentionDays: config.retentionDays,
  }))
  app.post('/logout', { onRequest: requireAdmin }, async (request, reply) => {
    await service.logout(request.cookies.visora_session)
    reply.clearCookie('visora_session', cookieOptions)
    return { ok: true }
  })
}
