import { Op } from 'sequelize'

export function createSessionRepository(database) {
  const { Session, Admin } = database.models
  return {
    findActive(tokenHash, timestamp, passwordHash) {
      return Session.findOne({
        where: { tokenHash, expiresAt: { [Op.gt]: timestamp }, passwordHash },
        raw: true,
      })
    },
    create(session) {
      return Session.create(session)
    },
    revoke(tokenHash) {
      return Session.destroy({ where: { tokenHash } })
    },
    revokeOtherPasswords(passwordHash) {
      return Session.destroy({ where: { passwordHash: { [Op.ne]: passwordHash } } })
    },
    revokeAll() {
      return Session.destroy({ where: { expiresAt: { [Op.gte]: 0 } } })
    },
    deleteExpired(timestamp) {
      return Session.destroy({ where: { expiresAt: { [Op.lte]: timestamp } } })
    },
    findAdmin() {
      return Admin.findOne({ where: { id: 1 }, raw: true })
    },
    async createAdmin(admin) {
      try {
        return await database.transaction(async (transaction) => {
          if (await Admin.findOne({ where: { id: 1 }, transaction })) return null
          const created = await Admin.create({ id: 1, ...admin }, { transaction })
          return created.get({ plain: true })
        })
      } catch (error) {
        if (error?.name === 'SequelizeUniqueConstraintError') return null
        throw error
      }
    },
  }
}
