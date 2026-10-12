import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { AppError } from '../../shared/errors.mjs'
import { hashToken } from '../../shared/crypto.mjs'

export const SESSION_LIFETIME_SECONDS = 7 * 86400

function hashPassword(password, salt) {
  return scryptSync(password, salt, 32).toString('hex')
}

function passwordMatches(password, salt, expected) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex')
  const stored = Buffer.from(expected, 'hex')
  return actual.length === stored.length && timingSafeEqual(actual, stored)
}

async function issueSession(repository, admin, previousToken, clock) {
  if (previousToken) await repository.revoke(hashToken(previousToken))
  const token = randomBytes(32).toString('base64url')
  await repository.create({
    tokenHash: hashToken(token),
    expiresAt: clock() + SESSION_LIFETIME_SECONDS * 1000,
    passwordHash: admin.passwordHash,
  })
  return token
}

export function createAuthService({ repository, clock }) {
  return {
    async initialize() {
      const admin = await repository.findAdmin()
      if (!admin) await repository.revokeAll()
      else await repository.revokeOtherPasswords(admin.passwordHash)
    },
    async setupRequired() {
      return !(await repository.findAdmin())
    },
    async setup({ username, password }, previousToken) {
      const salt = randomBytes(16).toString('base64url')
      const admin = await repository.createAdmin({
        username,
        passwordHash: hashPassword(password, salt),
        passwordSalt: salt,
        createdAt: clock(),
      })
      if (!admin) throw new AppError('CONFLICT', '管理员已经创建，请直接登录')
      return { token: await issueSession(repository, admin, previousToken, clock), username }
    },
    async login({ username, password }, previousToken) {
      const admin = await repository.findAdmin()
      const passwordOk = passwordMatches(
        password,
        admin?.passwordSalt ?? 'unset-admin-salt',
        admin?.passwordHash ?? '0'.repeat(64)
      )
      if (!admin || admin.username !== username || !passwordOk)
        throw new AppError('UNAUTHORIZED', '账号或密码不正确')
      return {
        token: await issueSession(repository, admin, previousToken, clock),
        username: admin.username,
      }
    },
    async authenticate(token) {
      const admin = await repository.findAdmin()
      if (
        !token ||
        !admin ||
        !(await repository.findActive(hashToken(token), clock(), admin.passwordHash))
      )
        throw new AppError('UNAUTHORIZED', '请登录 Visora')
      return { name: admin.username, role: 'admin' }
    },
    async logout(token) {
      if (token) await repository.revoke(hashToken(token))
    },
  }
}
