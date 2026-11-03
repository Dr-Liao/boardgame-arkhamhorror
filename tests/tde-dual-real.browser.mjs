// 《食梦者》（TDE）P10 真实战役双线浏览器验收（桌面 1440×950 / 移动 390×844）。
//
// 与 P9 的 tests/tde-dual.browser.mjs 的分工：那个 spec 走 webServer 的「双线演示」战役
// （content/browser-demo/dualHub.js，A/B 两幕复用核心《聚会》关卡），证明的是 UI 机制；
// **本 spec 走真实《食梦者》战役**（P10 起已注册进生产 `content/registered.js`：三包 + 战役 +
// 8 章全 playable、dualLineGate=open），证明真实大厅 → 四模式面板 → 并行出发准备左右分屏
// （真实章名《梦境门外》/《清醒噩梦》）→ 并行局内单线牌桌与按线隐私；以及 pick 3 人 2+1 的
// 座位分线与非活动线 waiting。
//
// P10 口径（与 P9.5 的区别）：**spec 进程不再注册任何内容**（生产组合根已含 theDreamEaters），
// 直接 import 生产引擎/mod 建局；真实大厅的「战役」下拉框本身就有《食梦者》（真实 /api/catalog），
// /api/start 也**原样转发**真实大厅开局请求（真实 server 进程创建 TDE 会话，campaignId=theDreamEaters）——
// 只把返回会话里的 state 换成 spec 进程用同一份生产内容建出的容器投影（为了确定性准备与按座位
// 切换观察视图），随后点击产生的动作仍走真实 mod.validateMove/mod.applyMove。
//
// 注入点：
//   · /api/start：原样转发真实大厅开局请求（真实 TDE 会话，payload.session.state.campaign.id 断言）；
//   · /api/session：回放当前观察座位（并行局内用 mod.viewState(state, roomSeat) 的本线投影）；
//   · /api/move：先走 mod.validateMove，再走真实 mod.applyMove（并行时由 lane adapter 路由到
//     本线运行时）；准备阶段的队友准备由 spec 进程按大厅 AI 的既有口径代打（autoHubMove 同款动作
//     序列，P10 起候选池优先真实 TDE 调查员 06001–06005），局内开始关卡后的两条线待决选择用
//     settleParallelLaneChoices 结算。
//
// 证据口径：截图落仓库根 artifacts/tde-migration/p9.5-*.png（annotation 记绝对路径）；
// 每例断言 0 pageerror / 0 console error / 0 HTTP>=400 / 无横向溢出。
//
// 命令（BOARDGAME_PORT=8813；先检查 artifacts/migration/tde/p9-recon/.playwright.lock）：
//   node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tde.config.mjs tde-dual-real.browser.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUT = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(OUTPUT, { recursive: true })

const VIEWPORTS = [['desktop', 1440, 950], ['mobile', 390, 844]]
const P95_CAMPAIGN_ID = 'theDreamEaters'
const CAMPAIGN_NAME = '食梦者'
// P10 真实大厅可选调查员（M1 五人）：hub 候选池修复后应全部在 legalMoves 里。
const TDE_INVESTIGATOR_CODES = Object.freeze(['06001', '06002', '06003', '06004', '06005'])
// 真实章节 id（A/B 第一章）：出发准备页的章名来自真实 manifest/parts，不写演示战役的关卡名。
const LANE_SCENARIO = {
  A: { id: 'beyondTheGatesOfSleep', name: '梦境门外' },
  B: { id: 'wakingNightmare', name: '清醒噩梦' },
}

// ---------------------------------------------------------------------------
// spec 进程：直接使用生产注册的真 TDE 内容（P10 起 content/registered.js 已含三包+战役+8 章）
// ---------------------------------------------------------------------------
let worldPromise = null
function loadWorld () {
  worldPromise ||= (async () => {
    const engine = await import('../src/engine/engine.js')
    const observation = await import('../src/integration/observation.js')
    const { contentRegistry } = await import('../content/registered.js')
    const modModule = await import('../index.js')
    const mod = modModule.default || modModule
    return { engine, observation, contentRegistry, mod }
  })()
  return worldPromise
}

/** 结算开局待决选择（取 done/skip 或第一项，直到没有待决选择）。 */
function settlePendingChoices (engine, state, { mover = null, maxRounds = 300 } = {}) {
  const commit = mover || ((target, seat, move) => engine.applyMove(target, seat, move))
  for (let guard = 0; state.pendingChoice && guard < maxRounds; guard += 1) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    commit(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  if (state.pendingChoice) throw new Error(`开局选择未收敛：${state.pendingChoice.kind}`)
  return state
}

/** 并行容器：逐条结算两条线上挂起的待决选择（laneSeat → roomSeat 由 laneRuntime 提供）。 */
function settleParallelLaneChoices (engine, mod, state, { maxRounds = 400 } = {}) {
  for (let guard = 0; guard < maxRounds; guard += 1) {
    let answered = false
    for (const lane of ['A', 'B']) {
      const laneState = state.parallel?.lanes?.[lane]
      const pending = laneState?.pendingChoice
      if (!pending) continue
      const laneSeat = pending.seat ?? 0
      const roomSeat = laneState.laneRuntime?.roomSeats?.[laneSeat] ?? laneSeat
      const optionId = pending.options?.find(option => ['done', 'skip'].includes(option.id))?.id
        || pending.options?.[0]?.id
      if (!optionId) throw new Error(`并行 ${lane} 线待决选择没有选项`)
      mod.applyMove(state, roomSeat, { action: 'choose', choiceId: pending.id, optionId })
      answered = true
      break
    }
    if (!answered) return state
  }
  throw new Error('并行待决选择未收敛')
}

const plainMove = move => {
  if (!move || typeof move !== 'object') return move
  const { label, explanation, disabled, ...rest } = move
  return rest
}

/** 大厅座位表：座位 0 是真人，其余是 AI 队友（与 lib/server.js buildPlayers 同口径的最小形状）。 */
function buildPlayers (seats) {
  return Array.from({ length: seats }, (_, seat) => (seat === 0
    ? { seat, role: 'human', color: 'black', name: '验收玩家', avatar: '🕵️', colorHex: '#3aa0ff' }
    : { seat, role: 'ai', color: 'white', name: `AI 队友 ${seat}`, avatar: '🎭', colorHex: '#bbbbbb' }))
}

/** 真实引擎建局：TDE 战役台面（campaignHub），并结算开局选择。 */
function createHubState (world, { seats, seed }) {
  const state = world.engine.createGameState({
    campaignId: P95_CAMPAIGN_ID, campaignHub: true, seed,
  }, buildPlayers(seats))
  settlePendingChoices(world.engine, state)
  return state
}

/** 选开局模式（四模式由真实 manifest.modes/flows 产出，不走演示壳）。 */
function selectMode (world, state, mode) {
  const move = world.engine.legalMoves(state, 0).find(item => item.action === 'hubSetMode' && item.mode === mode)
  if (!move) throw new Error(`真实 TDE 没有可用的开局模式：${mode}`)
  world.mod.applyMove(state, 0, { action: 'hubSetMode', mode })
  settlePendingChoices(world.engine, state)
}

/**
 * 把真实 TDE 台面驱动到「出发准备完成」（hubReady=true）：
 *   1. 进准备页（hubGoSetup，真实 UI 上对应「选择调查员」）；
 *   2. 逐个空位按大厅 AI 的 autoHubMove 同款动作序列（选人 → 自动牌组 → 确认）准备。
 * 换线由浏览器里的真实按钮提交（分选用例），这里不代打。
 */
function prepareHub (world, state) {
  const { engine, mod } = world
  if (state.uiState === 'campaignHub') {
    const setup = engine.legalMoves(state, 0).find(move => move.action === 'hubGoSetup')
    if (setup) {
      mod.applyMove(state, 0, { action: 'hubGoSetup' })
      settlePendingChoices(engine, state)
    }
  }
  for (let guard = 0; guard < 80 && !state.hubReady; guard += 1) {
    const seat = engine.actingSeats(state).find(candidate => !state.hubSeatDone?.[candidate])
    if (seat == null) break
    const moves = engine.legalMoves(state, seat)
    const selected = !!state.hubSeatSelected?.[seat]
    // P10：真实大厅候选池已含食梦者 5 人，优先选真实 TDE 调查员（真人座位 0 固定选 06001）。
    const candidates = moves.filter(move => move.action === 'hubSelectInvestigator')
    const selectMove = candidates.find(move => TDE_INVESTIGATOR_CODES.includes(move.code))
      || candidates[0]
    const deckMove = moves.find(move => move.action === 'hubAutoDeck')
    const doneMove = moves.find(move => move.action === 'hubDoneSeat')
    // 与大厅 AI 的 autoHubMove 同一顺序：未选人 → 选人；牌组未存 → 自动构筑；最后确认席位。
    // hubSelectInvestigator 在选完后仍会作为「换人」候选下发，必须先看 hubSeatSelected。
    const next = (!selected && selectMove)
      || deckMove
      || doneMove
      || moves.find(move => move.action === 'hubSetLeader' && move.leadSeat === seat)
      || moves.find(move => move.action === 'hubSelectScenario')
    if (!next) throw new Error(`座位 ${seat} 的关间准备没有可执行动作：${moves.map(move => move.action).join(',')}`)
    mod.applyMove(state, seat, plainMove(next))
    settlePendingChoices(engine, state)
  }
  if (!state.hubReady) throw new Error(`关间准备未收敛：done=${JSON.stringify(state.hubSeatDone)}`)
  return state
}

function createPreparedHub (world, { seats, mode, seed }) {
  const state = createHubState(world, { seats, seed })
  selectMode(world, state, mode)
  prepareHub(world, state)
  return state
}

/**
 * 结算挂起的待决选择。并行容器逐线结算；分选/单线局内是「单运行时 + laneRuntime」，
 * pending.seat 是线内座位，必须按 laneRuntime.roomSeats 换回房间座位再走 mod 边界。
 */
function settleRuntimeChoices (world, state) {
  const { engine, mod } = world
  if (state.parallel) {
    settleParallelLaneChoices(engine, mod, state)
    return state
  }
  for (let guard = 0; state.pendingChoice && guard < 200; guard += 1) {
    const pending = state.pendingChoice
    const runtimeSeat = pending.seat ?? 0
    const roomSeat = state.laneRuntime?.roomSeats?.[runtimeSeat] ?? runtimeSeat
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0]?.id
    if (!optionId) throw new Error(`待决选择没有选项：${pending.kind}`)
    mod.applyMove(state, roomSeat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

/** 并行容器两条线各自「这一局实际在场」的事实（章名/地点名/调查员名），用于跨线隐私断言。 */
function parallelFacts (state) {
  const laneState = lane => state.parallel.lanes[lane]
  const facts = lane => {
    const s = laneState(lane)
    return {
      scenarioId: s.scenario?.id || '',
      scenarioName: s.scenario?.name || '',
      locationNames: (s.locations || []).map(location => location.name).filter(Boolean),
      actNames: (s.acts || []).map(act => act.name).filter(Boolean),
      agendaNames: (s.agendas || []).map(agenda => agenda.name).filter(Boolean),
      investigatorNames: (s.investigators || []).map(inv => inv.name).filter(Boolean),
    }
  }
  return { A: facts('A'), B: facts('B') }
}

// ---------------------------------------------------------------------------
// 浏览器注入：真实大厅 /api/start + 当前观察座位投影 + 真实 mod 动作结算
// ---------------------------------------------------------------------------

/**
 * 安装真实 TDE 战役注入。`state` 是 spec 进程里的权威容器；页面里每个 /api 响应都按
 * 当前观察座位（observerSeat）重新投影，所以「切到另一条线的座位视图」= setSeat + 刷新。
 * P10：/api/catalog 与 /api/start 都原样走真实 server（生产组合根已注册 TDE），只替换
 * 返回会话里的权威 state（换成同一份生产内容建出的容器投影）。
 */
async function installInjection (page, world, { state, seats, seat = 0, autoPrepare = false }) {
  let players = buildPlayers(seats)
  let observerSeat = seat
  let template = null
  let started = false
  let realStart = null
  let hubCandidateCodes = null
  const errors = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  // 资源请求失败也计入（真实 server 已注册 TDE，正常路径不应出现 4xx/5xx）。
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`)
  })

  // 大厅 /api/session 的 state 是观察投影（并行局内是本线投影），并携带容器 revision；
  // 这里用 Mod 自己暴露的同一入口 viewState，而不是把容器 state 直接塞给浏览器。
  const projectState = () => {
    const view = world.mod.viewState(state, observerSeat)
    view.revision = state.revision ?? view.revision ?? 0
    return view
  }
  const buildSession = () => ({
    ...(template || {}),
    modId: 'arkhamhorror',
    modName: '诡镇奇谈：卡牌版',
    players,
    state: projectState(),
    events: [],
    notes: [],
    scenarioCheckpoints: [],
    observerSeat,
    mySeat: observerSeat,
    decisionSeat: world.mod.decisionSeat(state) ?? null,
    actingSeats: world.mod.actingSeats(state) || [],
    saveError: null,
    saveDetached: false,
  })
  // 页面行为之后补真实大厅会做的事：准备阶段的队友准备（含房主自己的选人/自动牌组/确认，
  // 与真实大厅 autoHubMove 同一动作序列）；局内开始关卡后两条线的开局待决选择。
  const reconcile = () => {
    // 候选池证据（P10 修复后 hub 真人可选池 = 27 + 食梦者 5 人）：在准备代打前抓一次。
    if (autoPrepare && state.hubFlow && state.uiState === 'scenarioSetup' && !state.hubReady) {
      hubCandidateCodes = world.engine.legalMoves(state, 0)
        .filter(move => move.action === 'hubSelectInvestigator').map(move => move.code)
      prepareHub(world, state)
    }
    settleRuntimeChoices(world, state)
  }

  await page.route('**/api/start', async route => {
    // P10：真实大厅请求原样转发（campaignId 就是 theDreamEaters，server 进程已注册）。
    // 真实会话外壳（sessionId/players/lifecycle/真实 createGameState 结果）保留，随后只把
    // state 替换成 spec 进程用同一份生产内容建出的容器投影（为了确定性与按座位切换视图）。
    const response = await route.fetch({ postData: route.request().postData() })
    const payload = await response.json()
    if (payload.ok) {
      realStart = {
        campaignId: payload.session?.state?.campaign?.id || null,
        campaignName: payload.session?.state?.campaign?.name || null,
        uiState: payload.session?.state?.uiState || null,
        playerCount: payload.session?.players?.length || 0,
      }
      template = payload.session
      if (Array.isArray(template.players) && template.players.length === seats) players = template.players
      started = true
      payload.session = buildSession()
      hubCandidateCodes = null
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })

  await page.route('**/api/session?*', route => route.fulfill({
    json: { ok: true, session: started ? buildSession() : null, busy: false },
  }))

  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    const seat = Number.isInteger(body.seat) ? body.seat : 0
    const move = plainMove(body.move) || {}
    delete move.revision
    delete move.laneRevision
    delete move.containerRevision
    try {
      // 与大厅同一顺序：先问 mod 这个座位现在能不能做这个动作（非活动线座位会拿到明确原因）。
      const reason = world.mod.validateMove(state, seat, move)
      if (reason) {
        return route.fulfill({ json: { ok: false, error: reason, session: buildSession() } })
      }
      world.mod.applyMove(state, seat, move)
      reconcile()
      const session = buildSession()
      return route.fulfill({
        json: { ok: true, session, revision: session.state.revision, events: [] },
      })
    } catch (error) {
      return route.fulfill({ json: { ok: false, error: String(error?.message || error), session: buildSession() } })
    }
  })

  return {
    errors,
    setSeat (next) { observerSeat = next },
    seat () { return observerSeat },
    sessionId () { return template?.sessionId || null },
    realStart: () => realStart,
    hubCandidateCodes: () => hubCandidateCodes,
    view: () => projectState(),
  }
}

/** 从真实大厅进入（点游戏卡 → 开局设置 → 选真实 TDE 战役与席位数 → 开始新游戏）。 */
async function openRealTdeLobby (page, world, { state, seats, seat = 0, autoPrepare = false }) {
  const injector = await installInjection(page, world, { state, seats, seat, autoPrepare })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await expect(setup).toBeVisible()
  const campaign = setup.getByRole('combobox', { name: '战役', exact: true })
  // P10：真实大厅（生产注册）的战役下拉本身含 theDreamEaters，直接选它走真实 /api/start。
  const campaignOptions = await campaign.locator('option').evaluateAll(options =>
    options.map(option => ({ value: option.value, label: option.textContent })))
  expect(campaignOptions.map(option => option.value)).toContain(P95_CAMPAIGN_ID)
  await campaign.selectOption(P95_CAMPAIGN_ID)
  await expect.poll(async () => campaign.evaluate(select => select.selectedOptions[0]?.textContent || '')).toBe(CAMPAIGN_NAME)
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(String(seats))
  const started = page.waitForResponse(response => response.url().endsWith('/api/start'))
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const startBody = await (await started).json()
  expect(startBody.ok, startBody.error).toBe(true)
  // 真实 /api/start 返回的会话就是生产 TDE 战役台面（spec 不自注册、不替换 campaignId）。
  const realStart = injector.realStart()
  expect(realStart.campaignId).toBe(P95_CAMPAIGN_ID)
  expect(realStart.playerCount).toBe(seats)
  await page.locator('.ah-hub').first().waitFor({ state: 'attached', timeout: 30_000 })
  return injector
}

/** 读取浏览器当前观察投影（走真实 /api/session 路由，不是 Node 侧对象）。 */
async function readBrowserSession (page, sessionId) {
  return page.evaluate(async id => {
    const response = await fetch('/api/session?sessionId=' + encodeURIComponent(id))
    const payload = await response.json()
    return payload.session
  }, sessionId)
}

async function capture (testInfo, page, name) {
  const path = join(OUTPUT, name)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  testInfo.annotations.push({ type: 'screenshot', description: path })
  return path
}

const modePanelOf = page => page.locator('.ah-hub').getByRole('region', { name: '开局模式', exact: true })

/** 局内开始关卡的演出层会遮住牌桌：把排队中的故事/地点演出走完，截图与按钮断言才看得到牌桌。 */
async function dismissPresentation (page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await page.locator('.ah-cinematic').count() === 0) return
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const next = page.getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    await page.waitForTimeout(120)
  }
}

async function expectNoHorizontalOverflow (page) {
  expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
}

/** 等待真实 /api/move 响应并断言成功。 */
async function clickMove (page, action, click) {
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === action)
  await click()
  const body = await (await responsePromise).json()
  expect(body.ok, `${action} -> ${body.error}`).toBe(true)
  return body
}

// ---------------------------------------------------------------------------
// 例 1：真实 TDE 大厅——四模式面板 + 并行出发准备左右分屏（真实章名/本线调查员/两线队长）
// ---------------------------------------------------------------------------
for (const [label, width, height] of VIEWPORTS) {
  test(`P9.5 真实食梦者大厅四模式面板与并行出发准备分屏（${label}）`, async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'scenario', description: LANE_SCENARIO.A.id })
    testInfo.annotations.push({ type: 'interaction', description: 'dualLineReal' })

    const world = await loadWorld()
    const state = createHubState(world, { seats: 4, seed: `tde-p95-lobby-${label}` })
    const injector = await openRealTdeLobby(page, world, {
      state, seats: 4, seat: 0, autoPrepare: true,
    })
    const hub = page.locator('.ah-hub')
    const panel = modePanelOf(page)

    // 1) 真实 TDE 战役台面：首屏就是开局模式门，四个选项都在且可用（4 人可等分）。
    await expect(panel).toBeVisible()
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(1)
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(0)
    await expect(panel).toContainText('先选开局模式')
    const modeButtons = panel.locator('.ah-office-mode-list button')
    await expect(modeButtons).toHaveCount(4)
    // 真实 TDE 的单线模式标签会带上该线第一关线索（如「单线 A（梦寻）」），用前缀匹配。
    for (const name of [/^单线 A/, /^单线 B/, /^分选双线$/, /^并行双线$/]) {
      await expect(panel.getByRole('button', { name })).toBeEnabled()
    }
    await expect(panel.getByRole('button', { name: '并行双线', exact: true })).toBeEnabled()
    // 真实战役名与「非演示战役」：页面里没有演示战役 id/关卡名。
    await expect(page.locator('body')).not.toContainText('dualHubDemo')
    await expect(page.locator('body')).not.toContainText('第二幕：午夜假面')
    await capture(testInfo, page, `p9.5-real-mode-gate-${label}.png`)

    // 2) 选并行：模式门与面板一起收起；2026-11-02 起「战役总览」不再保留「当前模式 / 逐座位
    //    换线」面板，手动分线只在出发准备页每张人物卡的「换位置」上完成。
    await clickMove(page, 'hubSetMode', () => panel.getByRole('button', { name: '并行双线', exact: true }).click())
    await expect(panel).toHaveCount(0)
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(0)
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    await expect(hub.getByText('开局模式', { exact: true })).toHaveCount(0)

    // 3) 进准备页（真实 UI 按钮），spec 进程按大厅口径把四个座位准备完 → 自动落到「出发准备」。
    await clickMove(page, 'hubGoSetup', () => hub.locator('.ah-workflow-guide').getByRole('button', { name: '选择调查员' }).click())
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible({ timeout: 20_000 })
    // P10 候选池：真实 hub「选择调查员」候选含食梦者 5 人（AI 自动选人池仍保持 27 人不漂移），
    // 准备代打优先把真实 TDE 调查员分给四个座位（真人座位 0 = 06001）。
    const candidateCodes = injector.hubCandidateCodes() || []
    for (const code of TDE_INVESTIGATOR_CODES) expect(candidateCodes).toContain(code)
    expect(state.investigators[0].code).toBe('06001')
    expect(state.investigators.filter(inv => TDE_INVESTIGATOR_CODES.includes(inv.code)).length).toBe(4)
    const laneA = departure.locator('.ah-departure-lane[data-lane="A"]')
    const laneB = departure.locator('.ah-departure-lane[data-lane="B"]')
    await expect(laneA).toBeVisible()
    await expect(laneB).toBeVisible()
    // 真实章名：A 线《梦境门外》/ B 线《清醒噩梦》（来自真实 parts 投影，不是演示战役关卡）。
    await expect(laneA.locator('.ah-departure-lane-scenario')).toContainText(LANE_SCENARIO.A.name)
    await expect(laneB.locator('.ah-departure-lane-scenario')).toContainText(LANE_SCENARIO.B.name)
    await expect(laneA.getByRole('heading', { name: 'A 线' })).toBeVisible()
    await expect(laneB.getByRole('heading', { name: 'B 线' })).toBeVisible()
    // 本线调查员：每线 2 名（2+2），座位号与线归属一致。
    const membersA = laneA.locator('.ah-departure-member')
    const membersB = laneB.locator('.ah-departure-member')
    await expect(membersA).toHaveCount(2)
    await expect(membersB).toHaveCount(2)
    expect(await membersA.evaluateAll(nodes => nodes.map(node => node.dataset.seat))).toEqual(['0', '1'])
    expect(await membersB.evaluateAll(nodes => nodes.map(node => node.dataset.seat))).toEqual(['2', '3'])
    const participantNames = state.investigators.map(inv => inv.name)
    const namesA = await membersA.locator('h3').allInnerTexts()
    const namesB = await membersB.locator('h3').allInnerTexts()
    for (const name of [...namesA, ...namesB]) expect(participantNames).toContain(name)
    // 两线队长：每条线显示自己的队长（本线成员），不是空白/跨线名字。
    const leaderA = (await laneA.locator('.ah-departure-lane-leader-line strong').innerText()).trim()
    const leaderB = (await laneB.locator('.ah-departure-lane-leader-line strong').innerText()).trim()
    expect(leaderA).not.toBe('')
    expect(leaderB).not.toBe('')
    expect(leaderA).not.toBe(leaderB)
    expect(namesA).toContain(leaderA)
    expect(namesB).toContain(leaderB)

    // 4) 状态层同口径：真实 TDE 战役、并行模式、2+2 座位表、两条线的真实章节投影。
    const session = await readBrowserSession(page, injector.sessionId())
    expect(session.state.campaign.id).toBe(P95_CAMPAIGN_ID)
    expect(session.state.campaign.name).toBe(CAMPAIGN_NAME)
    expect(session.state.campaign.mode).toBe('parallel')
    expect(session.state.campaign.seatParts).toEqual(['A', 'A', 'B', 'B'])
    expect(session.state.campaign.partScenarios).toEqual({
      A: LANE_SCENARIO.A.id, B: LANE_SCENARIO.B.id,
    })
    expect(session.mySeat).toBe(0)
    expect(injector.view().revision).toBe(session.state.revision)

    await capture(testInfo, page, `p9.5-real-departure-parallel-${label}.png`)
    if (label === 'mobile') {
      // 移动端双线分屏在页签内容的下半段：滚到分屏再截一张，A/B 两线章名与队伍才在画面内。
      // 页面可能在截图后重渲染（大厅异步状态），座位/分屏节点会被替换：重试到滚动成功为止。
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const split = page.locator('.ah-departure-split').first()
        if (await split.count()) {
          const scrolled = await split.scrollIntoViewIfNeeded().then(() => true).catch(() => false)
          if (scrolled) break
        }
        await page.waitForTimeout(300)
      }
      await capture(testInfo, page, `p9.5-real-departure-parallel-${label}-lanes.png`)
    }
    await expectNoHorizontalOverflow(page)
    expect(injector.errors, injector.errors.join(' | ')).toEqual([])
  })
}

// ---------------------------------------------------------------------------
// 例 2：并行局内——牌桌只显示本线；切到另一线座位视图仍只显示其本线
// ---------------------------------------------------------------------------
for (const [label, width, height] of VIEWPORTS) {
  test(`P9.5 并行局内只显示本线、按座位切换另一线仍隔离（${label}）`, async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'scenario', description: LANE_SCENARIO.A.id })
    testInfo.annotations.push({ type: 'interaction', description: 'dualLineReal' })

    const world = await loadWorld()
    // 4 人 2+2 真实并行：A 线座位 0/1 →《梦境门外》，B 线座位 2/3 →《清醒噩梦》。
    // P10 起准备代打优先真实 TDE 调查员（06001–06004 分到四个座位）。
    const state = createPreparedHub(world, {
      seats: 4, mode: 'parallel', seed: `tde-p95-parallel-${label}`,
    })
    expect(state.investigators[0].code).toBe('06001')
    expect(state.investigators.every(inv => TDE_INVESTIGATOR_CODES.includes(inv.code))).toBe(true)
    const injector = await openRealTdeLobby(page, world, { state, seats: 4, seat: 0 })
    const hub = page.locator('.ah-hub')
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible({ timeout: 20_000 })
    await expect(departure.locator('.ah-departure-lane[data-lane="A"]')).toContainText(LANE_SCENARIO.A.name)

    // 开始关卡：并行由 mod 边界启动两份运行时，两线各自进入自己的第一章。
    await clickMove(page, 'hubBeginScenario', () => departure.getByRole('button', { name: '开始当前关卡' }).click())
    const facts = parallelFacts(state)
    expect(facts.A.scenarioId).toBe(LANE_SCENARIO.A.id)
    expect(facts.B.scenarioId).toBe(LANE_SCENARIO.B.id)
    // 两条线各自的行动座位（房间座位）由本局真实状态决定：A 线在 0/1、B 线在 2/3。
    const actingRoom = world.mod.actingSeats(state)
    const aActingSeat = actingRoom.find(seat => state.campaign.seatParts?.[seat] === 'A')
    const bActingSeat = actingRoom.find(seat => state.campaign.seatParts?.[seat] === 'B')
    expect([0, 1]).toContain(aActingSeat)
    expect([2, 3]).toContain(bActingSeat)

    // 局内只渲染本线牌桌，不再有出发页分屏。
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
    await expect(hub.locator('.ah-departure-split')).toHaveCount(0)
    await dismissPresentation(page)
    // A 线本线事实在场：真实章名 + 本线地点；B 线的章名/地点/调查员一律不出现（含手牌与故事
    // 所属的整条线座位：牌桌只投影本线 2 名调查员）。
    await expect(page.locator('.bg-game-title').first()).toHaveAttribute('title', new RegExp(LANE_SCENARIO.A.name))
    for (const locationName of facts.A.locationNames) {
      await expect(page.locator('body')).toContainText(locationName)
    }
    for (const text of [LANE_SCENARIO.B.name, ...facts.B.locationNames, ...facts.B.investigatorNames, ...facts.B.agendaNames]) {
      await expect(page.locator('body')).not.toContainText(text)
    }
    const viewA = await readBrowserSession(page, injector.sessionId())
    expect(viewA.mySeat).toBe(0)
    expect(viewA.state.parallel.lane).toBe('A')
    expect(viewA.state.parallel.scenarioId).toBe(LANE_SCENARIO.A.id)
    expect(viewA.state.parallel.other.lane).toBe('B')
    expect(viewA.state.scenario.id).toBe(LANE_SCENARIO.A.id)
    // 只有本线两名调查员的投影；本座位手牌可见（真实私有投影可用）。
    expect(viewA.state.investigators.map(inv => inv.seat).sort((a, b) => a - b)).toEqual([0, 1])
    expect(viewA.state.investigators.find(inv => inv.seat === 0)?.hand.length).toBeGreaterThan(0)
    // 另一线只有公开摘要：没有手牌/牌库/事件/日志/剧情/整线调查员等字段。
    const other = viewA.state.parallel.other || {}
    expect(other.lane).toBe('B')
    expect(other.scenarioId).toBe(LANE_SCENARIO.B.id)
    for (const forbidden of ['hand', 'deck', 'cards', 'tableState', 'events', 'log', 'investigators', 'story', 'scenario', 'campaignStory']) {
      expect(forbidden in other, `另一线公开摘要不应包含 ${forbidden}`).toBe(false)
    }
    expect(viewA.state.campaignStory?.entries?.every(entry => !String(entry.nodeId).includes('wakingNightmare')) ?? true).toBe(true)
    expect(viewA.actingSeats).toContain(aActingSeat)
    await capture(testInfo, page, `p9.5-real-parallel-line-a-${label}.png`)

    // 切到 B 线本回合行动座位（房间座位 2/3 之一，由真实状态决定）的观察视图：同一局、
    // 同一条会话，只换座位投影 → 只显示 B 线。
    injector.setSeat(bActingSeat)
    await page.locator('.ah-table').getByRole('button', { name: '刷新局势' }).click()
    await expect(page.locator('.bg-game-title').first()).toHaveAttribute('title', new RegExp(LANE_SCENARIO.B.name), { timeout: 20_000 })
    await dismissPresentation(page)
    for (const locationName of facts.B.locationNames) {
      await expect(page.locator('body')).toContainText(locationName)
    }
    for (const text of [LANE_SCENARIO.A.name, ...facts.A.locationNames, ...facts.A.investigatorNames, ...facts.A.agendaNames]) {
      await expect(page.locator('body')).not.toContainText(text)
    }
    const viewB = await readBrowserSession(page, injector.sessionId())
    expect(viewB.mySeat).toBe(bActingSeat)
    expect(viewB.state.parallel.lane).toBe('B')
    expect(viewB.state.parallel.scenarioId).toBe(LANE_SCENARIO.B.id)
    expect(viewB.state.parallel.other.lane).toBe('A')
    expect(viewB.state.parallel.other.scenarioId).toBe(LANE_SCENARIO.A.id)
    expect(viewB.state.scenario.id).toBe(LANE_SCENARIO.B.id)
    // 本线投影的座位类字段已换回房间座位（§11.2 门禁 7）：B 线两台座位是 2/3，行动座位是房间座位。
    expect(viewB.state.investigators.map(inv => inv.seat).sort((a, b) => a - b)).toEqual([2, 3])
    expect(viewB.actingSeats).toContain(bActingSeat)
    expect(viewB.state.legalMoves.length).toBeGreaterThan(0)
    expect(viewB.state.investigators.find(inv => inv.seat === bActingSeat)?.hand.length).toBeGreaterThan(0)
    // 浏览器里 B 线座位能看到自己的手牌（房间座位生效的标志），且牌桌仍是 B 线。
    await expect(page.locator('.ah-hand-card').first()).toBeVisible({ timeout: 10_000 })
    for (const forbidden of ['hand', 'deck', 'cards', 'tableState', 'events', 'log', 'investigators', 'story', 'scenario', 'campaignStory']) {
      expect(forbidden in (viewB.state.parallel.other || {}), `另一线公开摘要不应包含 ${forbidden}`).toBe(false)
    }
    await capture(testInfo, page, `p9.5-real-parallel-line-b-${label}.png`)

    await expectNoHorizontalOverflow(page)
    expect(injector.errors, injector.errors.join(' | ')).toEqual([])
  })
}

// ---------------------------------------------------------------------------
// 例 3：pick 3 人 2+1——默认分线 A 2 / B 1，非活动线座位 waiting、不能行动
// ---------------------------------------------------------------------------
for (const [label, width, height] of VIEWPORTS) {
  test(`P9.5 分选 3 人 2+1 座位分线与无活动线等待（${label}）`, async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'scenario', description: LANE_SCENARIO.A.id })
    testInfo.annotations.push({ type: 'interaction', description: 'dualLineReal' })

    const world = await loadWorld()
    // 真实 3 人台面：浏览器里选「分选双线」。默认分线就是 2+1（座位 1/3 → A，座位 2 → B）；
    // 2026-11-02 UI 调整移除了「开局模式」面板里的逐座位换线按钮，分线按引擎默认分配。
    const state = createHubState(world, { seats: 3, seed: `tde-p95-pick-${label}` })
    const injector = await openRealTdeLobby(page, world, { state, seats: 3, seat: 0, autoPrepare: true })
    const hub = page.locator('.ah-hub')
    const panel = modePanelOf(page)
    await expect(panel).toBeVisible()
    await clickMove(page, 'hubSetMode', () => panel.getByRole('button', { name: '分选双线', exact: true }).click())
    await expect(panel).toHaveCount(0)
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    // 关卡前投影：A 2 / B 1，逐座位归属与引擎投影一致（真实 campaign.seatParts）。
    const preparedView = await readBrowserSession(page, injector.sessionId())
    expect(preparedView.state.campaign.id).toBe(P95_CAMPAIGN_ID)
    expect(preparedView.state.campaign.mode).toBe('pick')
    expect(preparedView.state.campaign.seatParts).toEqual(['A', 'B', 'A'])
    await capture(testInfo, page, `p9.5-real-pick-seat-parts-${label}.png`)

    // 进准备页（真实 UI「选择调查员」）→ 大厅口径把三个座位准备完 → 分选的单线出发准备页。
    await clickMove(page, 'hubGoSetup', () => hub.locator('.ah-workflow-guide').getByRole('button', { name: '选择调查员' }).click())
    const departure = hub.locator('.ah-hub-pane.ah-office-departure')
    await expect(departure).toBeVisible({ timeout: 20_000 })
    await expect(departure).toContainText(LANE_SCENARIO.A.name)
    // P10 候选池：真实 hub 选人池含食梦者 5 人（同 2+2 用例的池子证据，3 人局同样可用）。
    const candidateCodes = injector.hubCandidateCodes() || []
    for (const code of TDE_INVESTIGATOR_CODES) expect(candidateCodes).toContain(code)

    // 2) 开始当前关卡：分选是单运行时 + 当前线 A，另一线座位保持 waiting。
    await clickMove(page, 'hubBeginScenario', () => departure.getByRole('button', { name: '开始当前关卡' }).click())
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
    await dismissPresentation(page)
    await expect(page.locator('.bg-game-title').first()).toHaveAttribute('title', new RegExp(LANE_SCENARIO.A.name))
    const activeView = await readBrowserSession(page, injector.sessionId())
    expect(activeView.mySeat).toBe(0)
    expect(activeView.state.campaign.seatParts).toEqual(['A', 'B', 'A'])
    expect(activeView.actingSeats).toEqual([0])
    expect(activeView.state.legalMoves.length).toBeGreaterThan(0)
    // P10 准备代打优先真实 TDE 调查员（3 个座位 = 06001/06002/06003）。
    expect(activeView.state.investigators[0].code).toBe('06001')

    // 3) 切到 B 线座位 1（非活动线）：只读 waiting——无手牌、无可行动作，真实 /api/move 被拒。
    injector.setSeat(1)
    await page.locator('.ah-table').getByRole('button', { name: '刷新局势' }).click()
    await expect(page.locator('.ah-hand-card')).toHaveCount(0, { timeout: 20_000 })
    const waitingView = await readBrowserSession(page, injector.sessionId())
    expect(waitingView.mySeat).toBe(1)
    expect(waitingView.actingSeats).not.toContain(1)
    expect(waitingView.state.legalMoves).toEqual([])
    expect(waitingView.state.investigators.every(inv => (inv.hand || []).length === 0)).toBe(true)
    await expect(page.locator('.bg-game-status')).toContainText('等待')
    // 浏览器里以该座位提交动作：走真实 /api/move → mod.validateMove 明确拒绝（另一条线）。
    const rejected = await page.evaluate(async sessionId => {
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, seat: 1, move: { action: 'investigate' } }),
      })
      return response.json()
    }, injector.sessionId())
    expect(rejected.ok).toBe(false)
    expect(String(rejected.error)).toContain('另一条线')
    await capture(testInfo, page, `p9.5-real-pick-waiting-${label}.png`)

    await expectNoHorizontalOverflow(page)
    expect(injector.errors, injector.errors.join(' | ')).toEqual([])
  })
}
