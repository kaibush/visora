import { devices, expect, test } from 'playwright/test'

for (const mobile of [false, true]) {
  test.describe(mobile ? 'iPhone 访问详情' : '桌面访问详情', () => {
    test('详情容纳长字段，支持页签、复制与关闭后继续操作', async ({
      playwright,
      baseURL,
    }, testInfo) => {
      const browser = await (
        mobile ? playwright.webkit : playwright.chromium
      ).launch()
      const context = await browser.newContext({
        baseURL,
        ...(mobile
          ? devices['iPhone 13']
          : { viewport: { width: 1440, height: 1000 } }),
      })
      const page = await context.newPage()
      try {
        await page.request.post('/api/auth/login', {
          data: { username: 'admin', password: 'visora-e2e-password-only' },
        })
        const name = `详情回归 ${mobile ? 'iPhone' : 'Desktop'}`
        const created = await page.request.post('/api/projects', {
          data: { name, origins: [] },
        })
        expect(created.status()).toBe(201)
        const { key, project } = await created.json()
        const visitor = `visitor-${'long-'.repeat(20)}`
        const session = `session-${'session-'.repeat(12)}`
        const path = `/reports/${'annual-report-'.repeat(30)}`
        const target = `main > ${'section.content > '.repeat(20)}button`
        const ingested = await page.request.post('/api/ingest', {
          headers: { Authorization: `Bearer ${key}` },
          data: {
            events: [
              {
                eventId: 'detail-regression',
                type: 'event',
                name: 'ui_interaction',
                visitorId: visitor,
                sessionId: session,
                path,
                user: {
                  id: 'customer-42',
                  name: '测试用户',
                  email: 'reader@example.com',
                },
                interaction: { action: 'click', label: '查看年度报告', target },
              },
            ],
          },
        })
        expect(ingested.status()).toBe(202)
        const recorded = await page.request.get(`/api/events?project=${project.id}`)
        const savedEvent = (await recorded.json()).events[0]
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: async (text: string) => {
                sessionStorage.setItem('test-copied-value', text)
              },
            },
          })
        })
        await page.goto('/events')
        const projectFilter = page.getByRole('combobox', {
          name: '筛选项目',
          exact: true,
        })
        if (mobile)
          await page.getByRole('button', { name: /全部项目 · 最近/ }).click()
        await projectFilter.click()
        await page.getByRole('option', { name, exact: true }).click()
        if (mobile)
          await page.getByRole('button', { name: '完成', exact: true }).click()
        const trigger = mobile
          ? page.getByRole('button').filter({ hasText: '查看年度报告' })
          : page.getByRole('button', { name: '详情', exact: true })
        await expect(trigger).toHaveCount(1)
        await trigger.click()
        const dialog = page.getByRole('dialog', { name: '访问详情' })
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText(path, { exact: true })).toBeVisible()
        await dialog.getByText('查看控件位置', { exact: true }).click()
        await expect(dialog.getByText(target, { exact: true })).toBeVisible()
        const geometry = await dialog.evaluate((el) => {
          const box = el.getBoundingClientRect()
          return {
            inside:
              box.x >= -1 &&
              box.right <= innerWidth + 1 &&
              box.y >= -1 &&
              box.bottom <= innerHeight + 1,
            fits: el.scrollWidth <= el.clientWidth + 1,
          }
        })
        expect(geometry).toEqual({ inside: true, fits: true })
        await expect(
          dialog.getByRole('button', { name: '完成', exact: true })
        ).toBeInViewport()
        await dialog
          .getByRole('tab', { name: '身份与会话', exact: true })
          .click()
        await expect(
          dialog.getByText('reader@example.com', { exact: true })
        ).toBeVisible()
        await dialog
          .getByRole('button', { name: '复制访客标识', exact: true })
          .click()
        expect(
          await page.evaluate(() => sessionStorage.getItem('test-copied-value'))
        ).toBe(savedEvent.visitor)
        await dialog
          .getByRole('button', { name: '复制会话标识', exact: true })
          .click()
        expect(
          await page.evaluate(() => sessionStorage.getItem('test-copied-value'))
        ).toBe(savedEvent.session)
        await page.screenshot({
          path: testInfo.outputPath('event-detail-identity.png'),
        })
        await dialog.getByRole('button', { name: '完成', exact: true }).click()
        await expect(dialog).toBeHidden()
        await expect(trigger).toBeFocused()
        await trigger.click()
        await expect(
          dialog.getByRole('tab', { name: '访问概况', exact: true })
        ).toHaveAttribute('data-state', 'active')
        await page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
        await expect(trigger).toBeFocused()
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          )
        ).toBe(true)
        await page.request.delete(`/api/projects/${project.id}`)
      } finally {
        await browser.close()
      }
    })
  })
}
