import { randomBytes, randomUUID } from 'node:crypto'
import { hashToken } from '../../shared/crypto.mjs'
import { AppError } from '../../shared/errors.mjs'
import { projectSchema, projectPatchSchema } from './schemas.mjs'

function presentProject(project) {
  return {
    id: project.id,
    name: project.name,
    siteId: project.siteId,
    origins: project.origins,
    enabled: project.enabled,
    keyPrefix: project.keyPrefix,
    createdAt: project.createdAt,
    userIdField: project.userIdField || 'id',
    userNameField: project.userNameField ?? 'name',
    userEmailField: project.userEmailField ?? 'email',
    lastEvent: project.lastEvent ?? null,
    totalEvents: project.totalEvents ?? 0,
  }
}

export function createProjectService({ repository, clock, keyVault }) {
  async function get(id) {
    const project = await repository.get(id)
    if (!project) throw new AppError('NOT_FOUND', '项目不存在')
    return project
  }
  return {
    get,
    async list() {
      return (await repository.list()).map(presentProject)
    },
    async create(input) {
      const data = projectSchema.parse(input)
      const key = `vs_${randomBytes(32).toString('base64url')}`
      const id = randomUUID()
      const project = {
        ...data,
        id,
        siteId: `v_${randomBytes(12).toString('hex')}`,
        keyHash: hashToken(key),
        keyCiphertext: keyVault.encrypt(key, id),
        keyPrefix: key.slice(0, 11),
        createdAt: clock(),
      }
      await repository.create(project)
      return { project: presentProject(project), key }
    },
    async update(id, input) {
      const existing = await get(id)
      const project = { ...existing, ...projectPatchSchema.parse(input) }
      await repository.update(project)
      return presentProject(project)
    },
    async revealKey(id) {
      const project = await get(id)
      if (!project.keyCiphertext) return null
      try {
        const key = keyVault.decrypt(project.keyCiphertext, id)
        if (hashToken(key) !== project.keyHash) throw new Error('Stored key mismatch')
        return key
      } catch {
        throw new AppError('CONFLICT', '密钥无法解密，请恢复原加密配置或轮换密钥')
      }
    },
    async rotateKey(id) {
      await get(id)
      const key = `vs_${randomBytes(32).toString('base64url')}`
      await repository.rotateKey(id, hashToken(key), key.slice(0, 11), keyVault.encrypt(key, id))
      return key
    },
    async remove(id) {
      if (!(await repository.remove(id))) throw new AppError('NOT_FOUND', '项目不存在')
    },
    async authorizeBrowser(siteId, origin) {
      const project = await repository.findBySiteId(siteId)
      if (!project?.enabled || !origin || !project.origins.includes(origin))
        throw new AppError('FORBIDDEN', '项目未启用或网站来源未授权')
      return project
    },
    async authorizeServer(token) {
      const project = token && (await repository.findByKeyHash(hashToken(token)))
      if (!project?.enabled) throw new AppError('UNAUTHORIZED', '项目密钥无效或项目已暂停')
      return project
    },
  }
}
