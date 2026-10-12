import { DataTypes } from 'sequelize'

export const projectKeyCiphertext = {
  version: 3,
  name: 'recoverable encrypted project keys',
  async up({ queryInterface, transaction }) {
    const columns = await queryInterface.describeTable('projects', { transaction })
    if (!columns.key_ciphertext) {
      await queryInterface.addColumn(
        'projects',
        'key_ciphertext',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      )
    }
    // Old hashes cannot be reversed. Keep existing credentials valid until an explicit rotation.
  },
}
