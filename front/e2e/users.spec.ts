import { devices, expect, test } from 'playwright/test'

for (const mobile of [false, true]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`用户列表 ${mobile ? 'iPhone' : '桌面'} ${colorScheme}：排行、搜索与访问下钻`, async ({ playwright, baseURL }, testInfo) => {
      const browser = await (mobile ? playwright.webkit : playwright.chromium).launch()
      const context = await browser.newContext({ baseURL, ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1100 } }), colorScheme })
      const page = await context.newPage()
      const ids: string[] = []
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const prefix = `${mobile ? '手机' : '桌面'}-${colorScheme}`
      const firstName = `张三-${prefix}`
      const ip = '2001:db8:1234:5678:abcd:ffff:1234:5678'
      try {
        expect((await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'visora-e2e-password-only' } })).ok()).toBe(true)
        for (const index of [1, 2]) {
          const response = await page.request.post('/api/projects', { data: { name: `用户测试-${prefix}-${index}`, origins: [] } })
          expect(response.status()).toBe(201)
          const { project, key } = await response.json()
          ids.push(project.id)
          expect((await page.request.post('/api/ingest', { headers: { Authorization: `Bearer ${key}` }, data: { events: [
            { eventId: 'user-visit', visitorId: `visitor-${index}`, sessionId: 'session', path: `/directory-${index}`, ip, user: { id: '42', name: index === 1 ? firstName : `李四-${prefix}`, email: `user-${index}@example.com` } },
            ...(index === 1 ? [{ eventId: 'user-event', visitorId: 'visitor-1', sessionId: 'session', path: '/directory-1', type: 'event', name: 'login', user: { id: '42' } }, { eventId: 'anonymous', visitorId: 'anon', sessionId: 'anonymous', path: '/anonymous', ip }] : []),
          ] } })).status()).toBe(202)
        }
        await page.goto('/users')
        await expect(page.getByRole('heading', { name: '用户列表', exact: true })).toBeVisible()
        if (mobile) await expect(page.getByRole('button', { name: '全部项目 · 今天', exact: true })).toBeVisible()
        else await expect(page.getByRole('combobox', { name: '日期范围' })).toHaveText('今天')
        await expect(page.getByRole('button', { name: `${firstName}，1 次浏览，查看明细` }).filter({ visible: true })).toBeVisible()
        if (!mobile) {
          const row = page.getByRole('row').filter({ hasText: firstName })
          await expect(row).toContainText('user-1@example.com')
          await expect(row).toContainText('用户测试')
        }
        await page.getByRole('textbox', { name: '搜索用户', exact: true }).fill(firstName)
        await page.getByRole('button', { name: '提交用户搜索' }).click()
        if (!mobile) await expect(page.getByRole('row').filter({ hasText: `李四-${prefix}` })).toHaveCount(0)
        await page.screenshot({ path: testInfo.outputPath(`users-${prefix}.png`), fullPage: true })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.getByRole('button', { name: `${firstName}，1 次浏览，查看明细` }).filter({ visible: true }).click()
        await expect(page.getByRole('heading', { name: '访问明细', exact: true })).toBeVisible()
        const detailResponse = await page.request.get(`/api/events?project=${ids[0]}&userId=42`)
        expect((await detailResponse.json()).total).toBe(2)
        await page.getByRole('link', { name: mobile ? '用户' : '用户列表', exact: true }).click()
        if (mobile) {
          await page.getByRole('button', { name: /今天/ }).first().click()
          await page.getByRole('button', { name: '清除', exact: true }).click()
          await page.keyboard.press('Escape')
          await page.getByRole('tab', { name: '热门 IP', exact: true }).click()
        } else await page.getByRole('button', { name: '清除', exact: true }).click()
        const ipRank = page.getByRole('button', { name: `${ip}，2 次浏览，查看明细` }).filter({ visible: true })
        await expect(ipRank).toBeVisible()
        await ipRank.click()
        await expect(page.getByRole('heading', { name: '访问明细', exact: true })).toBeVisible()
        if (mobile) await page.getByRole('button', { name: /IP 2001/ }).click()
        await expect(page.getByRole('button', { name: '清除 IP 筛选' })).toBeVisible()
        expect((await (await page.request.get(`/api/events?project=${ids[0]}&ip=${encodeURIComponent(ip)}`)).json()).total).toBe(2)
        await page.getByRole('button', { name: '清除 IP 筛选' }).click()
        if (mobile) await page.keyboard.press('Escape')
        expect(errors).toEqual([])
      } finally {
        for (const id of ids) await page.request.delete(`/api/projects/${id}`)
        await browser.close()
      }
    })
  }
}
