import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createKeyVault } from '../src/infrastructure/crypto/key-vault.mjs'

test('a generated encryption key persists and concurrent initializers share it', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'visora-vault-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const config = { encryptionKeyFile: join(directory, 'encryption.key') }
  const vaults = await Promise.all(Array.from({ length: 3 }, () => createKeyVault(config)))
  const encrypted = vaults[0].encrypt('vs_test-secret', 'project-a')
  for (const vault of vaults) assert.equal(vault.decrypt(encrypted, 'project-a'), 'vs_test-secret')
  const restarted = await createKeyVault(config)
  assert.equal(restarted.decrypt(encrypted, 'project-a'), 'vs_test-secret')
  assert.equal((await stat(config.encryptionKeyFile)).mode & 0o777, 0o600)
})

test('encrypted keys reject the wrong master key, project and authentication tag', async () => {
  const vault = await createKeyVault({ encryptionKey: 'a'.repeat(64) })
  const otherVault = await createKeyVault({ encryptionKey: 'b'.repeat(64) })
  const encrypted = vault.encrypt('vs_test-secret', 'project-a')
  assert.notEqual(encrypted, vault.encrypt('vs_test-secret', 'project-a'))
  assert.throws(() => vault.decrypt(encrypted, 'project-b'))
  assert.throws(() => otherVault.decrypt(encrypted, 'project-a'))
  const parts = encrypted.split('.')
  parts[2] = Buffer.alloc(16).toString('base64url')
  assert.throws(() => vault.decrypt(parts.join('.'), 'project-a'))
})
