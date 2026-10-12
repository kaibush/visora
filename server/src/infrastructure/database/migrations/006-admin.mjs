import { DataTypes } from 'sequelize'

export const adminAccount = {
  version: 6,
  name: 'first administrator account',
  async up({ queryInterface, transaction }) {
    if (await queryInterface.tableExists('admins', { transaction })) return
    await queryInterface.createTable(
      'admins',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        password_hash: { type: DataTypes.STRING(64), allowNull: false },
        password_salt: { type: DataTypes.STRING(64), allowNull: false },
        created_at: { type: DataTypes.BIGINT, allowNull: false },
      },
      { transaction, charset: 'utf8mb4', collate: 'utf8mb4_bin' }
    )
  },
}
