import { DataTypes } from 'sequelize'

export const projectUserFields = {
  version: 7,
  name: 'per-project login user field paths',
  async up({ queryInterface, transaction }) {
    const columns = await queryInterface.describeTable('projects', { transaction })
    for (const name of ['user_id_field', 'user_name_field', 'user_email_field']) {
      if (!columns[name]) {
        await queryInterface.addColumn(
          'projects',
          name,
          { type: DataTypes.STRING(80), allowNull: true },
          { transaction }
        )
      }
    }
  },
}
