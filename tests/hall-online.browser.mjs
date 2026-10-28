// 诡镇在大厅联机界面上的浏览器回归：直连私有手牌、第二席位准备、换牌确认、预留 AI 席位与联机存档。
// 大厅自身的联机界面由 tests/hall/browser/online.browser.mjs 用井字棋和测试专用 Mod 覆盖。
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRelay } from '../../../relay/server.js'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

let relay, relayUrl, halls = [], home, previousHome
const listen = server => new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(r => { server.stopRelay?.(); server.online?.close(); server.closeAllConnections(); server.close(r) })
async function api(index, route, body) {
  return (await fetch(halls[index].url + '/api/online/' + route, { method: body ? 'POST' : 'GET', headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json()
}
const command = (index, action, body = {}) => api(index, 'command', { action, body: { operationId: randomUUID(), ...body } })
// 大厅的联机栏是默认收起的悬浮胶囊；需要复制邀请等操作按钮时先点开。
async function expandOnlineBanner(page) {
  const toggle = page.locator('.bg-online-banner .bg-online-toggle')
  await toggle.waitFor()
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await expect(page.locator('.bg-online-banner .bg-online-actions')).toBeVisible()
}
test.beforeAll(async () => {
  previousHome = process.env.DSH_HOME
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'hall-online-browser-')); process.env.DSH_HOME = home
  const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
  relay = createRelay(); relayUrl = await listen(relay)
  for (let i = 0; i < 2; i++) {
    const server = createServer({ mods, persist: i === 0 }); await server.ready
    halls.push({ server, url: await listen(server) })
  }
})
test.afterAll(async () => {
  await Promise.all(halls.map(h => stop(h.server))); await stop(relay)
  if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome
  fs.rmSync(home, { recursive: true, force: true })
})
test.afterEach(async () => { for (let i = 0; i < 2; i++) await api(i, 'leave', {}) })

test('direct Arkham snapshots keep each investigator hand private', async ({ browser }) => {
  const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
    settings: { legacyAutoStart: true, seed: 'direct-private-hand' } })
  expect(created.ok, created.error).toBe(true)
  await api(1, 'join', { relayUrl, code: created.room.code }); await api(1, 'ready', { ready: true })
  const host = await browser.newPage(), guest = await browser.newPage(), errors = []
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
  await host.goto(halls[0].url); await guest.goto(halls[1].url)
  await expect(guest.locator('.bg-online-banner')).toContainText('直连', { timeout: 30000 })
  const before = { ...halls[0].server.online.metrics }
  const started = await command(0, 'start')
  expect(started.ok, started.error).toBe(true)
  await expect.poll(async () => (await api(1, 'status')).session?.state.revision).toBe(started.session.state.revision)
  const guestSession = (await api(1, 'status')).session
  expect(guestSession.state.investigators[0].hand).toEqual([])
  expect(guestSession.state.investigators[1].hand.length).toBeGreaterThan(0)
  expect(halls[0].server.online.metrics.directBytes).toBeGreaterThan(before.directBytes)
  expect(halls[0].server.online.metrics.sentBytes).toBe(before.sentBytes)
  expect(errors).toEqual([])
  await host.close(); await guest.close()
})

test('Arkham second player can prepare own investigator and see own deck', async ({ browser }) => {
  const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false })
  await api(1, 'join', { relayUrl, code: created.room.code }); await api(1, 'ready', { ready: true })
  expect((await command(0, 'start')).ok).toBe(true)
  async function act(index, action) {
    const value = await api(index, 'status'), session = value.session
    const move = session.state.legalMoves.find(m => m.action === action)
    expect(move, `${action} on seat ${index}`).toBeTruthy()
    const result = await command(index, 'move', { revision: session.state.revision, move })
    expect(result.ok, result.error).toBe(true)
  }
  await act(0, 'hubGoSetup'); await act(0, 'hubSelectInvestigator'); await act(0, 'hubAutoDeck'); await act(0, 'hubDoneSeat')
  const guest = await browser.newPage(), errors = []
  let hostOnline = true, statusSerial = 100000
  await guest.route('**/api/online/status*', async route => {
    await new Promise(resolve => setTimeout(resolve, 50))
    const response = await route.fetch(), value = await response.json()
    value.serial = statusSerial++
    if (!hostOnline && value.room) value.room.members.find(member => member.host).online = false
    await route.fulfill({ response, json: value })
  })
  guest.on('pageerror', error => errors.push(error.message))
  await guest.goto(halls[1].url)
  await expect(guest.getByRole('navigation', { name: '战役局外页面' })).toBeVisible()
  await guest.getByRole('button', { name: '调查员与席位', exact: true }).click()
  const options = guest.getByRole('button', { name: /^选择调查员：/ })
  await expect(options.first()).toBeVisible()
  hostOnline = false
  await expect(options.first()).toBeDisabled()
  hostOnline = true
  await expect(options.first()).toBeEnabled()
  await options.first().click()
  await guest.getByRole('button', { name: '自动构筑合法牌组', exact: true }).click()
  await guest.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await expect(guest.locator('.ah-deck-inspect').first()).toBeVisible()
  const session = (await api(1, 'status')).session
  await expect(guest.locator('.ah-office-deck-heading h3')).toHaveText(session.state.investigators[1].name)
  await guest.screenshot({ path: 'artifacts/online-arkham-seat2.png', fullPage: true })
  await act(1, 'hubDoneSeat'); await act(0, 'hubSetLeader'); await act(0, 'hubBeginScenario')
  await expect(guest.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
  const playing = (await api(1, 'status')).session
  expect(playing.state.investigators[1].hand.length).toBeGreaterThan(0)
  expect(playing.state.investigators[0].hand).toEqual([])
  expect(errors).toEqual([])
  await guest.unrouteAll({ behavior: 'ignoreErrors' })
  await guest.close()
})

test('Arkham guest answers own mulligan in UI; refresh preserves private hand and current choice', async ({ browser }) => {
  const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
    settings: { seed: 'online-browser-choice', legacyAutoStart: true } })
  await api(1, 'join', { relayUrl, code: created.room.code }); await api(1, 'ready', { ready: true })
  expect((await command(0, 'start')).ok).toBe(true)
  const initial = (await api(0, 'status')).session
  expect(initial.state.pendingChoice.kind).toBe('mulligan')
  const keep = initial.state.legalMoves.find(m => m.optionId === 'done')
  expect((await command(0, 'move', { revision: initial.state.revision, move: keep })).ok).toBe(true)
  await expect.poll(async () => (await api(1, 'status')).session?.state.pendingChoice?.seat).toBe(1)
  const guest = await browser.newPage(), errors = []
  let commands = 0
  // prefs（P1 自动跳过偏好同步）是后台轻量命令，不计入「玩家操作发了几条命令」的断言。
  guest.on('request', request => {
    if (request.method() !== 'POST' || !request.url().includes('/api/online/command')) return
    let body = null
    try { body = request.postDataJSON() } catch { /* 非 JSON 请求 */ }
    if (body?.action !== 'prefs') commands++
  })
  guest.on('pageerror', e => errors.push(e.message))
  await guest.addInitScript(() => localStorage.setItem('arkham-presentation', JSON.stringify({ sound: false, fast: true })))
  await guest.goto(halls[1].url)
  await guest.getByRole('button', { name: '跳过演出', exact: true }).click()
  const choice = guest.getByRole('region', { name: '待决选择' })
  await expect(choice).toHaveAttribute('data-choice-seat', '1')
  await expect(guest.locator('[data-option-id="done"]:visible')).toBeEnabled()
  const before = (await api(1, 'status')).session
  await guest.reload()
  await guest.getByRole('button', { name: '跳过演出', exact: true }).click()
  await expect(choice).toHaveAttribute('data-choice-seat', '1')
  const after = (await api(1, 'status')).session
  expect(after.state.pendingChoice.id).toBe(before.state.pendingChoice.id)
  expect(after.state.investigators[1].hand).toEqual(before.state.investigators[1].hand)
  expect(after.state.investigators[0].hand).toEqual([])
  const selectable = after.state.legalMoves.filter(move => move.action === 'choose' && /^\d+$/.test(move.optionId))
  expect(selectable.length).toBeGreaterThanOrEqual(2)
  const cards = guest.locator('.ah-hand[data-hand-seat="1"] .ah-hand-card')
  const beforeCommands = commands
  await cards.nth(Number(selectable[0].optionId)).click()
  await cards.nth(Number(selectable[1].optionId)).click()
  await expect(choice.locator('.ah-choice-staged')).toContainText('本机已选 2 张')
  expect(commands).toBe(beforeCommands, 'card selection sends no online command')
  expect((await api(1, 'status')).session.state.revision).toBe(before.state.revision)
  await expect(cards.nth(Number(selectable[0].optionId))).toHaveClass(/is-selected/)
  await guest.locator('[data-option-id="done"]:visible').click()
  await expect.poll(async () => (await api(0, 'status')).session.state.revision).toBe(before.state.revision + 3)
  expect(commands).toBe(beforeCommands + 1, 'confirmation sends one online command')
  expect(errors).toEqual([])
  await guest.close()
})

test('Arkham setup reserves AI slots and copying an invitation never shifts the room layout', async ({ browser }) => {
  const host = await browser.newPage(), errors = []
  host.on('pageerror', error => errors.push(error.message))
  await host.goto(halls[0].url)
  await host.locator('.bg-settings-btn').click()
  await host.getByRole('button', { name: '🌐 联机', exact: true }).click()
  await host.getByRole('textbox', { name: '中转服务地址' }).fill(relayUrl)
  await host.getByRole('button', { name: '保存联机设置' }).click()
  await host.getByRole('button', { name: '关闭', exact: true }).click()
  await host.reload()
  await host.locator('.bg-card', { hasText: '诡镇奇谈' }).click()
  await host.getByRole('button', { name: '联机房间', exact: true }).click()
  await expect(host.getByRole('textbox', { name: '中转服务地址' })).toHaveCount(0)
  await expect(host.getByRole('combobox', { name: '席位数量' })).toHaveCount(1)
  await host.getByRole('combobox', { name: '席位数量' }).selectOption('4')
  await host.getByRole('combobox', { name: '席位 2', exact: true }).selectOption('ai-hu')
  await host.getByRole('combobox', { name: '席位 4', exact: true }).selectOption('ai-mei')
  await host.screenshot({ path: 'artifacts/online-unified-setup.png', fullPage: true })
  await host.getByRole('button', { name: '开始新游戏' }).click()
  await expect(host.getByRole('heading', { name: '等待玩家加入' })).toBeVisible()
  await expect(host.locator('[data-room-seat="1"]')).toContainText('才羽绿')
  await expect(host.locator('[data-room-seat="1"]')).toContainText('玩家不可加入')
  await expect(host.getByRole('button', { name: '开始联机对局' })).toBeDisabled()
  const status = await api(0, 'status')
  expect(status.relayUrl).toContain(relayUrl.replace('http:', 'ws:'))
  await expandOnlineBanner(host)
  await host.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.testInvite = text } } }))
  for (const width of [1400, 390]) {
    await host.setViewportSize({ width, height: 950 })
    const copy = host.getByRole('button', { name: '复制邀请', exact: true })
    const before = { copy: await copy.boundingBox(), banner: await host.locator('.bg-online-banner').boundingBox(), room: await host.locator('.bg-online-room').boundingBox() }
    await copy.click()
    await expect(host.getByText('邀请已复制，发给朋友后在大厅粘贴加入。')).toBeVisible()
    expect(await copy.boundingBox()).toEqual(before.copy)
    expect(await host.locator('.bg-online-banner').boundingBox()).toEqual(before.banner)
    expect(await host.locator('.bg-online-room').boundingBox()).toEqual(before.room)
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await host.screenshot({ path: `artifacts/online-room-${width}.png`, fullPage: true })
  }
  expect(await host.evaluate(() => window.testInvite)).toContain(status.room.code)
  await host.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } }))
  await host.getByRole('button', { name: '复制邀请', exact: true }).click()
  await expect(host.getByRole('dialog', { name: '手动复制邀请' })).toBeVisible()
  await expect(host.getByRole('textbox', { name: '邀请内容' })).toHaveValue(`BGH1 ${status.relayUrl} ${status.room.code}`)
  await host.getByRole('button', { name: '关闭', exact: true }).click()
  const joined = await api(1, 'join', { relayUrl, code: status.room.code })
  expect(joined.room.members.find(m => m.id === joined.memberId).seat).toBe(2)
  await api(1, 'ready', { ready: true })
  await expect(host.getByRole('button', { name: '开始联机对局' })).toBeEnabled()
  expect(errors).toEqual([])
  await host.close()
})

test('online save tab creates a waiting room and friends rejoin their saved seats', async ({ browser }) => {
  const host = await browser.newPage(), guest = await browser.newPage(), errors = []
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
  await host.addInitScript(url => localStorage.setItem('boardgame-hall.relay', url), relayUrl)
  const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, aiSeats: [] })
  await api(1, 'join', { relayUrl, code: created.room.code }); await api(1, 'ready', { ready: true })
  const started = await command(0, 'start')
  expect(started.ok, started.error).toBe(true)
  const id = started.session.sessionId
  const before = started.session.state
  await api(0, 'leave', {})
  await expect.poll(async () => (await api(1, 'status')).room).toBeNull()
  const solo = await (await fetch(halls[0].url + '/api/start', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modId: 'arkhamhorror', settings: { playerCount: 1, teammates: 0 } }) })).json()
  expect(solo.ok, solo.error).toBe(true)
  await host.goto(halls[0].url)
  await host.locator('.bg-card', { hasText: '诡镇' }).click()
  await host.getByRole('button', { name: '存档管理', exact: true }).click()
  await expect(host.locator(`[data-session-id="${solo.session.sessionId}"]`)).toBeVisible()
  await expect(host.locator(`[data-session-id="${id}"]`)).toHaveCount(0)
  await host.getByRole('button', { name: '联机存档', exact: true }).click()
  const save = host.locator(`[data-session-id="${id}"]`)
  await expect(save).toContainText('2 个玩家席位')
  await expect(host.locator(`[data-session-id="${solo.session.sessionId}"]`)).toHaveCount(0)
  await host.screenshot({ path: 'artifacts/online-save-list.png', fullPage: true })
  await save.getByRole('button', { name: '创建房间继续', exact: true }).click()
  await expect(host.getByRole('heading', { name: '等待玩家加入' })).toBeVisible()
  await expect(host.getByRole('button', { name: '继续存档对局', exact: true })).toBeDisabled()
  const loaded = await api(0, 'status')
  expect(loaded.room.code).not.toBe(created.room.code)
  expect(loaded.session).toBeNull()
  await guest.goto(halls[1].url)
  await guest.getByRole('button', { name: '加入联机房间', exact: true }).click()
  await guest.getByRole('textbox', { name: '房间码或完整邀请' }).fill(`BGH1 ${relayUrl} ${loaded.room.code}`)
  await guest.getByRole('combobox', { name: '加入席位', exact: true }).selectOption('1')
  await guest.getByRole('button', { name: '加入房间', exact: true }).click()
  await expect(guest.getByText('存档已读取。请朋友加入原来的席位，所有玩家准备后继续原有进度。')).toBeVisible()
  await guest.getByRole('button', { name: '准备', exact: true }).click()
  await expect(host.getByRole('button', { name: '继续存档对局', exact: true })).toBeEnabled()
  await host.screenshot({ path: 'artifacts/online-save-room.png', fullPage: true })
  await host.getByRole('button', { name: '继续存档对局', exact: true }).click()
  await expect.poll(async () => (await api(1, 'status')).session?.sessionId).toBe(id)
  const resumed = await api(0, 'status')
  expect(resumed.session.state).toEqual(before)
  await expect(host.getByRole('heading', { name: '等待玩家加入' })).toHaveCount(0)
  await expect(guest.getByRole('heading', { name: '等待玩家加入' })).toHaveCount(0)
  expect(errors).toEqual([])
  await host.close(); await guest.close()
})
