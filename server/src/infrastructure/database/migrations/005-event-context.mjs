import { DataTypes } from 'sequelize'

export const eventContext = {
  version: 5,
  name: 'visitor IP and automatic interaction context',
  async up({ queryInterface, transaction }) {
    const columns = await queryInterface.describeTable('events', { transaction })
    for (const [name, length] of [['ip', 45], ['action', 16], ['target', 512], ['label', 120]]) {
      if (!columns[name]) await queryInterface.addColumn('events', name, {
        type: DataTypes.STRING(length), allowNull: true,
      }, { transaction })
    }
  },
}
