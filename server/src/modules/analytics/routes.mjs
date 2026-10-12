export async function analyticsRoutes(app, { service, requireAdmin }) {
  app.addHook('onRequest', requireAdmin)
  app.get('/analytics', async (request) => service.report(request.query))
  app.get('/events', async (request) => service.events(request.query))
  app.get('/export', async (request, reply) => {
    const { csv, filename } = await service.export(request.query)
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
    return csv
  })
}
