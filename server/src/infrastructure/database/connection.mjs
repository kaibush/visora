import { Sequelize, Transaction } from 'sequelize'
import { mkdir, chmod, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { defineModels } from './models.mjs'
import { migrate, assertCurrentSchema } from './migrate.mjs'

export async function openDatabase(config) {
  const remote = Boolean(config.databaseUrl)
  if (!remote && config.database !== ':memory:')
    await mkdir(dirname(config.database), { recursive: true, mode: 0o700 })
  const options = {
    logging: false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    retry: { match: [/SQLITE_BUSY/], max: 5 },
  }
  if (remote && config.databaseSsl) {
    options.dialectOptions = {
      ssl: {
        rejectUnauthorized: true,
        ...(config.databaseCaFile ? { ca: await readFile(config.databaseCaFile, 'utf8') } : {}),
      },
    }
  }
  const sequelize = remote
    ? new Sequelize(config.databaseUrl, options)
    : new Sequelize({ ...options, dialect: 'sqlite', storage: config.database })
  const models = defineModels(sequelize)
  const database = { sequelize, models, close: () => sequelize.close() }
  // SQLite has one writer. Serialize ingestion transactions within this instance;
  // PostgreSQL/MySQL serialize same-project batches by locking the project row.
  let pendingWrite = Promise.resolve()
  database.transaction = (work) => {
    const execute = () =>
      sequelize.transaction(
        sequelize.getDialect() === 'sqlite'
          ? { type: Transaction.TYPES.IMMEDIATE }
          : { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        work
      )
    if (sequelize.getDialect() !== 'sqlite') return execute()
    const result = pendingWrite.then(execute)
    pendingWrite = result.catch(() => {})
    return result
  }
  try {
    await sequelize.authenticate()
    if (!remote) {
      if (config.database !== ':memory:') await chmod(config.database, 0o600)
      // Dialect-specific connection tuning is intentionally confined to infrastructure.
      await sequelize.query('PRAGMA journal_mode = WAL')
      await sequelize.query('PRAGMA busy_timeout = 5000')
    }
    if (config.autoMigrate) await migrate(database)
    else await assertCurrentSchema(database)
    const [setting] = await models.Setting.findOrCreate({
      where: { key: 'identity_salt' },
      defaults: { value: randomBytes(32).toString('hex') },
    })
    database.identitySalt = setting.value
    return database
  } catch (error) {
    await sequelize.close()
    throw error
  }
}
