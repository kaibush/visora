import { initialSchema } from './migrations/001-initial.mjs'
import { eventDay } from './migrations/002-event-day.mjs'

import { projectKeyCiphertext } from './migrations/003-project-key-ciphertext.mjs'

import { eventUser } from './migrations/004-event-user.mjs'

import { eventContext } from './migrations/005-event-context.mjs'

const migrations = [initialSchema, eventDay, projectKeyCiphertext, eventUser, eventContext]
export const latestVersion = migrations.at(-1).version

async function currentVersion(models) {
  const applied = await models.Migration.findAll({ order: [['version', 'ASC']], raw: true })
  if (Number(applied.at(-1)?.version ?? 0) > latestVersion)
    throw new Error('数据库版本高于当前 Visora 版本，不能降级运行')
  if (
    applied.some(
      (row, index) =>
        Number(row.version) !== migrations[index]?.version || row.name !== migrations[index]?.name
    )
  ) {
    throw new Error('Visora 迁移记录不连续或已被修改，请先检查 schema_migrations')
  }
  return Number(applied.at(-1)?.version ?? 0)
}

export async function assertCurrentSchema({ sequelize, models }) {
  const exists = await sequelize.getQueryInterface().tableExists('schema_migrations')
  if (!exists || (await currentVersion(models)) !== latestVersion) {
    throw new Error('Visora 数据库版本不匹配，请先由单个迁移进程执行 pnpm db:migrate')
  }
}

export async function migrate(database) {
  const { sequelize, models } = database
  const queryInterface = sequelize.getQueryInterface()
  // Only the migration ledger is bootstrapped via sync; never sync/alter business tables.
  await models.Migration.sync()
  const current = await currentVersion(models)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    const apply = async (transaction) => {
      await migration.up({ sequelize, queryInterface, transaction })
      await models.Migration.create(
        { version: migration.version, name: migration.name, appliedAt: Date.now() },
        { transaction }
      )
    }
    // MySQL DDL implicitly commits. Its migrations are resumable/idempotent instead.
    if (sequelize.getDialect() === 'mysql') await apply(undefined)
    else await sequelize.transaction(apply)
  }
}
