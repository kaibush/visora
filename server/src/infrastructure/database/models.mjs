import { DataTypes } from 'sequelize'

/** Persistence mapping only. Business rules belong to module services. */
export function defineModels(sequelize) {
  const options = (tableName, indexes = []) => ({
    tableName,
    timestamps: false,
    freezeTableName: true,
    indexes,
    charset: 'utf8mb4',
    collate: 'utf8mb4_bin',
  })
  const text = (length, extra = {}) => ({
    type: DataTypes.STRING(length),
    allowNull: false,
    ...extra,
  })
  const integer = (extra = {}) => ({ type: DataTypes.BIGINT, allowNull: false, ...extra })
  const Setting = sequelize.define(
    'Setting',
    { key: text(80, { primaryKey: true }), value: { type: DataTypes.TEXT, allowNull: false } },
    options('settings')
  )
  const Migration = sequelize.define(
    'Migration',
    {
      version: { type: DataTypes.INTEGER, primaryKey: true },
      name: text(100),
      appliedAt: integer({ field: 'applied_at' }),
    },
    options('schema_migrations')
  )
  const Project = sequelize.define(
    'Project',
    {
      id: text(36, { primaryKey: true }),
      name: text(80),
      siteId: text(40, { field: 'site_id', unique: true }),
      origins: { type: DataTypes.TEXT, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      keyHash: text(64, { field: 'key_hash', unique: true }),
      keyPrefix: text(20, { field: 'key_prefix' }),
      createdAt: integer({ field: 'created_at' }),
    },
    options('projects')
  )
  const Session = sequelize.define(
    'Session',
    {
      tokenHash: text(64, { field: 'token_hash', primaryKey: true }),
      expiresAt: integer({ field: 'expires_at' }),
      passwordHash: text(64, { field: 'password_hash' }),
    },
    options('sessions', [{ name: 'sessions_expiry', fields: ['expires_at'] }])
  )
  const Event = sequelize.define(
    'Event',
    {
      id: integer({ primaryKey: true, autoIncrement: true }),
      projectId: text(36, { field: 'project_id', references: { model: 'projects', key: 'id' } }),
      eventId: text(128, { field: 'event_id' }),
      type: text(16),
      name: text(80),
      occurredAt: integer({ field: 'occurred_at' }),
      receivedAt: integer({ field: 'received_at' }),
      day: text(10),
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
    options('events', [
      { name: 'events_project_event_unique', unique: true, fields: ['project_id', 'event_id'] },
      { name: 'events_project_time', fields: ['project_id', 'occurred_at'] },
      { name: 'events_time', fields: ['occurred_at'] },
    ])
  )
  Event.belongsTo(Project, { foreignKey: 'projectId', as: 'project' })
  return { Setting, Migration, Project, Session, Event }
}
