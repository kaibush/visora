import { devices, expect, test } from 'playwright/test'

for (const mobile of [false, true]) {
  test(`大模型接入 ${mobile ? 'iPhone' : '桌面'}：按项目保存字段并复制提示词`, async ({
    playwright,
    baseURL,
  }, testInfo) => {
    const browser = await (mobile ? playwright.webkit : playwright.chromium).launch()
    const context = await browser.newContext({
      baseURL,
      ...(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1100 } }),
      colorScheme: 'light',
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copied = text
          },
        },
      })
    })
    const page = await context.newPage()
    const ids = []
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const prefix = mobile ? '手机提示词' : '桌面提示词'
    try {
      expect(
        (await page.request.post('/api/auth/login', {
          data: { username: 'admin', password: 'visora-e2e-password-only' },
        })).ok()
      ).toBe(true)
      const created = []
      for (const [name, origin] of [
        [`${prefix}-甲`, 'https://alpha.example.com'],
        [`${prefix}-乙`, 'https://beta.example.com'],
      ]) {
        const response = await page.request.post('/api/projects', {
          data: { name, origins: [origin] },
        })
        expect(response.status()).toBe(201)
        const body = await response.json()
        ids.push(body.project.id)
        created.push(body.project)
      }
      const [first, second] = created
      await page.goto(`/prompts?project=${first.id}`)
      await expect(page.getByRole('heading', { name: '大模型接入', exact: true })).toBeVisible()
      if (mobile) {
        const navigation = page.getByRole('navigation', { name: '主导航' })
        await expect(navigation).toBeVisible()
        await expect(navigation).not.toContainText('大模型')
      }
      const idField = page.getByRole('textbox', { name: '用户 ID 路径（必填）' })
      const nameField = page.getByRole('textbox', { name: '显示名称路径（可选）' })
      const emailField = page.getByRole('textbox', { name: '邮箱路径（可选）' })
      await expect(idField).toHaveValue('id')
      await expect(nameField).toHaveValue('name')
      await expect(emailField).toHaveValue('email')
      const prompt = page.locator('pre')
      await expect(prompt).toContainText(`data-site="${first.siteId}"`)
      await expect(prompt).toContainText('data-wait-for-user="true"')
      await expect(prompt).toContainText('id: currentUser.id')
      await expect(prompt).toContainText('export function syncVisoraUser')
      await expect(prompt).not.toContainText('vs_')

      await idField.fill('userId')
      await nameField.fill('profile.displayName')
      await emailField.fill('')
      await page.getByRole('button', { name: '保存字段映射', exact: true }).click()
      await expect(page.getByText('本项目的用户字段已保存', { exact: true })).toBeVisible()
      await page.goto(`/prompts?project=${first.id}`)
      await expect(idField).toHaveValue('userId')
      await expect(nameField).toHaveValue('profile.displayName')
      await expect(emailField).toHaveValue('')
      const saved = await page.request.get('/api/projects')
      const stored = (await saved.json()).projects.find(
        (project: { id: string }) => project.id === first.id
      )
      expect(stored.userIdField).toBe('userId')
      expect(stored.userNameField).toBe('profile.displayName')
      expect(stored.userEmailField).toBe('')
      await expect(prompt).toContainText('id: currentUser.userId')
      await expect(prompt).toContainText('name: currentUser.profile.displayName')
      await expect(prompt).not.toContainText('currentUser.email')
      await expect(prompt).toContainText(first.name)
      await expect(prompt).toContainText('https://alpha.example.com')

      await page.getByRole('combobox', { name: '选择项目' }).click()
      await page.getByRole('option', { name: second.name, exact: true }).click()
      await expect(idField).toHaveValue('id')
      await expect(emailField).toHaveValue('email')
      await expect(prompt).toContainText(`data-site="${second.siteId}"`)
      await expect(prompt).toContainText('id: currentUser.id')
      await expect(prompt).not.toContainText('currentUser.userId')

      await page.getByRole('combobox', { name: '选择项目' }).click()
      await page.getByRole('option', { name: first.name, exact: true }).click()
      await expect(idField).toHaveValue('userId')
      await page.getByRole('button', { name: '复制', exact: true }).click()
      await expect(page.getByText('已复制到剪贴板', { exact: true })).toBeVisible()
      const copied = await page.evaluate(() => window.__copied)
      expect(copied).toContain(`data-site="${first.siteId}"`)
      expect(copied).toContain('name: currentUser.profile.displayName')
      expect(copied).toContain('export function syncVisoraUser')
      expect(copied).not.toContain('vs_')

      await idField.fill('user["id"]')
      await expect(page.getByRole('alert')).toContainText('用户 ID 需要是字段路径')
      await expect(page.getByRole('button', { name: '保存字段映射', exact: true })).toBeDisabled()
      await expect(page.getByText('字段路径修正后才会生成提示词。')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      ).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`prompts-${prefix}.png`), fullPage: true })

      if (!mobile) {
        await page.goto('/projects')
        await page.getByRole('textbox', { name: '搜索项目' }).fill(first.name)
        const install = page.getByRole('button', { name: '接入代码', exact: true })
        await expect(install).toHaveCount(1)
        await install.click()
        await page.getByRole('link', { name: '生成大模型提示词', exact: true }).click()
        await expect(page.getByRole('heading', { name: '大模型接入', exact: true })).toBeVisible()
        await expect(idField).toHaveValue('userId')
        await page.goto('/integrations')
        await page.getByRole('tab', { name: '登录用户', exact: true }).click()
        await page.getByRole('link', { name: '按项目生成大模型提示词', exact: true }).click()
        await expect(page.getByRole('heading', { name: '大模型接入', exact: true })).toBeVisible()
        await page.getByRole('link', { name: '大模型接入', exact: true }).click()
        await expect(page).toHaveURL(/\/prompts\/?$/)
      }
      expect(errors).toEqual([])
    } finally {
      for (const id of ids) await page.request.delete(`/api/projects/${id}`)
      await browser.close()
    }
  })
}
