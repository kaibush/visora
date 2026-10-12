export async function projectRoutes(app, { service, requireAdmin }) {
  app.addHook('onRequest', requireAdmin)
  app.get('/', async () => ({ projects: await service.list() }))
  app.post('/', async (request, reply) => reply.code(201).send(await service.create(request.body)))
  app.patch('/:id', async (request) => ({
    project: await service.update(request.params.id, request.body),
  }))
  app.post('/:id/rotate-key', async (request) => ({
    key: await service.rotateKey(request.params.id),
  }))
}
