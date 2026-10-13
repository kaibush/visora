import { devices, expect, test } from 'playwright/test'

for (const mobile of [false, true]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`项目卡片 ${mobile ? 'iPhone' : '桌面'} ${colorScheme}：信息层级、搜索与操作`, async ({
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
        colorScheme,
      })
      const page = await context.newPage()
      const projectIds: string[] = []
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const prefix = `卡片回归 ${mobile ? 'iPhone' : '桌面'} ${colorScheme}`
      const longName = `${prefix} ${'超长名称'.repeat(12)}`
      const origin = `https://${'long-domain-'.repeat(8)}example.com`
      try {
        expect(
          (
            await page.request.post('/api/auth/login', {
              data: { username: 'admin', password: 'visora-e2e-password-only' },
            })
          ).ok()
        ).toBe(true)
        const fixtures = [
          {
            name: longName,
            origins: [
              origin,
              'https://second.example.com',
              'https://third.example.com',
            ],
            enabled: true,
          },
          {
            name: `${prefix} 等待接入`,
            origins: ['https://waiting.example.com'],
            enabled: true,
          },
          { name: `${prefix} 服务端`, origins: [], enabled: false },
        ]
        for (const fixture of fixtures) {
          const response = await page.request.post('/api/projects', {
            data: fixture,
          })
          expect(response.status()).toBe(201)
          const { project, key } = await response.json()
          projectIds.push(project.id)
          if (fixture.name === longName) {
            expect(
              (
                await page.request.post('/api/ingest', {
                  headers: { Authorization: `Bearer ${key}` },
                  data: {
                    events: [
                      {
                        eventId: 'card-regression',
                        type: 'pageview',
                        path: '/card-regression',
                        visitorId: 'card-visitor',
                        sessionId: 'card-session',
                      },
                    ],
                  },
                })
              ).status()
            ).toBe(202)
          }
        }
        await page.goto('/projects')
        const search = page.getByRole('textbox', { name: '搜索项目' })
        await search.fill(prefix)
        const cards = page.getByRole('article').filter({ hasText: prefix })
        await expect(cards).toHaveCount(3)
        const activeCard = page.getByRole('article', {
          name: `${longName} 项目`,
          exact: true,
        })
        await expect(
          activeCard.getByRole('heading', { name: longName, exact: true })
        ).toBeVisible()
        await expect(
          activeCard.getByText('已收到数据', { exact: true })
        ).toBeVisible()
        await expect(activeCard.locator('dd')).toHaveText('1')
        await expect(activeCard.getByLabel('另有 2 个来源')).toHaveText('+2')
        await expect(activeCard.locator('time')).toBeVisible()
        await expect(cards.getByText('等待接入', { exact: true })).toBeVisible()
        await expect(cards.getByText('已暂停', { exact: true })).toBeVisible()
        await expect(
          cards.getByText('仅服务端接入', { exact: true })
        ).toBeVisible()
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1
          )
        ).toBe(true)
        expect(
          await cards.evaluateAll((elements) => {
            const heights = elements.map(
              (element) => element.getBoundingClientRect().height
            )
            return Math.max(...heights) - Math.min(...heights) < 2
          })
        ).toBe(true)
        await page.screenshot({
          path: testInfo.outputPath('project-cards.png'),
          fullPage: true,
        })
        await search.fill('second.example.com')
        await expect(cards).toHaveCount(1)
        await activeCard
          .getByRole('button', { name: '接入代码', exact: true })
          .click()
        await expect(
          page
            .getByRole('dialog')
            .getByRole('heading', { name: `接入 ${longName}`, exact: true })
        ).toBeVisible()
        await page
          .getByRole('dialog')
          .getByRole('button', { name: '关闭弹窗', exact: true })
          .click()
        await activeCard
          .getByRole('button', { name: '查看密钥', exact: true })
          .click()
        await expect(page.getByRole('dialog').locator('code')).toBeVisible()
        await page
          .getByRole('dialog')
          .getByRole('button', { name: '关闭', exact: true })
          .click()
        const menuTrigger = activeCard.getByRole('button', {
          name: `${longName} 项目操作`,
          exact: true,
        })
        await menuTrigger.click()
        const pause = mobile
          ? page
              .getByRole('dialog')
              .getByRole('button', { name: '暂停采集', exact: true })
          : page.getByRole('menuitem', { name: '暂停采集', exact: true })
        await pause.click()
        await expect(page.getByRole(mobile ? 'dialog' : 'menu')).toBeHidden()
        await expect(
          activeCard.getByText('已暂停', { exact: true })
        ).toBeVisible()
        await menuTrigger.click()
        const edit = mobile
          ? page
              .getByRole('dialog')
              .getByRole('button', { name: '编辑设置', exact: true })
          : page.getByRole('menuitem', { name: '编辑设置', exact: true })
        await edit.click()
        await expect(
          page.getByRole('textbox', { name: '项目名称', exact: true })
        ).toHaveValue(longName)
        await expect(
          page.getByRole('textbox', { name: '允许的网站来源', exact: true })
        ).toHaveValue(fixtures[0].origins.join('\n'))
        await page.getByRole('button', { name: '取消', exact: true }).click()
        await expect(page.getByRole('dialog')).toBeHidden()
        await menuTrigger.click()
        await expect(edit).toBeVisible()
        await page.keyboard.press('Escape')
        await search.fill('没有这个项目的搜索词')
        await expect(cards).toHaveCount(0)
        await expect(
          page.getByText('没有匹配的项目', { exact: true })
        ).toBeVisible()
        expect(errors).toEqual([])
      } finally {
        for (const id of projectIds)
          await page.request.delete(`/api/projects/${id}`)
        await browser.close()
      }
    })
  }
}
