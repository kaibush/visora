import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const positiveInteger = (fallback) => z.coerce.number().int().positive().default(fallback)
const databaseSchema = z.object({
  VISORA_DATABASE: z.string().min(1).default('./data/visora.sqlite'),
  VISORA_DATABASE_URL: z
    .string()
    .default('')
    .refine((url) => {
      if (!url) return true
      try {
        const parsed = new URL(url)
        return (
          ['postgres:', 'postgresql:', 'mysql:'].includes(parsed.protocol) &&
          Boolean(parsed.hostname) &&
          parsed.pathname.length > 1
        )
      } catch {
        return false
      }
    }, '数据库 URL 需要指定 PostgreSQL 或 MySQL 的主机及独立数据库名称'),
  VISORA_DB_SSL: z.enum(['true', 'false']).default('false'),
  VISORA_DB_CA_FILE: z.string().default(''),
  VISORA_AUTO_MIGRATE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['true', 'false']).optional()
  ),
})
const environmentSchema = z.object({
  VISORA_ADMIN_PASSWORD: z.string().min(12, 'Visora: 管理密码至少需要 12 位'),
  VISORA_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  VISORA_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  VISORA_SECURE_COOKIE: z.enum(['true', 'false']).default('false'),
  VISORA_RATE_LIMIT: positiveInteger(1000),
  VISORA_BROWSER_RATE_LIMIT: positiveInteger(120),
  VISORA_SERVER_RATE_LIMIT: positiveInteger(300),
  VISORA_LOGIN_RATE_LIMIT: positiveInteger(5),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: positiveInteger(3001).pipe(z.number().max(65535)),
})

/** Configuration is the only module reading process.env. The migration CLI needs no admin credentials. */
export function loadDatabaseConfig(overrides = {}, environment = process.env) {
  const env = databaseSchema.parse({
    ...environment,
    // Explicit SQLite paths (especially :memory:) must never inherit a remote URL/TLS config.
    ...(overrides.database !== undefined
      ? {
          VISORA_DATABASE: overrides.database,
          VISORA_DATABASE_URL: '',
          VISORA_DB_SSL: 'false',
          VISORA_DB_CA_FILE: '',
        }
      : {}),
    ...(overrides.databaseUrl !== undefined ? { VISORA_DATABASE_URL: overrides.databaseUrl } : {}),
    ...(overrides.databaseSsl !== undefined
      ? { VISORA_DB_SSL: String(overrides.databaseSsl) }
      : {}),
    ...(overrides.databaseCaFile !== undefined
      ? { VISORA_DB_CA_FILE: overrides.databaseCaFile }
      : {}),
    ...(overrides.autoMigrate !== undefined
      ? { VISORA_AUTO_MIGRATE: String(overrides.autoMigrate) }
      : {}),
  })
  return Object.freeze({
    database: env.VISORA_DATABASE,
    databaseUrl: env.VISORA_DATABASE_URL,
    databaseSsl: env.VISORA_DB_SSL === 'true',
    databaseCaFile: env.VISORA_DB_CA_FILE,
    // File databases bootstrap locally; remote deployments use one explicit migrator by default.
    autoMigrate:
      env.VISORA_AUTO_MIGRATE === undefined
        ? !env.VISORA_DATABASE_URL
        : env.VISORA_AUTO_MIGRATE === 'true',
  })
}

export function loadConfig(overrides = {}, environment = process.env) {
  const env = environmentSchema.parse({
    ...environment,
    ...(overrides.password !== undefined ? { VISORA_ADMIN_PASSWORD: overrides.password } : {}),
    ...(overrides.retentionDays !== undefined
      ? { VISORA_RETENTION_DAYS: overrides.retentionDays }
      : {}),
    ...(overrides.trustProxy !== undefined
      ? { VISORA_TRUST_PROXY: String(overrides.trustProxy) }
      : {}),
    ...(overrides.secureCookie !== undefined
      ? { VISORA_SECURE_COOKIE: String(overrides.secureCookie) }
      : {}),
  })
  return Object.freeze({
    name: 'Visora',
    version: '0.1.0',
    password: env.VISORA_ADMIN_PASSWORD,
    ...loadDatabaseConfig(overrides, environment),
    retentionDays: env.VISORA_RETENTION_DAYS,
    trustProxy: env.VISORA_TRUST_PROXY === 'true',
    secureCookie: env.VISORA_SECURE_COOKIE === 'true',
    host: env.HOST,
    port: env.PORT,
    limits: Object.freeze({
      global: env.VISORA_RATE_LIMIT,
      browser: env.VISORA_BROWSER_RATE_LIMIT,
      server: env.VISORA_SERVER_RATE_LIMIT,
      login: env.VISORA_LOGIN_RATE_LIMIT,
    }),
    frontendDir: fileURLToPath(new URL('../../front/dist/', import.meta.url)),
    trackerFile: fileURLToPath(new URL('../public/tracker.js', import.meta.url)),
    serveFrontend: overrides.serveFrontend !== false,
  })
}
