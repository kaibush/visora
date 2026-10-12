import { buildApp } from './app.mjs'
import { loadConfig } from './config.mjs'

const config = loadConfig()
const app = await buildApp({ config })
try {
  await app.listen({ host: config.host, port: config.port })
  app.log.info('Visora analytics platform is ready')
} catch (error) {
  app.log.error(error)
  await app.close()
  process.exitCode = 1
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close()
    process.exit(0)
  })
