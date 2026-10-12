import { DataTypes, Op } from 'sequelize'

export const eventDay = {
  version: 2,
  name: 'portable UTC date buckets',
  async up({ sequelize, queryInterface, transaction }) {
    const columns = await queryInterface.describeTable('events', { transaction })
    if (!columns.day)
      await queryInterface.addColumn(
        'events',
        'day',
        { type: DataTypes.STRING(10), allowNull: true },
        { transaction }
      )
    // Keep the migration's mapping independent of future application model changes.
    const Event = sequelize.define(
      'MigrationEventV2',
      {
        id: { type: DataTypes.BIGINT, primaryKey: true },
        occurredAt: { type: DataTypes.BIGINT, field: 'occurred_at' },
        day: { type: DataTypes.STRING(10) },
      },
      { tableName: 'events', timestamps: false }
    )
    try {
      // Backfill without database-specific date functions. The nullable DB column
      // lets an interrupted MySQL DDL migration resume; new events require day in the ORM.
      while (true) {
        const rows = await Event.findAll({
          attributes: ['id', 'occurredAt'],
          where: { day: { [Op.is]: null } },
          order: [['id', 'ASC']],
          limit: 1000,
          raw: true,
          transaction,
        })
        if (!rows.length) break
        const buckets = new Map()
        for (const row of rows) {
          const day = new Date(Number(row.occurredAt)).toISOString().slice(0, 10)
          if (!buckets.has(day)) buckets.set(day, [])
          buckets.get(day).push(row.id)
        }
        for (const [day, ids] of buckets)
          await Event.update({ day }, { where: { id: { [Op.in]: ids } }, transaction })
      }
    } finally {
      sequelize.modelManager.removeModel(Event)
    }
  },
}
