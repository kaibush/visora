import Fastify, { LogController } from 'fastify'
import { loadConfig } from './config.mjs'
import { openDatabase } from './infrastructure/database/connection.mjs'
import { createKeyVault } from './infrastructure/crypto/key-vault.mjs'
import { configureHttp } from './plugins/http.mjs'
import { registerWeb } from './plugins/web.mjs'
import { createSessionRepository } from './modules/auth/repository.mjs'
import { createAuthService } from './modules/auth/service.mjs'
import { createAdminGuard } from './modules/auth/guards.mjs'
import { authRoutes } from './modules/auth/routes.mjs'
import { createProjectRepository } from './modules/projects/repository.mjs'
import { createProjectService } from './modules/projects/service.mjs'
import { projectRoutes } from './modules/projects/routes.mjs'
import { createEventRepository } from './modules/ingestion/repository.mjs'
import { createIngestionService } from './modules/ingestion/service.mjs'
import { ingestionRoutes } from './modules/ingestion/routes.mjs'
import { createAnalyticsRepository } from './modules/analytics/repository.mjs'
import { createAnalyticsService } from './modules/analytics/service.mjs'
import { analyticsRoutes } from './modules/analytics/routes.mjs'
import { createRetentionJob } from './jobs/retention.mjs'

/** Composition root: owns resources, injects dependencies, mounts modules. No business SQL. */
export async function buildApp(options = {}) {
  const config = options.config ?? loadConfig(options)
  const clock = options.now ?? Date.now
  const keyVault = await createKeyVault(config)
  const db = await openDatabase(config)
  const salt = db.identitySalt
  const app = Fastify({
    logger: options.logger ?? {
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      level: 'info',
    },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 256 * 1024,
    trustProxy: config.trustProxy,
  })
  // Exposed for integration-test inspection, never consumed by HTTP handlers.
  app.decorate('db', db)
  const sessions = createSessionRepository(db)
  const events = createEventRepository(db)
  const auth = createAuthService({ repository: sessions, clock })
  const projects = createProjectService({
    repository: createProjectRepository(db),
    clock,
    keyVault,
  })
  const ingestion = createIngestionService({
    repository: events,
    projects,
    salt,
    clock,
    retentionDays: config.retentionDays,
  })
  const analytics = createAnalyticsService({
    repository: createAnalyticsRepository(db),
    projects,
    clock,
  })
  const requireAdmin = createAdminGuard(auth)
  const retention = createRetentionJob({
    events,
    sessions,
    clock,
    retentionDays: config.retentionDays,
    logger: app.log,
  })
  app.addHook('onClose', async () => {
    try {
      await retention.stop()
    } finally {
      await db.close()
    }
  })
  try {
    await auth.initialize()
    await configureHttp(app, config)
    app.get('/api/health', async () => ({
      name: config.name,
      version: config.version,
      status: 'ok',
    }))
    await app.register(authRoutes, { prefix: '/api/auth', service: auth, requireAdmin, config })
    await app.register(projectRoutes, { prefix: '/api/projects', service: projects, requireAdmin })
    await app.register(ingestionRoutes, { prefix: '/api', service: ingestion, config })
    await app.register(analyticsRoutes, { prefix: '/api', service: analytics, requireAdmin })
    await registerWeb(app, config)
    await retention.start()
    return app
  } catch (error) {
    await app.close()
    throw error
  }
}
