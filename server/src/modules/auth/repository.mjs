import { Op } from 'sequelize'

export function createSessionRepository({ models }) {
  const { Session } = models
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
    deleteExpired(timestamp) {
      return Session.destroy({ where: { expiresAt: { [Op.lte]: timestamp } } })
    },
  }
}
