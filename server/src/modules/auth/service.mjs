import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { AppError } from '../../shared/errors.mjs'
import { hashToken } from '../../shared/crypto.mjs'

export const SESSION_LIFETIME_SECONDS = 7 * 86400

export function createAuthService({ repository, password, salt, clock }) {
  const passwordHash = scryptSync(password, salt, 32).toString('hex')
  return {
    async initialize() {
      await repository.revokeOtherPasswords(passwordHash)
    },
    async login(candidate, previousToken) {
      if (!timingSafeEqual(scryptSync(candidate, salt, 32), Buffer.from(passwordHash, 'hex')))
        throw new AppError('UNAUTHORIZED', '管理密码不正确')
      if (previousToken) await repository.revoke(hashToken(previousToken))
      const token = randomBytes(32).toString('base64url')
      await repository.create({
        tokenHash: hashToken(token),
        expiresAt: clock() + SESSION_LIFETIME_SECONDS * 1000,
        passwordHash,
      })
      return token
    },
    async authenticate(token) {
      if (!token || !(await repository.findActive(hashToken(token), clock(), passwordHash)))
        throw new AppError('UNAUTHORIZED', '请登录 Visora')
      return { name: 'Visora', role: 'admin' }
    },
    async logout(token) {
      if (token) await repository.revoke(hashToken(token))
    },
  }
}
