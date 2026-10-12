import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

function decodeKey(value) {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('Visora: encryption key must contain exactly 64 hexadecimal characters')
  }
  return Buffer.from(value, 'hex')
}

async function loadKey(config) {
  if (config.encryptionKey) return decodeKey(config.encryptionKey)
  const filename = config.encryptionKeyFile
  try {
    return decodeKey((await readFile(filename, 'utf8')).trim())
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  // Link a completed file atomically. Concurrent initializers use the same winner.
  const temporary = `${filename}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 })
    try {
      await link(temporary, filename)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
  } finally {
    await rm(temporary, { force: true })
  }
  return decodeKey((await readFile(filename, 'utf8')).trim())
}

/** Encryption stays outside business services; AAD binds each secret to its project. */
export async function createKeyVault(config) {
  const key = await loadKey(config)
  const context = (projectId) => Buffer.from(`visora:project-key:v1:${projectId}`)
  return {
    encrypt(value, projectId) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(context(projectId))
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      return [
        'v1',
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        encrypted.toString('base64url'),
      ].join('.')
    },
    decrypt(value, projectId) {
      const parts = value.split('.')
      if (parts.length !== 4 || parts[0] !== 'v1')
        throw new Error('Unsupported encrypted key format')
      const [, nonce, tag, payload] = parts
      const iv = Buffer.from(nonce, 'base64url')
      const authTag = Buffer.from(tag, 'base64url')
      if (iv.length !== 12 || authTag.length !== 16) throw new Error('Invalid encrypted key format')
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAAD(context(projectId))
      decipher.setAuthTag(authTag)
      return Buffer.concat([
        decipher.update(Buffer.from(payload, 'base64url')),
        decipher.final(),
      ]).toString('utf8')
    },
  }
}
