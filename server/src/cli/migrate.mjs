import { loadDatabaseConfig } from '../config.mjs'
import { openDatabase } from '../infrastructure/database/connection.mjs'
import { latestVersion } from '../infrastructure/database/migrate.mjs'

let database
try {
  const config = loadDatabaseConfig({ autoMigrate: true })
  database = await openDatabase(config)
  console.info(
    `Visora: database schema is at version ${latestVersion} (${database.sequelize.getDialect()})`
  )
} catch (error) {
  // Do not print connection URLs, SQL statements or driver errors containing credentials.
  console.error(
    `Visora: database migration failed (${error.name}). Check database configuration, access and schema version.`
  )
  process.exitCode = 1
} finally {
  if (database) await database.close()
}
