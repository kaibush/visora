/** Uses repository contracts; can later be called by a dedicated worker/scheduler. */
export function createRetentionJob({ events, sessions, clock, retentionDays, logger }) {
  let running = null
  let timer = null
  function run() {
    if (running) return running
    const now = clock()
    running = (async () => {
      await events.deleteBefore(now - retentionDays * 86400000)
      await sessions.deleteExpired(now)
    })().finally(() => {
      running = null
    })
    return running
  }
  return {
    async start() {
      await run()
      timer = setInterval(() => {
        run().catch((err) => logger.error({ err }, 'Visora retention cleanup failed'))
      }, 3600000)
      timer.unref()
    },
    async stop() {
      clearInterval(timer)
      if (running) await running
    },
  }
}
