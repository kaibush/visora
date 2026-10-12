import { z } from 'zod'
import { SESSION_LIFETIME_SECONDS } from './service.mjs'
import { requireSameOrigin } from './guards.mjs'

const username = z
  .string()
  .trim()
  .min(1, '请填写账号')
  .max(64, '账号不能超过 64 个字符')
  .regex(/^[^\s\p{C}]+$/u, '账号不能包含空白字符')
const setupSchema = z.object({
  username,
  password: z.string().min(12, '密码至少需要 12 位').max(1024),
})
const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(1024),
})

export async function authRoutes(app, { service, requireAdmin, config }) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.secureCookie,
  }
  const guarded = {
    onRequest: requireSameOrigin,
    config: { rateLimit: { max: config.limits.login, timeWindow: '1 minute' } },
  }
  const startSession = (reply, token) => {
    reply.setCookie('visora_session', token, {
      ...cookieOptions,
      maxAge: SESSION_LIFETIME_SECONDS,
    })
  }
  app.get('/setup', async () => ({ required: await service.setupRequired() }))
  app.post('/setup', guarded, async (request, reply) => {
    const body = setupSchema.parse(request.body)
    const { token, username: name } = await service.setup(body, request.cookies.visora_session)
    startSession(reply, token)
    return { name, role: 'admin' }
  })
  app.post('/login', guarded, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const { token, username: name } = await service.login(body, request.cookies.visora_session)
    startSession(reply, token)
    return { name, role: 'admin' }
  })
  app.get('/session', { onRequest: requireAdmin }, async (request) => ({
    ...(await requireAdmin(request)),
    retentionDays: config.retentionDays,
  }))
  app.post('/logout', { onRequest: requireAdmin }, async (request, reply) => {
    await service.logout(request.cookies.visora_session)
    reply.clearCookie('visora_session', cookieOptions)
    return { ok: true }
  })
}
