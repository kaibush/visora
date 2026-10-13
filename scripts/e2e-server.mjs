import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { buildApp } from '../server/src/app.mjs'
import { loadConfig } from '../server/src/config.mjs'

const config = loadConfig(
  {
    database: ':memory:',
    encryptionKey: 'b'.repeat(64),
    databaseUrl: '',
    autoMigrate: true,
  },
  { VISORA_LOGIN_RATE_LIMIT: '50' } // Shared test server runs multiple independent login scenarios.
)
const app = await buildApp({
  config: {
    ...config,
    frontendDir: process.env.VISORA_E2E_FRONTEND_DIR || config.frontendDir,
  },
  logger: false,
})
const setup = await app.inject({
  method: 'POST',
  url: '/api/auth/setup',
  payload: { username: 'admin', password: 'visora-e2e-password-only' },
})
if (setup.statusCode !== 200) throw new Error(setup.body)
await app.listen({ port: 4317, host: '127.0.0.1' })
const userModule = await readFile(new URL('../sdk/browser.mjs', import.meta.url), 'utf8')
const website = createServer((request, response) => {
  if (request.url === '/visora-user.js') {
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    response.end(userModule)
    return
  }
  const params = new URL(request.url, 'http://127.0.0.1:4318').searchParams
  const site = params.get('site') ?? ''
  if (!/^v_[a-f0-9]+$/.test(site)) {
    response.writeHead(400)
    response.end()
    return
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(
    `<!doctype html><html><head><title>Visora tracker test</title><script defer src="http://127.0.0.1:4317/tracker.js" data-site="${site}" ${params.has('hash') ? 'data-hash="true"' : ''} ${params.has('wait') ? 'data-wait-for-user="true"' : ''} ${params.has('manual') ? 'data-auto="false"' : ''}></script></head><body>Connected website</body></html>`
  )
})
website.listen(4318, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    website.close()
    await app.close()
    process.exit(0)
  })
