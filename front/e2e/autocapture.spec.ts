import { test, expect } from 'playwright/test'

test('one script captures dynamic controls and anonymous IP without collecting form values', async ({ page, context }) => {
  await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'visora-e2e-password-only' } })
  const { project } = await (await page.request.post('/api/projects', {
    data: { name: 'automatic interactions', origins: ['http://127.0.0.1:4318'] },
  })).json()
  const events = async () => (await (await page.request.get(`/api/events?project=${project.id}`)).json()).events
  const website = await context.newPage()
  await website.goto(`http://127.0.0.1:4318/?site=${project.siteId}`)
  await expect.poll(async () => (await events()).length).toBe(1)
  await website.evaluate(() => {
    document.body.innerHTML = `<button><span>刷新</span></button><div role="tab" tabindex="0">日志</div>
      <form><input aria-label="邮箱" value="private@example.com"><input type="password" value="secret-password">
      <select aria-label="范围"><option value="secret-a">今天</option><option value="secret-b">昨天</option></select>
      <input type="checkbox" aria-label="启用"><button>保存</button></form>
      <div data-visora-ignore><button>敏感按钮</button></div>
      <button>private@example.com</button><div contenteditable="true"><button>编辑内容</button></div>`
    document.querySelector('form')!.addEventListener('submit', (e) => e.preventDefault())
    document.querySelector('body > button')!.addEventListener('click', () => history.pushState({}, '', '/after-click'))
  })
  await website.getByText('刷新', { exact: true }).click()
  await website.getByRole('tab').click()
  await website.getByRole('combobox').focus()
  await website.getByRole('combobox').press('ArrowDown')
  await website.getByRole('combobox').press('Enter')
  await website.getByRole('checkbox').check()
  await website.getByRole('button', { name: '保存' }).click()
  await expect.poll(async () => (await events()).length).toBe(8)
  await website.getByRole('button', { name: '敏感按钮' }).click()
  await website.getByRole('button', { name: '编辑内容' }).click()
  await website.getByRole('textbox', { name: '邮箱' }).fill('changed-secret')
  await website.getByRole('button', { name: 'private@example.com' }).click()
  await expect.poll(async () => (await events()).length).toBe(9)
  const rows = await events()
  expect(rows.filter((r: { type: string }) => r.type === 'pageview')).toHaveLength(2)
  expect(rows.find((r: { label: string }) => r.label === '刷新')).toMatchObject({ path: '/', action: 'click', user_id: null, ip: '127.0.0.1' })
  expect(rows.filter((r: { action: string }) => r.action === 'change')).toHaveLength(2)
  expect(rows.filter((r: { action: string }) => r.action === 'submit')).toHaveLength(1)
  for (const value of ['secret-a', 'secret-b', 'secret-password', 'private@example.com', 'changed-secret', '敏感按钮', '编辑内容']) {
    expect(JSON.stringify(rows)).not.toContain(value)
  }
  await website.evaluate(() => {
    document.querySelector('button')!.click() // Synthetic clicks do not count.
    ;(window as unknown as { visora: { disabled: boolean } }).visora.disabled = true
  })
  await website.getByRole('tab').click()
  await website.waitForTimeout(250)
  expect(await events()).toHaveLength(9)
  await page.goto('/events')
  await expect(page.getByRole('row').filter({ hasText: '刷新' })).toContainText('127.0.0.1')
  await page.getByRole('row').filter({ hasText: '刷新' }).getByRole('button', { name: '详情' }).click()
  await page.getByRole('dialog').getByText('查看控件位置', { exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('button:nth-of-type')
  await page.getByRole('dialog').getByRole('tab', { name: '身份与会话', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('用于识别同一浏览器的重复访问')
  await expect(page.getByRole('dialog')).toContainText('上海时间')
  await website.close()
})
