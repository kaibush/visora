import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.mjs'
import { loadConfig } from '../src/config.mjs'

const timestamp = Date.parse('2026-10-12T12:00:00Z')

async function fixture(t) {
  const config = loadConfig({ database: ':memory:', databaseUrl: '', encryptionKey: 'a'.repeat(64), autoMigrate: true, serveFrontend: false }, {})
  const app = await buildApp({ config, logger: false, now: () => timestamp })
  t.after(() => app.close())
  const setup = await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { username: 'admin', password: 'visora-test-password-only' } })
  const cookie = `${setup.cookies[0].name}=${setup.cookies[0].value}`
  const admin = (url) => app.inject({ url, headers: { cookie } })
  const create = async (name) => {
    const response = await app.inject({ method: 'POST', url: '/api/projects', headers: { cookie }, payload: { name, origins: [] } })
    assert.equal(response.statusCode, 201, response.body)
    return response.json()
  }
  const send = async (key, events) => {
    const response = await app.inject({ method: 'POST', url: '/api/ingest', headers: { authorization: `Bearer ${key}` }, payload: { events: events.map((event, index) => ({ eventId: String(index), visitorId: 'visitor', sessionId: 'session', path: '/users-test', ...event })) } })
    assert.equal(response.statusCode, 202, response.body)
  }
  const get = async (query = '') => {
    const response = await admin(`/api/users?${query}`)
    assert.equal(response.statusCode, 200, response.body)
    return response.json()
  }
  return { admin, create, send, get }
}

test('user directory isolates projects, keeps latest identity, ranks PV and includes anonymous IPs', async (t) => {
  const { admin, create, send, get } = await fixture(t)
  const first = await create('项目一')
  const second = await create('项目二')
  await send(first.key, [
    { user: { id: '42', name: '旧名字', email: 'old@example.com' }, occurredAt: '2026-10-11T12:00:00Z', ip: '203.0.113.1' },
    { user: { id: '42', name: '新名字', email: 'new@example.com' }, occurredAt: '2026-10-12T10:00:00Z', ip: '203.0.113.1' },
    { user: { id: '42' }, ip: '2001:db8::1' },
    { user: { id: '42' }, type: 'event', name: 'click', ip: '203.0.113.1' },
    { ip: '203.0.113.1', visitorId: 'anonymous' },
    { ip: '203.0.113.1', visitorId: 'anonymous' },
    { user: { id: 'event-only', name: '仅事件用户' }, type: 'event', name: 'login' },
    {},
  ])
  await send(second.key, [{ user: { id: '42', name: '另一个用户' }, ip: '203.0.113.1' }])
  const result = await get()
  assert.equal(result.total, 3)
  assert.deepEqual(result.summary, { users: 3, ips: 2, identifiedPv: 3, anonymousPv: 3 })
  const user = result.users.find((row) => row.projectId === first.project.id && row.userId === '42')
  assert.equal(user.name, '新名字')
  assert.equal(user.email, 'new@example.com')
  assert.equal(user.pv, 2)
  assert.equal(user.events, 1)
  assert.equal(user.ips, 2)
  assert.equal(result.hotUsers[0].projectId, first.project.id)
  assert.equal(result.hotUsers[0].pv, 2)
  assert.equal(result.hotUsers.length, 2)
  assert.equal(result.hotIps[0].ip, '203.0.113.1')
  assert.equal(result.hotIps[0].pv, 4)
  assert.equal(result.hotIps[0].projects, 2)
  assert.equal(result.hotIps[0].visitors, 3)
  assert.equal(result.hotIps[0].userCount, 3)
  assert.deepEqual(result.hotIps[0].users.map((user) => user.name).sort(), ['仅事件用户', '另一个用户', '新名字'])
  const ipv6 = result.hotIps.find((row) => row.ip === '2001:db8::1')
  assert.equal(ipv6.userCount, 2)
  assert.deepEqual(ipv6.users.map((user) => user.name), ['新名字', '仅事件用户'])
  assert.equal((await get(`project=${second.project.id}`)).total, 1)
  assert.equal((await get('search=new%40example.com')).total, 1)
  assert.equal((await get('search=%25')).total, 0)
  assert.equal((await get('userId=event-only')).hotUsers.length, 0)
  const history = await get('from=2026-10-11&to=2026-10-11')
  assert.equal(history.total, 1)
  assert.equal(history.users[0].name, '旧名字')
  assert.equal(history.hotIps[0].users[0].name, '旧名字')
  assert.deepEqual((await get('ip=2001%3Adb8%3A%3A1')).hotIps[0].users.map((user) => user.name), ['新名字', '仅事件用户'])
  assert.equal((await get('ip=2001%3Adb8%3A%3A1')).users[0].pv, 1)
  const details = await admin('/api/events?ip=2001%3Adb8%3A%3A1')
  assert.equal(details.json().total, 1)
  const csv = await admin('/api/export?ip=2001%3Adb8%3A%3A1')
  assert.ok(csv.body.includes('2001:db8::1'))
  assert.ok(!csv.body.includes('203.0.113.1'))
  assert.equal((await admin('/api/users?ip=invalid')).statusCode, 400)
  assert.equal((await admin('/api/users?search=' + 'a'.repeat(121))).statusCode, 400)
  assert.equal((await admin('/api/users?project=missing')).statusCode, 404)
})

test('user search and pagination are stable and retain rankings for the full selected range', async (t) => {
  const { create, send, get } = await fixture(t)
  const project = await create('分页项目')
  await send(project.key, Array.from({ length: 25 }, (_, index) => ({ user: { id: `user-${String(index).padStart(2, '0')}`, name: index === 0 ? '百分号%_!' : `姓名${index}` } })))
  const first = await get()
  const second = await get('page=2')
  assert.equal(first.total, 25)
  assert.equal(first.users.length, 20)
  assert.equal(second.users.length, 5)
  assert.equal(new Set([...first.users, ...second.users].map((user) => user.userId)).size, 25)
  assert.equal((await get('page=3')).users.length, 0)
  const searched = await get('search=%25_!')
  assert.equal(searched.total, 1)
  assert.equal(searched.users[0].userId, 'user-00')
  assert.equal(searched.hotUsers.length, 8)
  assert.equal(searched.summary.users, 25)
  const empty = await get('from=2026-10-10&to=2026-10-10')
  assert.equal(empty.total, 0)
  assert.deepEqual(empty.summary, { users: 0, ips: 0, identifiedPv: 0, anonymousPv: 0 })
  assert.deepEqual(empty.hotIps, [])
})

test('hot IP names follow the visitor and keep the latest identities within a short list', async (t) => {
  const { create, send, get } = await fixture(t)
  const namedLater = await create('稍后识别')
  await send(namedLater.key, [
    { ip: '198.51.100.10', visitorId: 'same', path: '/anon' },
    { visitorId: 'same', type: 'event', name: 'login', user: { id: '7', name: '周七' }, path: '/login' },
  ])
  const linked = await get(`project=${namedLater.project.id}`)
  assert.equal(linked.hotIps[0].visitors, 1)
  assert.equal(linked.hotIps[0].userCount, 1)
  assert.deepEqual(linked.hotIps[0].users[0], {
    projectId: namedLater.project.id,
    projectName: '稍后识别',
    userId: '7',
    name: '周七',
  })
  const crowded = await create('多人共用')
  await send(crowded.key, Array.from({ length: 4 }, (_, index) => ({
    ip: '198.51.100.20',
    visitorId: `visitor-${index}`,
    user: { id: `user-${index}`, name: `用户${index}` },
    occurredAt: new Date(timestamp - (4 - index) * 60000).toISOString().replace('.000Z', 'Z'),
  })))
  const ranked = (await get(`project=${crowded.project.id}`)).hotIps[0]
  assert.equal(ranked.userCount, 4)
  assert.deepEqual(ranked.users.map((user) => user.name), ['用户3', '用户2', '用户1'])
})
