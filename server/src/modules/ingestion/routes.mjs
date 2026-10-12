export async function ingestionRoutes(app, { service, config }) {
  const allowCollector = async (request, reply) => {
    await service.authorizeBrowser(request.params.siteId, request.headers.origin)
    reply.header('Access-Control-Allow-Origin', request.headers.origin).header('Vary', 'Origin')
    reply
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type')
    reply.header('Access-Control-Max-Age', '600')
  }
  app.options('/collect/:siteId', { onRequest: allowCollector }, async (_request, reply) =>
    reply.code(204).send()
  )
  app.post(
    '/collect/:siteId',
    {
      onRequest: allowCollector,
      bodyLimit: 16384,
      config: {
        rateLimit: {
          max: config.limits.browser,
          timeWindow: '1 minute',
          keyGenerator: (r) => `${r.ip}:${r.params.siteId}`,
        },
      },
    },
    async (request, reply) => {
      const result = await service.collect({
        siteId: request.params.siteId,
        origin: request.headers.origin,
        payload: request.body,
        userAgent: (request.headers['user-agent'] ?? '').slice(0, 1024),
      })
      return reply.code(202).send(result)
    }
  )
  app.post(
    '/ingest',
    { config: { rateLimit: { max: config.limits.server, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const token = request.headers.authorization?.match(/^Bearer (vs_[A-Za-z0-9_-]+)$/)?.[1]
      return reply.code(202).send(await service.ingest({ token, payload: request.body }))
    }
  )
}
