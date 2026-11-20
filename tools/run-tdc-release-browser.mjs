import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { browserSources } from './tdc-p8-evidence.mjs'

const campaignId = 'theDrownedCity'
const modRoot = new URL('../', import.meta.url)
const scope = JSON.parse(readFileSync(new URL('audit/tdc-scope.json', modRoot)))
const output = new URL('../../../artifacts/migration/tdc/p8/', import.meta.url)
const sources = browserSources(scope.scenarios)
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'tdc-p8-'))
process.env.BOARDGAME_PERF_FILE = '0'

// 验收候选清单独立加载。正式验收省略 --candidate，走实际发布状态。
const candidate = process.argv.includes('--candidate')
const hook = candidate ? registerHooks({
  load(url, context, next) {
    const result = next(url, context)
    if (/\/content\/(?:campaigns\/theDrownedCity\/(?:manifest|scenarios\/[^/]+\/index)|packs\/tdcCampaign\/manifest)\.js$/.test(url)) {
      result.source = String(result.source).replace("status: 'development'", "status: 'playable'")
    }
    return result
  },
}) : null
const { createServer } = await import('../../../lib/server.js')
const { loadModFrom } = await import('../../../lib/mods.js')
const { createRelay } = await import('../../../relay/server.js')
const hallManifest = JSON.parse(readFileSync(new URL('boardgame-mod.json', modRoot)))
const mod = await loadModFrom({ ...hallManifest, dir: fileURLToPath(modRoot), source: 'builtin' })
hook?.deregister()
const servers = []

async function listen(server) {
  servers.push(server)
  await server.ready
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  return `http://127.0.0.1:${server.address().port}`
}

const rows = []
const screenshots = new URL('screenshots/', output)
mkdirSync(screenshots, { recursive: true })
async function shot(page, name) {
  const path = new URL(`${name}.png`, screenshots)
  const png = await page.screenshot({ path: fileURLToPath(path), animations: 'disabled', timeout: 20_000 })
  return { file: `artifacts/migration/tdc/p8/screenshots/${name}.png`, sha256: createHash('sha256').update(png).digest('hex') }
}

async function api(base, route, data, options = {}) {
  const res = await fetch(`${base}/api/${route}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(options.online ? { 'x-boardgame-online': '1' } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(45_000),
  })
  const body = await res.json()
  if (!options.allowError) assert.equal(body.ok, true, `${route} ${data?.move?.action || data?.command?.text || ''}: ${body.error}`)
  return body
}

function local(base, sessionId) {
  return {
    sessionId,
    async read() { return (await api(base, `session?sessionId=${sessionId}`)).session },
    async move(session, move, seat = 0, allowError = false) {
      return api(base, 'move', { sessionId, revision: session.state.revision, move, seat }, { allowError })
    },
    async debug(session, text) {
      return api(base, 'debug', { sessionId, revision: session.state.revision, seat: 0, command: { text } })
    },
  }
}

function legal(session, action, condition = () => true) {
  const moves = session.state.legalMoves || []
  return moves.find(move => move.action === action && !move.disabled && condition(move))
}

function chosenMove(session, preferences = {}) {
  const choice = session.state.pendingChoice
  const choose = optionId => legal(session, 'choose', move => String(move.optionId) === optionId)
  if (preferences[choice?.source]) {
    const move = choose(preferences[choice.source])
    assert.ok(move, `${choice.source}: ${preferences[choice.source]} 不在候选项中`)
    return move
  }
  return ['done', 'skip', 'confirm', 'none'].map(choose).find(Boolean) || legal(session, 'choose')
}

async function gotoSetup(page, base) {
  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await expect(setup).toBeVisible({ timeout: 45_000 })
  return setup
}

async function start(page, base, seats = 1) {
  const setup = await gotoSetup(page, base)
  await setup.locator(`select:has(option[value="${campaignId}"])`).first().selectOption(campaignId)
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(String(seats))
  const response = page.waitForResponse(res => res.url().endsWith('/api/start'))
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const { ok, error, session } = await (await response).json()
  assert.equal(ok, true, error)
  assert.equal(session.state.campaign.id, campaignId)
  return local(base, session.sessionId)
}

async function clickMove(page, button, ...actions) {
  const response = page.waitForResponse(res => res.url().endsWith('/api/move')
    && actions.includes(res.request().postDataJSON()?.move?.action), { timeout: 55_000 })
  await button.click()
  const body = await (await response).json()
  assert.equal(body.ok, true, body.error)
}

async function prepare(page, client) {
  await clickMove(page, page.locator('.ah-workflow-next button').first(), 'hubGoSetup')
  await clickMove(page, page.getByRole('button', { name: /^选择调查员：玛利翁/ }).first(), 'hubSelectInvestigator')
  await clickMove(page, page.getByRole('button', { name: '使用推荐卡组', exact: true }).first(), 'hubAutoDeck', 'hubSetDeck')
  await clickMove(page, page.getByRole('button', { name: '最终确认牌组', exact: true }), 'hubConfirmDeck')
  await clickMove(page, page.getByRole('button', { name: '确认准备', exact: true }).first(), 'hubDoneSeat')
  assert.equal((await client.read()).state.investigators[0].code, '11001')
  await clickMove(page, page.locator('.ah-departure-start'), 'hubBeginScenario')
}

async function refresh(page) {
  for (const name of ['跳过演出', '刷新局势', '刷新']) {
    const button = page.getByRole('button', { name, exact: true }).first()
    if (await button.isVisible()) await button.dispatchEvent('click')
  }
}

async function clearPresentation(page) {
  const cinematic = page.locator('.ah-cinematic')
  await expect.poll(async () => {
    const skip = cinematic.getByRole('button', { name: '跳过演出' }).first()
    if (await skip.isVisible()) await skip.dispatchEvent('click')
    return await cinematic.count()
  }, { timeout: 20_000 }).toBe(0)
}

async function verifyGuide(page, session, chapter, viewport, entry = 'campaign') {
  const { id, code } = chapter
  assert.equal(session.state.scenario.id, id)
  assert.ok(session.state.locations.length, `${id}: 地点为空`)
  assert.ok(session.state.legalMoves.some(move => !move.disabled), `${id}: 合法动作为空`)
  if (!(await page.locator('.ah-table').isVisible())) await refresh(page)
  const name = session.state.scenario.name.split(/[：:]/).at(-1).trim()
  await expect.poll(async () => {
    await refresh(page)
    return (await page.locator('.bg-game-title').first().textContent().catch(() => ''))?.includes(name)
      && page.locator('[data-scenario-setup]').first().isVisible()
  }, { timeout: 45_000 }).toBe(true)
  const guideOutput = await page.request.get(new URL(`/mods/arkhamhorror/scenario-guides/${id}.json`, page.url()).href)
  assert.equal(guideOutput.ok(), true)
  const json = await guideOutput.json()
  assert.ok(json.locales.zh && json.locales.en)
  await clearPresentation(page)
  const open = page.locator('[data-scenario-setup]').first()
  await open.click()
  const guide = page.getByRole('dialog', { name: '关卡设置' })
  await expect(guide.locator('.ah-guide-block').first()).toBeVisible({ timeout: 30_000 })
  await expect(guide.locator('h2')).toContainText(name)
  const sections = await guide.locator('.ah-setup-section h3').allTextContents()
  assert.ok(sections.includes('设置'), JSON.stringify(sections))
  if (json.locales.zh.specialRules?.length) {
    assert.ok(sections.includes('特别规则') && sections.indexOf('特别规则') < sections.indexOf('设置'))
  }
  await expect(guide.locator('details[open]')).toHaveCount(0)
  await expect(guide.locator('details')).toHaveCount(
    [json.locales.zh.story, json.locales.zh.resolutions].filter(blocks => blocks?.length).length,
  )
  const screenshot = await shot(page, `${viewport}-${id}`)
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)
  rows.push({ kind: 'chapter', viewport, id, code, entry, screenshot })
  console.log(`[TDC P8] ${viewport} ${id} guide passed`)
}

async function verifySave(page, client, base, before, viewport) {
  await api(base, 'session/save', { sessionId: client.sessionId })
  const setup = await gotoSetup(page, base)
  await setup.getByRole('button', { name: '存档管理', exact: true }).click()
  const entry = page.locator(`.ah-save-item[data-session-id="${client.sessionId}"]`).first()
  const response = page.waitForResponse(res => res.url().endsWith('/api/session/load'), { timeout: 45_000 })
  await entry.getByRole('button', { name: /读取此存档/ }).first().click()
  const loaded = await (await response).json()
  assert.equal(loaded.ok, true, loaded.error)
  assert.equal(loaded.session.sessionId, before.sessionId)
  assert.equal(loaded.session.state.revision, before.state.revision)
  assert.equal(loaded.session.state.scenario.id, before.state.scenario.id)
  assert.deepEqual(loaded.session.state.campaign.records, before.state.campaign.records)
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 45_000 })
  rows.push({ kind: 'save', viewport, screenshot: await shot(page, `${viewport}-restored`) })
}

async function ready(client, options = {}) {
  for (let step = 0; step < 60; step++) {
    const session = await client.read()
    const state = session.state
    if (state.uiState === 'campaignResult') return session
    if (state.pendingChoice) {
      const move = chosenMove(session, options)
      assert.ok(move, `${state.pendingChoice.source}: 无法结算选择`)
      await client.move(session, move)
      continue
    }
    if (state.uiState === 'inScenario') return session
    const action = ['hubContinue', 'hubBeginScenario', 'hubDoneSeat'].map(name => legal(session, name)).find(Boolean)
    assert.ok(action, `${state.uiState}/${state.campaign.flow?.nodeId}: ${state.legalMoves.map(move => move.action)}`)
    await client.move(session, action)
  }
  assert.fail('战役流程未推进')
}

async function localRoutes(browser, base, viewport, size) {
  const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    const client = await start(page, base)
    await prepare(page, client)
    const direction = viewport === 'desktop' ? 'west' : 'east'
    const route = []
    const branch = { expeditionChoice: direction, interludeOneDecision: 'accept',
      westernWallShortcut: 'apiary', apiaryShortcut: 'westernWall' }
    const shortcut = direction === 'west' ? 'theWesternWall' : 'theApiary'
    const resolutions = { [shortcut]: direction === 'west' ? 'R3' : 'R4',
      ...(direction === 'east' ? { theDoomOfArkhamPartI: 'noResolution', theDoomOfArkhamPartII: 'noResolution' } : {}) }
    let current = await ready(client, branch)
    while (current.state.uiState === 'inScenario') {
      const id = current.state.scenario.id
      assert.ok(!route.includes(id), `重复进入 ${id}`)
      route.push(id)
      await verifyGuide(page, current, scope.scenarios.find(chapter => chapter.id === id), viewport)
      if (id === 'oneLastJob') await verifySave(page, client, base, current, viewport)
      const action = legal(current, 'resource') || legal(current, 'draw') || legal(current, 'endTurn')
      assert.ok(action, `${id}: 没有可执行的基本行动`)
      await client.move(current, action)
      current = await ready(client, branch)
      await client.debug(current, `结束这关 ${resolutions[id] || 'R1'}`)
      current = await ready(client, branch)
    }
    const expeditions = direction === 'west'
      ? ['theWesternWall', 'theApiary', 'theGrandVault', 'courtOfTheAncients', 'obsidianCanyons']
      : ['obsidianCanyons', 'courtOfTheAncients', 'theGrandVault', 'theApiary', 'theWesternWall']
    assert.deepEqual(route, ['oneLastJob', ...expeditions, 'theDoomOfArkhamPartI', 'theDoomOfArkhamPartII'])
    assert.equal(current.state.outcome, direction === 'west' ? 'victory' : 'defeat')
    await expect.poll(async () => {
      await refresh(page)
      return page.locator('.ah-hub[data-ui-state="campaignResult"]').isVisible()
    }, { timeout: 45_000 }).toBe(true)
    rows.push({ kind: 'route', viewport, direction, chapters: route, outcome: current.state.outcome,
      screenshot: await shot(page, `${viewport}-${direction}-result`) })
    console.log(`[TDC P8] ${viewport} ${direction} route passed`)

    const isolated = await start(await context.newPage(), base)
    // 此会话只复用正常选人、组牌和开局。两个未走到的章节由现有调试跳关进入。
    const setup = await isolated.read()
    await isolated.move(setup, legal(setup, 'hubGoSetup'))
    for (const [action, predicate] of [['hubSelectInvestigator', move => move.code === '11001'],
      ['hubAutoDeck'], ['hubConfirmDeck'], ['hubDoneSeat'], ['hubBeginScenario']]) {
      const state = await isolated.read()
      await isolated.move(state, legal(state, action, predicate))
    }
    const chapterPage = context.pages().at(-1)
    let session = await ready(isolated)
    for (const id of ['theDrownedQuarter', 'sepulchreOfTheSleeper']) {
      await isolated.debug(session, `跳到 ${id}`)
      session = await ready(isolated)
      await verifyGuide(chapterPage, session, scope.scenarios.find(chapter => chapter.id === id), viewport, 'debug-scenario')
      const action = legal(session, 'resource') || legal(session, 'draw') || legal(session, 'endTurn')
      assert.ok(action, `${id}: 没有可执行的基本行动`)
      await isolated.move(session, action)
      session = await ready(isolated)
    }
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function onlineAcceptance(browser, viewport, size, fillAi) {
  const relay = await listen(createRelay())
  const halls = await Promise.all([0, 1].map(() => listen(createServer({ mods: [mod], persist: false }))))
  const online = (seat, route, body, allowError = false) => api(halls[seat], `online/${route}`, body, { online: true, allowError })
  const command = (seat, action, body = {}, allowError = false) => online(seat, 'command',
    { action, body: { operationId: randomUUID(), ...body } }, allowError)
  const status = async seat => (await online(seat, 'status')).session
  const act = async (seat, action, predicate) => {
    let move, current
    await expect.poll(async () => {
      current = await status(seat)
      move = current && legal(current, action, predicate)
      return Boolean(move)
    }, { timeout: 20_000, message: `座位 ${seat} 可执行 ${action}` }).toBe(true)
    return command(seat, 'move', { revision: current.state.revision, move })
  }

  const { room } = await online(0, 'create', { relayUrl: relay, modId: 'arkhamhorror', capacity: fillAi ? 3 : 2, fillAi,
    settings: { campaignId, seed: `tdc-online-${viewport}-${fillAi}` } })
  await online(1, 'join', { relayUrl: relay, code: room.code })
  await online(1, 'ready', { ready: true })
  const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' })
  try {
    const pages = await Promise.all(halls.map(async base => {
      const page = await context.newPage()
      await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' })
      return page
    }))
    await command(0, 'start')
    await act(0, 'hubGoSetup')
    await act(0, 'hubSetLeader', move => move.leadSeat === 0)
    for (const [seat, code] of ['11001', '11004'].entries()) {
      await act(seat, 'hubSelectInvestigator', move => move.code === code)
      await act(seat, 'hubAutoDeck')
      await act(seat, 'hubConfirmDeck')
      await act(seat, 'hubDoneSeat')
    }
    const guest = await status(1)
    assert.equal(legal(guest, 'hubBeginScenario'), undefined)
    const denied = await command(1, 'move', { revision: guest.state.revision, move: { action: 'hubBeginScenario' } }, true)
    assert.equal(denied.ok, false)
    assert.equal((await status(1)).state.revision, guest.state.revision)
    await act(0, 'hubBeginScenario')

    for (let step = 0; step < 48; step++) {
      const views = await Promise.all([0, 1].map(status))
      let acted = false
      for (const [seat, view] of views.entries()) {
        const move = chosenMove(view) || legal(view, 'hubDoneSeat') || legal(view, 'hubBeginScenario')
        if (!move) continue
        const result = await command(seat, 'move', { revision: view.state.revision, move }, true)
        acted = result.ok === true
        if (acted) break
      }
      if (!acted && views.every(view => view.state.uiState === 'inScenario' && !view.state.pendingChoice)) break
      if (!acted) await new Promise(resolve => setTimeout(resolve, 150))
    }
    const views = await Promise.all([0, 1].map(status))
    for (const [seat, view] of views.entries()) {
      assert.equal(view.state.scenario.id, 'oneLastJob')
      assert.deepEqual(view.state.humanSeats, [0, 1])
      assert.equal(view.state.investigators.length, fillAi ? 3 : 2)
      assert.ok(view.state.investigators[seat].hand.length)
      assert.deepEqual(view.state.investigators[1 - seat].hand, [])
      assert.deepEqual(view.state.investigators[1 - seat].deck, [])
      await expect.poll(async () => {
        await refresh(pages[seat])
        return pages[seat].locator(`.ah-hand[data-hand-seat="${seat}"]`).isVisible()
      }, { timeout: 45_000 }).toBe(true)
      await expect(pages[seat].locator(`.ah-hand[data-hand-seat="${1 - seat}"]`)).toHaveCount(0)
    }
    if (fillAi) {
      assert.equal(views[0].players[2].role, 'ai')
      assert.equal(views[0].state.investigators[2].deckSize > 0, true)
    }
    const seat = views.findIndex(view => legal(view, 'resource'))
    assert.ok(seat >= 0, '至少一名真人可执行资源行动')
    const owner = views[seat].state.investigators[seat].resources
    await act(seat, 'resource')
    await expect.poll(async () => (await status(seat)).state.investigators[seat].resources).toBe(owner + 1)
    await pages[1].close()
    const reconnected = await context.newPage()
    await reconnected.goto(`${halls[1]}/index.html`, { waitUntil: 'domcontentloaded' })
    await expect.poll(async () => {
      await refresh(reconnected)
      return reconnected.locator('.ah-hand[data-hand-seat="1"]').isVisible()
    }, { timeout: 45_000 }).toBe(true)
    assert.equal((await status(1)).sessionId, views[1].sessionId)
    rows.push({ kind: fillAi ? 'ai' : 'online', viewport, screenshot: await shot(reconnected, `${viewport}-${fillAi ? 'ai' : 'online'}`) })
    console.log(`[TDC P8] ${viewport} ${fillAi ? 'cooperative AI' : 'online'} passed`)
  } finally {
    await context.close()
  }
}

const hall = await listen(createServer({ mods: [mod], persist: true }))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const size = { width, height }
    await localRoutes(browser, hall, viewport, size)
    await onlineAcceptance(browser, viewport, size, false)
    await onlineAcceptance(browser, viewport, size, true)
  }
  const after = browserSources(scope.scenarios)
  const changed = [...new Set([...Object.keys(sources), ...Object.keys(after)])].filter(file => sources[file] !== after[file])
  assert.deepEqual(changed, [], '验收期间源码发生变化，须重跑')
  const report = JSON.stringify({ schemaVersion: 1, campaignId, candidate, sources, rows }, null, 2) + '\n'
  writeFileSync(new URL(candidate ? 'candidate-browser.json' : 'release-browser.json', output), report)
  if (!candidate) writeFileSync(new URL('audit/tdc-release-browser.json', modRoot), report)
} finally {
  await browser.close()
  for (const server of servers.reverse()) {
    server.stopRelay?.()
    server.online?.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
