import { DataTypes } from 'sequelize'

// Immutable v1 schema snapshot. Later schema changes must be new migrations.
export const initialSchema = {
  version: 1,
  name: 'initial relational schema',
  async up({ queryInterface, transaction }) {
    const text = (length, extra = {}) => ({
      type: DataTypes.STRING(length),
      allowNull: false,
      ...extra,
    })
    const integer = (extra = {}) => ({ type: DataTypes.BIGINT, allowNull: false, ...extra })
    const tables = {
      settings: {
        key: text(80, { primaryKey: true }),
        value: { type: DataTypes.TEXT, allowNull: false },
      },
      projects: {
        id: text(36, { primaryKey: true }),
        name: text(80),
        site_id: text(40, { unique: true }),
        origins: { type: DataTypes.TEXT, allowNull: false },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        key_hash: text(64, { unique: true }),
        key_prefix: text(20),
        created_at: integer(),
      },
      sessions: {
        token_hash: text(64, { primaryKey: true }),
        expires_at: integer(),
        password_hash: text(64),
      },
      events: {
        id: integer({ primaryKey: true, autoIncrement: true }),
        project_id: text(36, {
          references: { model: 'projects', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        }),
        event_id: text(128),
        type: text(16),
        name: text(80),
        occurred_at: integer(),
        received_at: integer(),
        visitor: text(64),
        session: text(64),
        path: text(512),
        referrer: text(255),
        browser: text(32),
        os: text(32),
        device: text(16),
        language: text(32),
        source: text(16),
      },
    }
    for (const [name, columns] of Object.entries(tables)) {
      if (!(await queryInterface.tableExists(name, { transaction }))) {
        await queryInterface.createTable(name, columns, {
          transaction,
          charset: 'utf8mb4',
          collate: 'utf8mb4_bin',
        })
      }
    }
    const indexes = [
      ['sessions', 'sessions_expiry', ['expires_at'], false],
      ['events', 'events_project_event_unique', ['project_id', 'event_id'], true],
      ['events', 'events_project_time', ['project_id', 'occurred_at'], false],
      ['events', 'events_time', ['occurred_at'], false],
    ]
    for (const [table, name, fields, unique] of indexes) {
      const existing = await queryInterface.showIndex(table, { transaction })
      if (!existing.some((index) => index.name === name))
        await queryInterface.addIndex(table, fields, { name, unique, transaction })
    }
  },
}
