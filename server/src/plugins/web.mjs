import serveStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

export async function registerWeb(app, config) {
  const tracker = await readFile(config.trackerFile, 'utf8')
  app.get('/tracker.js', async (_request, reply) => {
    reply
      .type('application/javascript; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
    return tracker
  })
  if (config.serveFrontend && existsSync(config.frontendDir)) {
    await app.register(serveStatic, { root: config.frontendDir, wildcard: false })
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        !request.url.startsWith('/api/') &&
        request.headers.accept?.includes('text/html')
      ) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
      }
      return reply.code(404).send({ error: '接口不存在' })
    })
  }
}
