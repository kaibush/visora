import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp } from '../src/app.mjs'
import { loadConfig } from '../src/config.mjs'
import { latestVersion } from '../src/infrastructure/database/migrate.mjs'
import { DatabaseSync } from 'node:sqlite'
import { sendEvents } from '../../sdk/node.mjs'
import { createServer } from 'node:http'

const password = 'visora-test-password-only'
const timestamp = Date.parse('2026-10-12T12:00:00Z')
const event = (eventId, extra = {}) => ({
  eventId,
  visitorId: 'visitor-1',
  sessionId: 'session-1',
  path: '/dashboard?token=secret#fragment',
  ...extra,
})

async function buildTestApp(options = {}) {
  // Never read database URLs or other service settings from the host environment.
  const config = loadConfig(
    {
      password,
      database: ':memory:',
      encryptionKey: 'a'.repeat(64),
      databaseUrl: '',
      autoMigrate: true,
      serveFrontend: false,
      ...options,
    },
    {}
  )
  return buildApp({ config, logger: false, now: () => timestamp, ...options })
}

async function fixture(t, options = {}) {
  const app = await buildTestApp(options)
  t.after(() => app.close())
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password } })
  assert.equal(login.statusCode, 200)
  const cookie = login.cookies[0].name + '=' + login.cookies[0].value
  const admin = (method, url, payload) => app.inject({ method, url, payload, headers: { cookie } })
  const create = async (name = 'new-api') => {
    const response = await admin('POST', '/api/projects', {
      name,
      origins: ['https://app.example.com'],
    })
    assert.equal(response.statusCode, 201, response.body)
    return response.json()
  }
  const send = (key, events) =>
    app.inject({
      method: 'POST',
      url: '/api/ingest',
      headers: { authorization: `Bearer ${key}` },
      payload: { events },
    })
  return { app, cookie, admin, create, send }
}

test('admin routes require session; login/logout, expiry and same-origin checks are enforced', async (t) => {
  let clock = timestamp
  const { app, admin, cookie } = await fixture(t, { now: () => clock, secureCookie: true })
  for (const url of [
    '/api/projects',
    '/api/analytics',
    '/api/events',
    '/api/export',
    '/api/auth/session',
  ]) {
    assert.equal((await app.inject(url)).statusCode, 401)
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'unauthorized', origins: [] },
      })
    ).statusCode,
    401
  )
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'wrong' } }))
      .statusCode,
    401
  )
  const malicious = await app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie, origin: 'https://attacker.example' },
    payload: { name: 'bad', origins: [] },
  })
  assert.equal(malicious.statusCode, 403)
  assert.equal((await admin('GET', '/api/auth/session')).statusCode, 200)
  clock += 8 * 86400000
  assert.equal((await admin('GET', '/api/auth/session')).statusCode, 401)
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password } })
  assert.match(login.headers['set-cookie'], /HttpOnly/)
  assert.match(login.headers['set-cookie'], /SameSite=Strict/i)
  assert.match(login.headers['set-cookie'], /Secure/)
  const nextCookie = `visora_session=${login.cookies[0].value}`
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: nextCookie } }))
      .statusCode,
    200
  )
  assert.equal(
    (await app.inject({ url: '/api/auth/session', headers: { cookie: nextCookie } })).statusCode,
    401
  )
})

test('collector allows exact origins only and strips private URL data; keys are never returned in lists', async (t) => {
  const { app, admin, create } = await fixture(t)
  const { project, key } = await create()
  for (const origin of [
    undefined,
    'https://app.example.com.evil.test',
    'http://app.example.com',
    'https://app.example.com:9999',
    'null',
  ]) {
    const r = await app.inject({
      method: 'POST',
      url: `/api/collect/${project.siteId}`,
      headers: origin ? { origin } : {},
      payload: event('blocked'),
    })
    assert.equal(r.statusCode, 403)
    assert.equal(r.headers['access-control-allow-origin'], undefined)
  }
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: `/api/collect/${project.siteId}`,
    headers: { origin: 'https://app.example.com' },
  })
  assert.equal(preflight.statusCode, 204)
  const response = await app.inject({
    method: 'POST',
    url: `/api/collect/${project.siteId}`,
    headers: {
      origin: 'https://app.example.com',
      'content-type': 'text/plain',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/125.0 Safari/537.36',
    },
    payload: JSON.stringify(
      event('browser', {
        referrer: 'https://search.example/private?q=secret#secret',
        occurredAt: '2000-01-01T00:00:00Z',
        userAgent: 'spoof',
      })
    ),
  })
  assert.equal(response.statusCode, 202, response.body)
  assert.equal(response.headers['access-control-allow-origin'], 'https://app.example.com')
  const stored = await app.db.models.Event.findOne({ raw: true })
  assert.equal(stored.path, '/dashboard')
  assert.equal(stored.referrer, 'search.example')
  assert.equal(Number(stored.occurredAt), timestamp)
  assert.equal(stored.browser, 'Chrome')
  assert.notEqual(stored.visitor, 'visitor-1')
  const listed = await admin('GET', '/api/projects')
  assert.ok(!listed.body.includes(key))
  assert.ok(!listed.body.includes('key_hash'))
  assert.ok(!listed.body.includes('keyCiphertext'))
  assert.ok(!listed.body.includes('key_ciphertext'))
  assert.equal(listed.json().projects[0].totalEvents, 1)
  const rows = (await admin('GET', '/api/events')).json().events
  assert.equal(rows[0].visitor, stored.visitor)
  assert.equal(rows[0].session, stored.session)
})

test('aggregate reports isolate project identities, deduplicate retry IDs, zero-fill dates and separate custom events', async (t) => {
  const { admin, create, send } = await fixture(t)
  const a = await create('new-api')
  const b = await create('grok-iq')
  assert.deepEqual(
    (
      await send(a.key, [
        event('1'),
        event('2'),
        event('3', { visitorId: 'visitor-2', type: 'event', name: 'signup' }),
      ])
    ).json(),
    { accepted: 3, duplicates: 0 }
  )
  assert.deepEqual((await send(a.key, [event('1')])).json(), { accepted: 0, duplicates: 1 })
  await send(b.key, [event('1')])
  await send(a.key, [event('history', { occurredAt: '2026-10-09T23:59:59Z' })])
  const report = (await admin('GET', '/api/analytics?from=2026-10-10&to=2026-10-12')).json()
  assert.deepEqual(report.totals, { pv: 3, uv: 2, sessions: 2, events: 1 })
  assert.equal(report.previous.pv, 1)
  assert.equal(report.active, 3)
  assert.equal(report.trend.length, 3)
  assert.deepEqual(report.trend[0], { date: '2026-10-10', pv: 0, uv: 0 })
  assert.equal(report.dimensions.path[0].name, '/dashboard')
  const filtered = (
    await admin('GET', `/api/analytics?project=${a.project.id}&from=2026-10-10&to=2026-10-12`)
  ).json()
  assert.deepEqual(filtered.totals, { pv: 2, uv: 1, sessions: 1, events: 1 })
  assert.equal(filtered.projects.length, 1)
  assert.equal((await admin('GET', '/api/analytics?project=missing')).statusCode, 404)
  assert.equal((await admin('GET', '/api/analytics?from=2026-02-30')).statusCode, 400)
  assert.equal((await admin('GET', '/api/analytics?from=2020-01-01&to=2026-10-12')).statusCode, 400)
})

test('batch import is atomic, bounded and validates dates, IDs, event names and paths', async (t) => {
  const { app, create, send } = await fixture(t)
  const { key } = await create()
  for (const events of [
    [event('valid'), event('bad', { type: 'event' })],
    [event('valid'), event('bad', { occurredAt: '2026-01-01T00:00:00Z' })],
    [event('valid'), event('bad', { occurredAt: '2026-10-12T13:00:00Z' })],
    [event('bad', { path: 'https://example.com' })],
    [event('bad', { path: '//example.com' })],
    [event('bad', { visitorId: '' })],
    Array.from({ length: 101 }, (_, i) => event(`batch-${i}`)),
  ]) {
    assert.equal((await send(key, events)).statusCode, 400)
    assert.equal(await app.db.models.Event.count(), 0)
  }
  assert.equal((await send('vs_wrong', [event('wrong')])).statusCode, 401)
  assert.equal((await send(key, [event('ok')])).statusCode, 202)
})

test('project pause and key rotation revoke ingestion while preserving historical reports', async (t) => {
  const { app, admin, create, send } = await fixture(t)
  const a = await create()
  await send(a.key, [event('before')])
  const rotated = (await admin('POST', `/api/projects/${a.project.id}/rotate-key`)).json()
  assert.equal((await send(a.key, [event('old')])).statusCode, 401)
  assert.equal((await send(rotated.key, [event('new')])).statusCode, 202)
  await admin('PATCH', `/api/projects/${a.project.id}`, { enabled: false })
  assert.equal((await send(rotated.key, [event('paused')])).statusCode, 401)
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/collect/${a.project.siteId}`,
        headers: { origin: 'https://app.example.com' },
        payload: event('browser-paused'),
      })
    ).statusCode,
    403
  )
  assert.equal((await admin('GET', '/api/analytics')).json().totals.pv, 2)
  await admin('PATCH', `/api/projects/${a.project.id}`, {
    enabled: true,
    origins: ['https://next.example.com/'],
  })
  assert.equal((await send(rotated.key, [event('resumed')])).statusCode, 202)
  assert.equal(
    (
      await admin('POST', '/api/projects', {
        name: 'invalid',
        origins: ['https://example.com/path'],
      })
    ).statusCode,
    400
  )
})

test('paginated events and CSV respect filters and escape spreadsheet formulas', async (t) => {
  const { admin, create, send } = await fixture(t)
  const a = await create('=HYPERLINK("bad")')
  const b = await create('grok-iq')
  await send(
    a.key,
    Array.from({ length: 22 }, (_, i) => event(`a-${i}`))
  )
  await send(b.key, [event('b')])
  const response = (await admin('GET', `/api/events?project=${a.project.id}&page=2`)).json()
  assert.equal(response.total, 22)
  assert.equal(response.events.length, 2)
  assert.ok(response.events.every((e) => e.project_id === a.project.id))
  const csv = await admin('GET', `/api/export?project=${a.project.id}`)
  assert.match(csv.headers['content-type'], /text\/csv/)
  assert.match(csv.body, /'=HYPERLINK/)
  assert.ok(!csv.body.includes('grok-iq'))
  assert.ok(!csv.body.includes('token=secret'))
})

test('SQLite survives restarts, schema initialization is idempotent, password changes invalidate old sessions', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'visora-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const database = join(directory, 'visora.sqlite')
  const first = await buildTestApp({ database })
  const login = await first.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password },
  })
  const cookie = `visora_session=${login.cookies[0].value}`
  const project = (
    await first.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: { name: 'persistent', origins: [] },
    })
  ).json()
  await first.inject({
    method: 'POST',
    url: '/api/ingest',
    headers: { authorization: `Bearer ${project.key}` },
    payload: { events: [event('saved')] },
  })
  await first.close()
  const second = await buildTestApp({ password: password + '-changed', database })
  try {
    assert.equal(await second.db.models.Event.count(), 1)
    assert.equal(
      (await second.inject({ url: '/api/projects', headers: { cookie } })).statusCode,
      401
    )
    assert.equal(await second.db.models.Migration.max('version'), latestVersion)
    const login = await second.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: password + '-changed' },
    })
    const nextCookie = `visora_session=${login.cookies[0].value}`
    const revealed = await second.inject({
      url: `/api/projects/${project.project.id}/key`,
      headers: { cookie: nextCookie },
    })
    assert.equal(revealed.statusCode, 200)
    assert.equal(revealed.json().key, project.key)
  } finally {
    await second.close()
  }
  const upgraded = await buildTestApp({ database })
  try {
    assert.equal(await upgraded.db.models.Event.count(), 1)
    assert.equal(await upgraded.db.models.Migration.count(), latestVersion)
    assert.equal(
      (await upgraded.inject({ url: '/api/projects', headers: { cookie } })).statusCode,
      401
    )
  } finally {
    await upgraded.close()
  }
  const expired = await buildTestApp({ database, now: () => timestamp + 91 * 86400000 })
  try {
    assert.equal(await expired.db.models.Event.count(), 0)
    assert.equal(await expired.db.models.Project.count(), 1)
  } finally {
    await expired.close()
  }
})

test('login is rate limited and a weak or absent initial password is rejected', async (t) => {
  await assert.rejects(() => buildTestApp({ password: 'short' }), /12/)
  const { app } = await fixture(t)
  let response
  for (let i = 0; i < 6; i++)
    response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'incorrect' },
    })
  assert.equal(response.statusCode, 429)
})

test('tracker asset is JavaScript and Node SDK retries retain IDs after a transient failure', async (t) => {
  const { app } = await fixture(t)
  const tracker = await app.inject('/tracker.js')
  assert.equal(tracker.statusCode, 200)
  assert.match(tracker.headers['content-type'], /javascript/)
  assert.match(tracker.body, /window.visora/)
  const bodies = []
  const receiver = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()))
    response.setHeader('Content-Type', 'application/json')
    if (bodies.length === 1) {
      response.writeHead(503)
      response.end('{"error":"retry"}')
    } else response.end(JSON.stringify({ accepted: bodies.at(-1).events.length, duplicates: 0 }))
  })
  await new Promise((resolve) => receiver.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => receiver.close(resolve)))
  const result = await sendEvents({
    url: `http://127.0.0.1:${receiver.address().port}`,
    key: 'vs_test',
    events: Array.from({ length: 101 }, () => ({ visitorId: 'v', sessionId: 's', path: '/' })),
  })
  assert.deepEqual(result, { accepted: 101, duplicates: 0 })
  assert.equal(bodies.length, 3)
  assert.deepEqual(bodies[0], bodies[1])
  assert.equal(new Set(bodies[0].events.map((e) => e.eventId)).size, 100)
})

test('legacy SQLite events migrate with UTC day buckets and stable identity salt', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'visora-legacy-test-'))
  let app
  t.after(async () => {
    try {
      await app?.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  const database = join(directory, 'legacy.sqlite')
  // Immutable pre-ORM schema fixture; the production implementation never uses node:sqlite.
  const legacy = new DatabaseSync(database)
  try {
    legacy.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, site_id TEXT NOT NULL UNIQUE,
        origins TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
        key_hash TEXT NOT NULL UNIQUE, key_prefix TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL REFERENCES projects(id),
        event_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL,
        occurred_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
        visitor TEXT NOT NULL, session TEXT NOT NULL, path TEXT NOT NULL, referrer TEXT NOT NULL,
        browser TEXT NOT NULL, os TEXT NOT NULL, device TEXT NOT NULL, language TEXT NOT NULL, source TEXT NOT NULL,
        UNIQUE(project_id, event_id)
      );
      INSERT INTO settings VALUES ('identity_salt', 'legacy-identity-salt');
      INSERT INTO projects VALUES ('legacy', 'Legacy', 'v_legacy', '[]', 1, 'old-hash', 'vs_old', 1);
    `)
    legacy
      .prepare(
        `INSERT INTO events (project_id, event_id, type, name, occurred_at, received_at, visitor, session, path, referrer, browser, os, device, language, source)
      VALUES ('legacy', 'old-visit', 'pageview', 'pageview', ?, ?, 'old-visitor', 'old-session', '/', '', 'Other', 'Other', 'desktop', 'zh-CN', 'server')`
      )
      .run(timestamp, timestamp)
  } finally {
    legacy.close()
  }
  app = await buildTestApp({ database })
  assert.equal(app.db.identitySalt, 'legacy-identity-salt')
  assert.equal(await app.db.models.Migration.max('version'), latestVersion)
  const stored = await app.db.models.Event.findOne({ raw: true })
  assert.equal(stored.day, '2026-10-12')
  assert.equal(stored.visitor, 'old-visitor')
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password } })
  const cookie = `visora_session=${login.cookies[0].value}`
  const report = await app.inject({
    url: '/api/analytics?from=2026-10-12&to=2026-10-12',
    headers: { cookie },
  })
  assert.equal(report.statusCode, 200, report.body)
  assert.deepEqual(report.json().trend, [{ date: '2026-10-12', pv: 1, uv: 1 }])
})

test('concurrent ingestion retries have exact counts and event IDs remain case-sensitive', async (t) => {
  const { app, create, send } = await fixture(t)
  const { key } = await create()
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => send(key, [event('Retry'), event('Retry'), event('retry')]))
  )
  for (const response of responses) assert.equal(response.statusCode, 202, response.body)
  assert.equal(
    responses.reduce((total, response) => total + response.json().accepted, 0),
    2
  )
  assert.equal(
    responses.reduce((total, response) => total + response.json().duplicates, 0),
    10
  )
  assert.equal(await app.db.models.Event.count(), 2)
})

test('project keys can be revealed repeatedly only by an administrator and rotated atomically', async (t) => {
  const { app, admin, create, send } = await fixture(t)
  const { project, key } = await create()
  const url = `/api/projects/${project.id}/key`
  assert.equal((await app.inject(url)).statusCode, 401)
  assert.equal(
    (await app.inject({ url, headers: { authorization: `Bearer ${key}` } })).statusCode,
    401
  )
  for (let i = 0; i < 2; i++) {
    const revealed = await admin('GET', url)
    assert.equal(revealed.statusCode, 200, revealed.body)
    assert.equal(revealed.headers['cache-control'], 'no-store')
    assert.equal(revealed.json().key, key)
  }
  const stored = await app.db.models.Project.findByPk(project.id, { raw: true })
  assert.ok(stored.keyCiphertext.startsWith('v1.'))
  assert.ok(!JSON.stringify(stored).includes(key))
  const rotated = await admin('POST', `/api/projects/${project.id}/rotate-key`)
  assert.equal(rotated.statusCode, 200, rotated.body)
  assert.notEqual(rotated.json().key, key)
  assert.equal((await admin('GET', url)).json().key, rotated.json().key)
  assert.equal((await send(key, [event('old-key')])).statusCode, 401)
  assert.equal((await send(rotated.json().key, [event('new-key')])).statusCode, 202)
  assert.equal((await admin('GET', '/api/projects/missing/key')).statusCode, 404)
})

test('legacy keys stay valid without ciphertext; explicit rotation enables retrieval', async (t) => {
  const { app, admin, create, send } = await fixture(t)
  const { project, key } = await create()
  await app.db.models.Project.update({ keyCiphertext: null }, { where: { id: project.id } })
  const response = await admin('GET', `/api/projects/${project.id}/key`)
  assert.equal(response.statusCode, 200, response.body)
  assert.deepEqual(response.json(), { key: null })
  assert.equal((await send(key, [event('legacy-still-valid')])).statusCode, 202)
  const rotated = (await admin('POST', `/api/projects/${project.id}/rotate-key`)).json()
  assert.equal((await admin('GET', `/api/projects/${project.id}/key`)).json().key, rotated.key)
})

test('encrypted keys cannot be substituted between projects', async (t) => {
  const { app, admin, create } = await fixture(t)
  const a = await create('A')
  const b = await create('B')
  const stored = await app.db.models.Project.findByPk(a.project.id, { raw: true })
  await app.db.models.Project.update(
    { keyCiphertext: stored.keyCiphertext },
    { where: { id: b.project.id } }
  )
  const response = await admin('GET', `/api/projects/${b.project.id}/key`)
  assert.equal(response.statusCode, 409)
  assert.ok(!response.body.includes(a.key))
  assert.ok(!response.body.includes(stored.keyCiphertext))
})

test('business user snapshots support filtering and CSV without changing visitor identity', async (t) => {
  const { app, admin, create, send } = await fixture(t)
  const a = await create('user project A')
  const b = await create('user project B')
  const response = await send(a.key, [
    event('anonymous'),
    event('alice', {
      user: { id: 42, name: '张三', email: 'alice@example.com', password: 'discard-me' },
    }),
    event('signup', { type: 'event', name: 'signup', user: { id: '42', name: '张三' } }),
    event('bob', { user: { id: 'bob', name: '=HYPERLINK("example")' } }),
  ])
  assert.equal(response.statusCode, 202, response.body)
  await send(b.key, [event('other-system', { user: { id: '42', name: '另一个系统用户' } })])
  const all = (await admin('GET', `/api/events?project=${a.project.id}`)).json()
  assert.equal(all.total, 4)
  const alice = all.events.find((row) => row.event_id === 'alice')
  assert.equal(alice.user_id, '42')
  assert.equal(alice.user_name, '张三')
  assert.equal(alice.user_email, 'alice@example.com')
  const anonymous = all.events.find((row) => row.event_id === 'anonymous')
  assert.equal(anonymous.user_id, null)
  assert.equal(anonymous.user_name, null)
  assert.equal(anonymous.user_email, null)
  const filter = `project=${a.project.id}&userId=42`
  const rows = (await admin('GET', `/api/events?${filter}`)).json()
  assert.equal(rows.total, 2)
  assert.ok(rows.events.every((row) => row.project_id === a.project.id && row.user_id === '42'))
  const report = (await admin('GET', `/api/analytics?${filter}`)).json()
  assert.deepEqual(report.totals, { pv: 1, uv: 1, sessions: 1, events: 1 })
  assert.equal(
    report.trend.reduce((sum, row) => sum + row.pv, 0),
    1
  )
  assert.equal(report.projects[0].events, 2)
  assert.equal((await admin('GET', `/api/analytics?project=${a.project.id}`)).json().totals.uv, 1)
  const csv = await admin('GET', `/api/export?${filter}`)
  assert.ok(csv.body.includes('user_id,user_name,user_email'))
  assert.ok(csv.body.includes('alice@example.com'))
  assert.ok(!csv.body.includes('另一个系统用户'))
  assert.ok(!csv.body.includes('HYPERLINK'))
  const bobCsv = await admin('GET', `/api/export?project=${a.project.id}&userId=bob`)
  assert.ok(bobCsv.body.includes("'=HYPERLINK"))
  assert.equal((await admin('GET', '/api/events?userId=unknown-user')).json().total, 0)
  const stored = await app.db.models.Event.findAll({ raw: true })
  assert.ok(!JSON.stringify(stored).includes('discard-me'))
  // A retried anonymous event must not be rewritten with a later login's identity.
  await send(a.key, [event('anonymous', { user: { id: '42' } })])
  const original = await app.db.models.Event.findOne({
    where: { projectId: a.project.id, eventId: 'anonymous' },
    raw: true,
  })
  assert.equal(original.userId, null)
})

test('invalid business identity rejects the complete batch and user ID zero is supported', async (t) => {
  const { app, create, send } = await fixture(t)
  const { key } = await create()
  for (const user of [
    {},
    { id: '' },
    { id: '   ' },
    { id: 'a'.repeat(129) },
    { id: 'a\u0000b' },
    { id: {} },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { id: 'a', name: 'b'.repeat(121) },
    { id: 'a', email: 'not-an-email' },
  ]) {
    const response = await send(key, [event('valid'), event('invalid', { user })])
    assert.equal(response.statusCode, 400, response.body)
    assert.equal(await app.db.models.Event.count(), 0)
  }
  const response = await send(key, [
    event('zero', { user: { id: 0, name: '   ', email: '   ' } }),
    event('no-user', { user: null }),
  ])
  assert.equal(response.statusCode, 202, response.body)
  const zero = await app.db.models.Event.findOne({ where: { eventId: 'zero' }, raw: true })
  assert.equal(zero.userId, '0')
  assert.equal(zero.userName, null)
  assert.equal(zero.userEmail, null)
})

test('browser identity is an optional client declaration, distinguished from server ingestion', async (t) => {
  const { app, admin, create } = await fixture(t)
  const { project } = await create()
  const response = await app.inject({
    method: 'POST',
    url: `/api/collect/${project.siteId}`,
    headers: { origin: 'https://app.example.com' },
    payload: event('browser-user', {
      user: { id: 'browser-user', name: 'Browser User', email: 'browser@example.com' },
      source: 'server',
    }),
  })
  assert.equal(response.statusCode, 202, response.body)
  const rows = (await admin('GET', `/api/events?project=${project.id}&userId=browser-user`)).json()
  assert.equal(rows.total, 1)
  assert.equal(rows.events[0].source, 'browser')
  assert.equal(rows.events[0].user_name, 'Browser User')
})

test('anonymous browser IP comes from transport, interaction context survives reporting and CSV', async (t) => {
  const { app, admin, create, send } = await fixture(t)
  const { project, key } = await create()
  const response = await app.inject({
    method: 'POST', url: `/api/collect/${project.siteId}`, remoteAddress: '192.0.2.8',
    headers: { origin: 'https://app.example.com', 'x-forwarded-for': '198.51.100.9' },
    payload: event('auto-click', { type: 'event', name: 'click:刷新', ip: '203.0.113.1',
      interaction: { action: 'click', target: 'button:nth-of-type(1)', label: '刷新', value: 'secret' } }),
  })
  assert.equal(response.statusCode, 202, response.body)
  const rows = (await admin('GET', `/api/events?project=${project.id}`)).json().events
  assert.equal(rows[0].ip, '192.0.2.8')
  assert.equal(rows[0].user_id, null)
  assert.equal(rows[0].action, 'click')
  assert.equal(rows[0].label, '刷新')
  assert.ok(rows[0].visitor && rows[0].session)
  assert.ok(!JSON.stringify(rows).includes('secret'))
  const csv = await admin('GET', `/api/export?project=${project.id}`)
  assert.ok(csv.body.includes('192.0.2.8'))
  assert.ok(csv.body.includes('button:nth-of-type(1)'))
  assert.equal((await send(key, [event('forwarded', { ip: '2001:db8::1' }), event('no-ip')])).statusCode, 202)
  assert.equal((await app.db.models.Event.findOne({ where: { eventId: 'forwarded' } })).ip, '2001:db8::1')
  assert.equal((await app.db.models.Event.findOne({ where: { eventId: 'no-ip' } })).ip, null)
  assert.equal((await send(key, [event('bad-ip', { ip: 'not-an-ip' })])).statusCode, 400)
})

test('explicit trusted proxy configuration resolves forwarded browser IP', async (t) => {
  const { app, create } = await fixture(t, { trustProxy: true })
  const { project } = await create()
  await app.inject({ method: 'POST', url: `/api/collect/${project.siteId}`, remoteAddress: '127.0.0.1',
    headers: { origin: 'https://app.example.com', 'x-forwarded-for': '198.51.100.9' },
    payload: event('proxied'),
  })
  assert.equal((await app.db.models.Event.findOne()).ip, '198.51.100.9')
})

test('Shanghai filters, daily buckets and CSV agree across the UTC date boundary', async (t) => {
  const { admin, create, send } = await fixture(t)
  const { project, key } = await create()
  await send(key, [
    event('before-shanghai-midnight', { occurredAt: '2026-10-10T15:59:59Z' }),
    event('at-shanghai-midnight', { occurredAt: '2026-10-10T16:00:00Z' }),
    event('end-shanghai-day', { occurredAt: '2026-10-11T15:59:59Z' }),
    event('next-shanghai-day', { occurredAt: '2026-10-11T16:00:00Z' }),
  ])
  const query = `project=${project.id}&from=2026-10-11&to=2026-10-11&timezone=Asia%2FShanghai`
  const report = (await admin('GET', `/api/analytics?${query}`)).json()
  assert.equal(report.range.timezone, 'Asia/Shanghai')
  assert.equal(report.totals.pv, 2)
  assert.deepEqual(report.trend, [{ date: '2026-10-11', pv: 2, uv: 1 }])
  const rows = (await admin('GET', `/api/events?${query}`)).json()
  assert.equal(rows.total, 2)
  const csv = (await admin('GET', `/api/export?${query}`)).body
  assert.ok(csv.includes('2026-10-11T00:00:00.000+08:00'))
  assert.ok(csv.includes('2026-10-11T23:59:59.000+08:00'))
  assert.ok(!csv.includes('next-shanghai-day'))
})
