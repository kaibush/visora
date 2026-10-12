import { DataTypes } from 'sequelize'

export const eventUser = {
  version: 4,
  name: 'optional business user snapshots',
  async up({ queryInterface, transaction }) {
    const columns = await queryInterface.describeTable('events', { transaction })
    for (const [name, length] of [
      ['user_id', 128],
      ['user_name', 120],
      ['user_email', 254],
    ]) {
      if (!columns[name]) {
        await queryInterface.addColumn(
          'events',
          name,
          {
            type: DataTypes.STRING(length),
            allowNull: true,
          },
          { transaction }
        )
      }
    }
    const name = 'events_project_user_time'
    const indexes = await queryInterface.showIndex('events', { transaction })
    if (!indexes.some((index) => index.name === name)) {
      await queryInterface.addIndex('events', ['project_id', 'user_id', 'occurred_at'], {
        name,
        transaction,
      })
    }
    // Existing anonymous events stay anonymous; identity is a snapshot at ingestion time.
  },
}
