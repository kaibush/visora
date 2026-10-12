import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'
import { AppError } from '../shared/errors.mjs'

const errorStatus = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
}

/** Install on the root instance so hooks apply to every registered module. */
export async function configureHttp(app, config) {
  await app.register(cookie)
  await app.register(rateLimit, {
    max: config.limits.global,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ statusCode: 429, message: '请求过于频繁，请稍后重试' }),
  })
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, JSON.parse(body))
    } catch {
      done(new AppError('INVALID_INPUT', 'JSON 格式无效'))
    }
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
    const status =
      error instanceof AppError ? (errorStatus[error.code] ?? 500) : (error.statusCode ?? 500)
    if (status >= 500) request.log.error({ err: error }, 'Visora request failed')
    reply.code(status).send({ error: status >= 500 ? 'Visora 服务暂时不可用' : error.message })
  })
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('X-Frame-Options', 'DENY')
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
    return payload
  })
}
