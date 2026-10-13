import { fn, col } from 'sequelize'

function fieldOr(value, fallback) {
  return value === null || value === undefined ? fallback : value
}

function toProject(row, stats = {}) {
  if (!row) return null
  return {
    ...row,
    origins: JSON.parse(row.origins),
    enabled: Boolean(row.enabled),
    createdAt: Number(row.createdAt),
    userIdField: fieldOr(row.userIdField, 'id'),
    userNameField: fieldOr(row.userNameField, 'name'),
    userEmailField: fieldOr(row.userEmailField, 'email'),
    lastEvent: stats.lastEvent ? Number(stats.lastEvent) : null,
    totalEvents: Number(stats.totalEvents ?? 0),
  }
}

export function createProjectRepository(database) {
  const { Project, Event } = database.models
  return {
    async get(id) {
      return toProject(await Project.findByPk(id, { raw: true }))
    },
    async findBySiteId(siteId) {
      return toProject(await Project.findOne({ where: { siteId }, raw: true }))
    },
    async findByKeyHash(keyHash) {
      return toProject(await Project.findOne({ where: { keyHash }, raw: true }))
    },
    async list() {
      const [projects, aggregates] = await Promise.all([
        Project.findAll({
          order: [
            ['createdAt', 'DESC'],
            ['id', 'ASC'],
          ],
          raw: true,
        }),
        Event.findAll({
          attributes: [
            'projectId',
            [fn('MAX', col('occurred_at')), 'lastEvent'],
            [fn('COUNT', col('id')), 'totalEvents'],
          ],
          group: [col('project_id')],
          raw: true,
        }),
      ])
      const byProject = new Map(aggregates.map((row) => [row.projectId, row]))
      return projects.map((row) => toProject(row, byProject.get(row.id)))
    },
    create(project) {
      return Project.create({ ...project, origins: JSON.stringify(project.origins) })
    },
    update(project) {
      return Project.update(
        {
          name: project.name,
          origins: JSON.stringify(project.origins),
          enabled: project.enabled,
          userIdField: project.userIdField,
          userNameField: project.userNameField,
          userEmailField: project.userEmailField,
        },
        { where: { id: project.id } }
      )
    },
    rotateKey(id, keyHash, keyPrefix, keyCiphertext) {
      return Project.update({ keyHash, keyPrefix, keyCiphertext }, { where: { id } })
    },
    async remove(id) {
      return database.transaction(async (transaction) => {
        const project = await Project.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
        if (!project) return false
        await Event.destroy({ where: { projectId: id }, transaction })
        await project.destroy({ transaction })
        return true
      })
    },
  }
}
