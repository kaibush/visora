import { Op } from 'sequelize'

/** The database unique index is the final guard; the project lock makes counts exact. */
export function createEventRepository(database) {
  const { Event, Project } = database.models
  return {
    async insertBatch(events) {
      return database.transaction(async (transaction) => {
        const projectId = events[0].projectId
        await Project.findByPk(projectId, { transaction, lock: transaction.LOCK.UPDATE })
        const unique = new Map()
        for (const event of events) if (!unique.has(event.eventId)) unique.set(event.eventId, event)
        const existing = await Event.findAll({
          attributes: ['eventId'],
          where: { projectId, eventId: { [Op.in]: [...unique.keys()] } },
          transaction,
          raw: true,
        })
        for (const event of existing) unique.delete(event.eventId)
        if (unique.size)
          await Event.bulkCreate([...unique.values()], { transaction, validate: true })
        return { accepted: unique.size, duplicates: events.length - unique.size }
      })
    },
    deleteBefore(timestamp) {
      return Event.destroy({ where: { occurredAt: { [Op.lt]: timestamp } } })
    },
  }
}
