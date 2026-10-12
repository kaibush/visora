import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, loadDatabaseConfig } from '../src/config.mjs'

// Configuration tests never create connections or import a database driver.
test('an explicit SQLite override cannot inherit remote database credentials', () => {
  const config = loadConfig(
    { database: ':memory:', autoMigrate: true },
    {
      VISORA_DATABASE_URL: 'postgres://someone:secret@other-service.invalid/production',
      VISORA_DB_SSL: 'true',
      VISORA_DB_CA_FILE: '/another-service/ca.pem',
    }
  )
  assert.equal(config.databaseUrl, '')
  assert.equal(config.databaseSsl, false)
  assert.equal(config.databaseCaFile, '')
})

test('remote databases require explicit migrations by default; migration config needs no admin password', () => {
  for (const databaseUrl of [
    'postgres://visora:placeholder@db.invalid/visora',
    'mysql://visora:placeholder@db.invalid/visora',
  ]) {
    const config = loadDatabaseConfig({ databaseUrl }, {})
    assert.equal(config.databaseUrl, databaseUrl)
    assert.equal(config.autoMigrate, false)
    assert.equal(loadDatabaseConfig({ databaseUrl, autoMigrate: true }, {}).autoMigrate, true)
  }
  assert.equal(loadDatabaseConfig({}, {}).autoMigrate, true)
  assert.throws(() => loadDatabaseConfig({ databaseUrl: 'postgres://db.invalid/' }, {}))
  assert.throws(() => loadDatabaseConfig({ databaseUrl: 'sqlite://somewhere' }, {}))
})
