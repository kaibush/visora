import { createHash } from 'node:crypto'

// High-entropy API keys/session tokens only. Human passwords use scrypt in auth/service.
export const hashToken = (value) => createHash('sha256').update(value).digest('hex')
