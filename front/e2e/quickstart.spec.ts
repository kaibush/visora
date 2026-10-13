import { test, expect } from 'playwright/test'

test('quick integration waits for identity, handles either load order, and keeps automatic routes', async ({ page, context }, testInfo) => {
  await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'visora-e2e-password-only' } })
  const { project } = await (await page.request.post('/api/projects', {
    data: { name: 'quick browser integration', origins: ['http://127.0.0.1:4318'] },
  })).json()
  const events = async () => (await (await page.request.get(`/api/events?project=${project.id}`)).json()).events
  const website = await context.newPage()
  const errors: string[] = []
  website.on('pageerror', (error) => errors.push(error.message))
  await website.goto(`http://127.0.0.1:4318/?site=${project.siteId}&wait=1`)
  await website.waitForLoadState('networkidle')
  expect(await events()).toHaveLength(0)
  await website.evaluate(async () => {
    const helperUrl = new URL('/visora-user.js', location.href).href
    const { syncVisoraUser } = await import(helperUrl)
    syncVisoraUser(undefined) // Auth is still loading; don't release anonymous collection.
    history.pushState({}, '', '/current')
    const tracker = (window as unknown as { visora: { identify: (user: unknown) => boolean; track: (name: string) => void } }).visora
    tracker.track('before_identity')
    if (tracker.identify({ id: '' })) throw new Error('Invalid identity was accepted')
  })
  expect(await events()).toHaveLength(0)
  await website.evaluate(async () => {
    const helperUrl = new URL('/visora-user.js', location.href).href
    const { syncVisoraUser } = await import(helperUrl)
    const user = { id: 42, name: '张三', email: 'quick@example.com' }
    syncVisoraUser(user)
    syncVisoraUser(user) // Repeated auth notifications must not add pageviews.
    history.pushState({}, '', '/profile?private=hidden')
    history.replaceState({}, '', '/profile?private=changed')
    syncVisoraUser({ id: 'bob', name: '李四' })
    history.pushState({}, '', '/settings')
    syncVisoraUser(null)
    history.pushState({}, '', '/signed-out')
  })
  await expect.poll(async () => (await events()).length).toBe(4)
  const rows = await events()
  expect(rows.find((row: { path: string }) => row.path === '/current')).toMatchObject({ user_id: '42', user_name: '张三', user_email: 'quick@example.com', source: 'browser', browser: 'Chrome', device: 'Desktop' })
  expect(rows.find((row: { path: string }) => row.path === '/profile')).toMatchObject({ user_id: '42' })
  expect(rows.find((row: { path: string }) => row.path === '/settings')).toMatchObject({ user_id: 'bob' })
  expect(rows.find((row: { path: string }) => row.path === '/signed-out')).toMatchObject({ user_id: null })
  expect(rows.every((row: { type: string }) => row.type === 'pageview')).toBe(true)

  // The business app may resolve or change users before the deferred script downloads.
  for (const guest of [false, true]) {
    const slowWebsite = await context.newPage()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    await slowWebsite.route('**/tracker.js', async (route) => { await gate; await route.continue() })
    const routePath = guest ? '/early-logout' : '/early-login'
    await slowWebsite.goto(`http://127.0.0.1:4318${routePath}?site=${project.siteId}&wait=1`, { waitUntil: 'commit' })
    await slowWebsite.evaluate(async (isGuest) => {
      const helperUrl = new URL('/visora-user.js', location.href).href
      const { syncVisoraUser } = await import(helperUrl)
      syncVisoraUser({ id: 'stale-user' })
      const user = { id: 'latest-user', name: '最新用户' }
      syncVisoraUser(user)
      user.name = 'mutated after sync'
      if (isGuest) syncVisoraUser(null)
    }, guest)
    release()
    await slowWebsite.waitForFunction(() => 'visora' in window)
    await expect.poll(async () => (await events()).filter((row: { path: string }) => row.path === routePath).length).toBe(1)
    const matches = (await events()).filter((row: { path: string }) => row.path === routePath)
    expect(matches[0]).toMatchObject(guest ? { user_id: null, user_name: null } : { user_id: 'latest-user', user_name: '最新用户' })
    await slowWebsite.close()
  }

  // Existing manual mode still requires explicit pageviews, even after identity resolves.
  const manualWebsite = await context.newPage()
  await manualWebsite.goto(`http://127.0.0.1:4318/manual?site=${project.siteId}&wait=1&manual=1`)
  await manualWebsite.evaluate(async () => {
    const helperUrl = new URL('/visora-user.js', location.href).href
    const { syncVisoraUser } = await import(helperUrl)
    syncVisoraUser(null)
    history.pushState({}, '', '/manual-current')
  })
  expect(await events()).toHaveLength(6)
  await manualWebsite.evaluate(() => (window as unknown as { visora: { pageview: () => void } }).visora.pageview())
  await expect.poll(async () => (await events()).length).toBe(7)
  await manualWebsite.close()

  await page.goto('/integrations')
  await expect(page.getByRole('heading', { name: '接入指南' })).toBeVisible()
  await expect(page.locator('pre', { hasText: '/tracker.js' })).toBeVisible()
  await page.getByRole('tab', { name: '登录用户', exact: true }).click()
  await page.getByText('展开同步模块源码', { exact: false }).click()
  await expect(page.locator('pre', { hasText: 'export function syncVisoraUser' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('visora-quickstart-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.getByRole('link', { name: '访问明细', exact: true }).click()
  await page.getByLabel('用户 ID', { exact: true }).fill('42')
  await page.getByRole('button', { name: '筛选用户', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: '/current' })).toContainText('quick@example.com')
  await expect(page.getByRole('row').filter({ hasText: '/current' })).toContainText(rows[0].os)
  await website.close()
  expect(errors).toEqual([])
})
