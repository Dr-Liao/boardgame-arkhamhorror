// 八循环《绯红密钥》（The Scarlet Keys）P8 发布门禁浏览器证据（桌面 1440×900 / 移动 390×844）。
//
// 一个 spec 文件、3 个发布门禁用例 × 2 视口 = 6 行，全部走真实大厅 / 真实 HTTP / 真实 web 界面：
//
//   phase=release      真实大厅启动绯红密钥（/api/catalog：theScarletKeys、earlyAccess=false、
//                      10 个真实章名）→ 2 席、09001 真实准备（选择调查员 / 自动构筑 / 确认，
//                      AI 席位由服务端同一 autoHubMove 路径准备）→ 序幕 + 首章 riddlesAndRain
//                      真实牌桌（手牌/地点/一次真实合法动作）→ 关卡设置指南面板 →
//                      世界地图启程面板（真实目的地图投影 + 候选按钮）→ 启程 deadHeat → 牌桌。
//   phase=progression  host-only /api/debug「结束这关」作跨章加速（真实 finishScenario/结局/XP/记录，
//                      在 annotation debugJump 显式披露）→ 真实局外页 hubContinue → 幕间 I →
//                      世界地图相位 → 选目的地（deadHeat / Marrakesh）→ 真实出发准备/牌桌/指南 →
//                      再结算 → 回到地图（时间/位置增长）→ 第二目的地 dealingsInTheDark →
//                      再结算 → 第三次回到地图，验证启程循环可重复。
//   phase=online       中转服务 + 两个真实大厅实例、两名真人（09001 / 09004）各自准备/开局；
//                      隐私：对方座位手牌为空、未揭露隐匿迷你卡无真身字段、页面只看自己的手牌；
//                      权限：非房主（座位 1）不能提交 hubBeginScenario / hubContinue / hubEmbark；
//                      断线恢复：关闭客人页面重开同一大厅，回到同一战役会话并可继续。
//
// 真实口径：不 page.route 改写 /api/start、/api/session、/api/move；不写 session.state；
// 章内不做夹具。跨章加速只用 host-only POST /api/debug（单机调试控制台，仍走 debugCommand 解析 +
// 正常事务提交），并在每个用例的 debugJump annotation 与 artifacts/migration/tsk/reports/
// p8-browser-report.md 里披露。
//
// 证据账本：audit/tsk-release-browser.json（tools/playwright-tsk-p8-reporter.mjs）。
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { contentRegistry } from '../content/registered.js'
import { createRelay } from '../../../relay/server.js'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import {
  TSK_CAMPAIGN, TSK_NAME, TSK_CHAPTERS, FIRST_CHAPTER, investigatorName,
  openTskLobby, startTskGame, chooseScenarioThroughUi, prepareSeatThroughUi, beginCurrentChapter,
  waitForPlayableTable, fetchSession, submitMove, submitDebug, settleUi,
  syncUiToState, hubTab, clickSettled, dismissPresentation, assertChapterGuide,
  shot, annotate, SHOT_DIR,
} from './tsk-browser-helpers.mjs'

const RELEASE_TIMEOUT = 480_000
const PROGRESSION_TIMEOUT = 480_000
const ONLINE_TIMEOUT = 480_000
const HOST_CODE = '09001'
const GUEST_CODE = '09004'
const DEAD_HEAT = TSK_CHAPTERS.find(chapter => chapter.id === 'deadHeat')
const DEALINGS = TSK_CHAPTERS.find(chapter => chapter.id === 'dealingsInTheDark')
const DEAD_HEAT_NODE = DEAD_HEAT.mapLocationId
const DEALINGS_NODE = DEALINGS.mapLocationId

function tskLaunchable() {
  try {
    contentRegistry.assertLaunchable(TSK_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 失败现场：截图 + 当前界面快照写入 annotation（只失败时；联机用例自建 context/page，单独收集错误）。 */
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  if (/联机/.test(testInfo.title)) return
  const viewport = /mobile/.test(testInfo.title) ? 'mobile' : 'desktop'
  const phase = /逐章/.test(testInfo.title) ? 'progression' : 'release'
  const path = `${SHOT_DIR}p8-${phase}-${viewport}-failure.png`
  await page.screenshot({ path, fullPage: true, animations: 'disabled' }).catch(() => {})
  testInfo.annotations.push({ type: 'screenshot', description: path })
  const snapshot = await page.evaluate(() => ({
    hub: document.querySelector('.ah-hub')?.getAttribute('data-ui-state') || null,
    table: Boolean(document.querySelector('.ah-table')),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
    workflow: [...document.querySelectorAll('.ah-workflow-next button')].map(node => (node.textContent || '').slice(0, 40)).slice(0, 4),
    mapPanel: Boolean(document.querySelector('[data-hub-map], .ah-hub-map, .ah-tsk-map')),
    embarkButtons: [...document.querySelectorAll('button')].map(node => (node.textContent || '').trim())
      .filter(text => /启程/.test(text)).slice(0, 6),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  })).catch(error => ({ error: String(error) }))
  testInfo.annotations.push({ type: 'failure', description: JSON.stringify(snapshot) })
})

// ---------------------------------------------------------------------------
// 真实会话读取 / 待决选择 / 界面同步
// ---------------------------------------------------------------------------

/** 真实 /api/session（按浏览器座位投影）→ sessionView；state 在 .state。 */
async function view(page, sessionId) {
  const session = await fetchSession(page, sessionId)
  expect(session, '真实 /api/session 必须返回会话').toBeTruthy()
  return session
}

/** 用真实 /api/move choose 结算全部待决选择（战役分支可选择偏好，默认 done/skip/self/第一项）。 */
async function drainChoices(page, sessionId, { max = 48, prefer = null } = {}) {
  let session = await view(page, sessionId)
  for (let guard = 0; guard < max; guard++) {
    const choice = session.state.pendingChoice
    if (!choice) return session
    const ids = (choice.options || []).map(option => String(option.id))
    const preferred = typeof prefer === 'function' ? prefer(session, choice) : null
    const pick = preferred && ids.includes(String(preferred))
      ? String(preferred)
      : ['done', 'skip', 'self', 'keep'].find(id => ids.includes(id)) || ids[0]
    const move = (session.state.legalMoves || [])
      .find(item => item.action === 'choose' && String(item.optionId) === pick)
      || { action: 'choose', choiceId: choice.id, optionId: pick }
    const result = await submitMove(page, sessionId, session.state.revision, move)
    expect(result.payload.ok, `${choice.kind}:${result.payload.error}`).toBe(true)
    session = result.payload.session
  }
  return session
}

/** 点局外页「刷新 / 刷新局势」把真实会话同步回界面。 */
async function refreshUi(page) {
  const refresh = page.getByRole('button', { name: '刷新', exact: true })
  const refreshSituation = page.getByRole('button', { name: '刷新局势' })
  if (await refresh.count()) await refresh.first().click().catch(() => {})
  else if (await refreshSituation.count()) await refreshSituation.first().click().catch(() => {})
  await page.waitForTimeout(350)
}

/** 局外页工作流主按钮会提交的动作（与 web/hub.js#workflowGuide 的真实分支一一对应）。 */
function primaryActionFor(state) {
  const has = action => (state.legalMoves || []).some(move => move.action === action && !move.disabled)
  if (state.uiState === 'scenarioResult' && has('hubContinue')) return 'hubContinue'
  if (state.uiState === 'interlude') {
    if (has('hubConfirmUpgrades')) return 'hubConfirmUpgrades'
    if (has('hubDoneSeat')) return 'hubDoneSeat'
  }
  if (state.uiState === 'scenarioSetup') {
    if (has('hubBeginScenario')) return 'hubBeginScenario'
    if (has('hubDoneSeat')) return 'hubDoneSeat'
  }
  return null
}

/** 在局外页点「战役总览」页签的工作流主按钮；只在它会提交 expectedAction 时才点。 */
async function clickHubPrimary(page, hub, sessionId, expectedAction, label) {
  let session = await drainChoices(page, sessionId)
  const action = primaryActionFor(session.state)
  expect(action, `局外页没有可提交的 ${expectedAction}（uiState=${session.state.uiState}，`
    + `legal=${JSON.stringify((session.state.legalMoves || []).map(move => move.action).slice(0, 20))}）`).toBe(expectedAction)
  await hubTab(hub, '战役总览').catch(() => {})
  await settleUi(page)
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 60_000 })
  await clickSettled(page, primary, label || expectedAction)
  const body = await (await responded).json()
  expect(body.ok, body.error).toBe(true)
  const posted = (await responded).request().postDataJSON()?.move?.action
  if (posted) expect(posted, `真实主按钮提交的动作（期望 ${expectedAction}）`).toBe(expectedAction)
  return body.session
}

/** 局外页「战役选择」待决面板若可见就截图（真实 UI 证据），随后由 drainChoices 走真实 /api/move。 */
async function shotHubChoiceIfVisible(page, hub, testInfo, name) {
  const dialog = hub.locator('[role="dialog"][aria-label="战役选择"]')
  if (await dialog.count() && await dialog.first().isVisible().catch(() => false)) {
    await shot(page, testInfo, name)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 世界地图：真实投影 + 启程面板 + 候选按钮
// ---------------------------------------------------------------------------

/** 世界地图公开投影（真实观察字段：state.mechanics.tsk.map；含 destinations/canEmbark/phase）。 */
function mapProjection(session) {
  return session?.state?.mechanics?.tsk?.map || null
}

/** 当前会话里合法的 hubEmbark 候选（普通启程优先；快捷旅票 expedite=true 单列）。 */
function embarkMoves(session) {
  return (session?.state?.legalMoves || []).filter(move => move.action === 'hubEmbark')
}

function embarkMoveTo(session, destination) {
  return embarkMoves(session).find(move => move.destination === destination && move.expedite !== true)
    || embarkMoves(session).find(move => move.destination === destination)
    || null
}

function destinationName(session, destination) {
  return mapProjection(session)?.destinations?.find(item => item.destination === destination)?.name || destination
}

/**
 * 世界地图启程面板定位（真实 UI）。候选渲染由 web/hub.js 决定：
 *   1) 面板容器 [data-hub-map] / .ah-hub-map / aria-label 世界地图启程；
 *   2) 通用「启程：…」候选按钮（label 来自真实 legalMoves）；
 *   3) 局外页里单个目的地的 data 属性按钮。
 * 返回 { kind, locator, count, text, texts }；面板不存在返回 null（由调用方给出可诊断失败）。
 */
async function findEmbarkPanel(page, hub) {
  for (const selector of ['[data-hub-world-map]', '.ah-hub-world-map', '[data-hub-map]', '[data-tsk-hub-map]',
    '.ah-hub-map', '.ah-hub-embark', '[aria-label="世界地图启程"]', '[aria-label="世界地图"]']) {
    const locator = hub.locator(selector).first()
    if (await locator.count() && await locator.isVisible().catch(() => false)) {
      return { kind: 'panel', selector, locator, count: 1, text: (await locator.innerText().catch(() => '')).trim() }
    }
  }
  const buttons = hub.getByRole('button', { name: /启程/ })
  if (await buttons.count()) {
    const first = buttons.first()
    if (await first.isVisible().catch(() => false)) {
      const texts = (await buttons.allTextContents()).map(text => text.trim()).filter(Boolean)
      return { kind: 'buttons', selector: 'button[启程]', locator: first, count: texts.length, text: texts.join(' | '), texts }
    }
  }
  const linked = hub.locator('[data-hub-embark], [data-embark-destination], [data-map-destination]').first()
  if (await linked.count() && await linked.isVisible().catch(() => false)) {
    return { kind: 'data', selector: 'data-hub-embark', locator: linked, count: 1, text: (await linked.innerText().catch(() => '')).trim() }
  }
  return null
}

/** 断言世界地图面板存在并列出可达目的地；返回 { map, panel, destinationNames }。 */
async function assertWorldMapPanel(page, hub, session, testInfo, name) {
  const map = mapProjection(session)
  expect(map, '世界地图公开投影（state.mechanics.tsk.map）').toBeTruthy()
  expect(map.canEmbark, `世界地图相位（canEmbark；current=${map.current} time=${map.time}）`).toBe(true)
  expect(Array.isArray(map.destinations), '地图目的地投影').toBe(true)
  expect(map.destinations.length, '地图目的地数量').toBeGreaterThanOrEqual(10)
  for (const destination of map.destinations) {
    expect(typeof destination.destination).toBe('string')
    expect(typeof destination.name).toBe('string')
    expect(Number.isFinite(destination.cost)).toBe(true)
    expect(typeof destination.unlocked).toBe('boolean')
  }
  const panel = await findEmbarkPanel(page, hub)
  expect(panel, '世界地图启程面板必须真实渲染（[data-hub-map]/「启程：…」候选按钮）；'
    + `当前局外页按钮=${JSON.stringify((await hub.getByRole('button').allTextContents()).slice(0, 30))}`).toBeTruthy()
  if (panel.kind === 'buttons') {
    expect(panel.count, '启程候选按钮数量').toBeGreaterThanOrEqual(3)
    const names = map.destinations.map(item => item.name).filter(Boolean)
    const listed = names.filter(nameText => panel.text.includes(nameText))
    expect(listed.length, `面板必须列出可达目的地名（实际按钮=${panel.text.slice(0, 200)}）`).toBeGreaterThanOrEqual(2)
  } else {
    // 面板容器：正文必须出现「当前位置（地图节点展示名）」与至少两个目的地名，并渲染 ≥3 个候选按钮。
    const names = map.destinations.map(item => item.name).filter(Boolean)
    const listed = names.filter(nameText => panel.text.includes(nameText))
    expect(listed.length, `世界地图面板正文=${panel.text.slice(0, 200)}`).toBeGreaterThanOrEqual(2)
    const currentName = map.destinations.find(item => item.destination === map.current)?.name || map.current
    expect(panel.text, `世界地图面板必须显示当前位置 ${currentName}`).toContain(currentName)
    const destinationButtons = panel.locator.locator('button')
    expect(await destinationButtons.count(), '启程面板内的候选按钮数量').toBeGreaterThanOrEqual(3)
  }
  await shot(page, testInfo, name)
  return { map, panel, destinationNames: map.destinations.map(item => item.name).filter(Boolean) }
}

/** 点击真实启程候选按钮（优先进出口的真实 label，其次 data 属性 / 目的地名）。 */
async function clickEmbark(page, hub, session, move, label) {
  const name = destinationName(session, move.destination)
  const candidates = []
  candidates.push(hub.getByRole('button', { name: move.label, exact: true }).first())
  for (const selector of [
    `[data-hub-embark="${move.destination}"]`,
    `[data-embark-destination="${move.destination}"]`,
    `[data-map-destination="${move.destination}"]`,
  ]) candidates.push(hub.locator(selector).first())
  candidates.push(hub.getByRole('button', { name: new RegExp(`启程[：:]?.*${escapeRegExp(name)}`) }).first())
  candidates.push(hub.getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first())
  let target = null
  for (const candidate of candidates) {
    if (await candidate.count() && await candidate.isEnabled().catch(() => false)) { target = candidate; break }
  }
  expect(target, `世界地图启程按钮（destination=${move.destination} name=${name} label=${move.label}）；`
    + `当前局外页按钮=${JSON.stringify((await hub.getByRole('button').allTextContents()).slice(0, 30))}`).toBeTruthy()
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubEmbark', { timeout: 60_000 })
  await clickSettled(page, target, label || `启程 ${name}`)
  const body = await (await responded).json()
  expect(body.ok, body.error).toBe(true)
  return body.session
}

/**
 * 从结算页 / 幕间 / 章节准备推进到「世界地图相位」：
 *   scenarioResult → 真实 hubContinue；幕间 → 真实 hubDoneSeat（必要时真实 /api/move choose 分支）；
 *   直到 state.mechanics.tsk.map.canEmbark === true 且 legalMoves 有 hubEmbark。
 * 界面同步与面板截图由调用方完成。返回最新 sessionView。
 */
async function advanceToWorldMap(page, hub, sessionId, { label = '世界地图', testInfo = null, choiceShot = null } = {}) {
  let last = null
  for (let guard = 0; guard < 80; guard++) {
    const session = await drainChoices(page, sessionId)
    last = session
    const map = mapProjection(session)
    if (map?.canEmbark && embarkMoves(session).length) {
      await refreshUi(page)
      const synced = await view(page, sessionId)
      if (mapProjection(synced)?.canEmbark) return synced
    }
    const action = primaryActionFor(session.state)
    if (action === 'hubContinue') {
      await clickHubPrimary(page, hub, sessionId, 'hubContinue', `${label}：查看结算并进入关间准备`)
      await settleUi(page)
      continue
    }
    if (action === 'hubDoneSeat' || action === 'hubConfirmUpgrades') {
      await clickHubPrimary(page, hub, sessionId, action, `${label}：完成关间准备`)
      await settleUi(page)
      if (testInfo && choiceShot) await shotHubChoiceIfVisible(page, hub, testInfo, choiceShot).catch(() => {})
      continue
    }
    // 地图窗口但投影未就绪 / 界面尚未同步：刷新后重试。
    await refreshUi(page)
    await page.waitForTimeout(450)
  }
  throw new Error(`未到达世界地图相位：${JSON.stringify({
    uiState: last?.state?.uiState, flowNode: last?.state?.campaign?.flow?.nodeId,
    canEmbark: mapProjection(last)?.canEmbark ?? null,
    legal: (last?.state?.legalMoves || []).map(move => move.action).slice(0, 20),
    time: last?.state?.campaign?.records?.time,
  })}`)
}

/** 真实调试通道结束当前关卡（host-only /api/debug，引擎完整走 finishScenario/结局/XP/记录）。 */
async function finishScenarioThroughDebug(page, hub, sessionId, expectedChapterId) {
  let session = await view(page, sessionId)
  expect(session.state.uiState).toBe('inScenario')
  expect(session.state.scenario.id).toBe(expectedChapterId)
  const before = session.state.campaign.scenarioResults.length
  const ended = await submitDebug(page, sessionId, session.state.revision, '结束这关')
  expect(ended.payload.ok, ended.payload.error).toBe(true)
  session = await drainChoices(page, sessionId)
  expect(session.state.uiState).toBe('scenarioResult')
  expect(session.state.campaign.scenarioResults.length).toBe(before + 1)
  expect(session.state.campaign.scenarioResults.at(-1).scenarioId).toBe(expectedChapterId)
  await dismissPresentation(page)
  await syncUiToState(page, 'scenarioResult')
  await expect(hub).toHaveAttribute('data-ui-state', 'scenarioResult', { timeout: 30_000 })
  return session
}

/** 出发准备页：确认本座位准备（真实 hubDoneSeat），随后由 beginCurrentChapter 真实开始关卡。 */
async function confirmSeat(page, hub, sessionId, label) {
  let session = await view(page, sessionId)
  if (session.state.hubReady) return session
  expect(primaryActionFor(session.state), `${label} 的出发准备应可确认席位`).toBe('hubDoneSeat')
  await clickHubPrimary(page, hub, sessionId, 'hubDoneSeat', `${label}：确认准备`)
  session = await view(page, sessionId)
  expect(session.state.hubReady, `${label} 全桌准备完成`).toBe(true)
  return session
}

async function assertNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
}

// ---------------------------------------------------------------------------
// spec 1（release）：真实大厅发布门禁 → 首章 → 世界地图启程 deadHeat
// ---------------------------------------------------------------------------
for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P8 ${label} 发布：真实大厅启动绯红密钥战役、世界地图启程与首章`, async ({ page }, testInfo) => {
    test.skip(!tskLaunchable(), 'theScarletKeys 尚未在 content/registered.js 注册为可启动战役')
    testInfo.setTimeout(RELEASE_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'release')
    annotate(testInfo, 'scenario', FIRST_CHAPTER.id)
    annotate(testInfo, 'debugJump',
      'POST /api/debug（host-only，真实 debugCommand + 事务提交）「结束这关」：把首章推进到真实关末结算，'
      + '以便在世界地图相位验证启程面板/候选按钮并真实启程 deadHeat；章内动作仍全部经由真实 /api/move 与 UI。')

    const pageErrors = []
    const consoleErrors = []
    const missingResources = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('response', response => {
      if (response.status() === 404) missingResources.push(response.url())
    })

    // a. 真实大厅：启动页 → 调查准备设置 → 战役下拉。
    const setup = await openTskLobby(page)
    await shot(page, testInfo, `p8-release-lobby-${label}`)

    // b. 真实 POST /api/start：绯红密钥、2 席 → 真实局外页 campaignHub。
    const { session, hub } = await startTskGame(page, setup, { seats: 2 })
    const sessionId = session.sessionId
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
    await expect(page.locator('.bg-game-title').first()).toContainText(TSK_NAME)

    // c. catalog 事实：theScarletKeys / status=playable / earlyAccess=false / 10 个真实章名。
    const catalog = await page.evaluate(async () => {
      const response = await fetch('/api/catalog')
      const payload = await response.json()
      const game = (payload.games || []).find(item => item.id === 'arkhamhorror')
      const campaign = (game?.clientData?.campaigns || []).find(item => item.id === 'theScarletKeys')
      return {
        campaignIds: (game?.clientData?.campaigns || []).map(item => item.id),
        status: campaign?.status || null,
        earlyAccess: campaign?.earlyAccess ?? null,
        scenarios: (campaign?.scenarios || []).map(item => ({ id: item.id, name: item.name })),
      }
    })
    expect(catalog.campaignIds).toContain(TSK_CAMPAIGN)
    expect(catalog.status).toBe('playable')
    expect(catalog.earlyAccess).toBe(false)
    expect(catalog.scenarios.map(item => item.id)).toEqual(TSK_CHAPTERS.map(chapter => chapter.id))
    for (const [index, chapter] of TSK_CHAPTERS.entries()) {
      expect(catalog.scenarios[index].name, `${chapter.id} 的真实章名`).toContain(chapter.name)
    }
    await shot(page, testInfo, `p8-release-hub-${label}`)

    // d. 真实局外页：关卡选择 10 张真实章节卡 → 选择第一章（真实 hubSelectScenario）。
    await hubTab(hub, '关卡选择')
    await expect(hub.locator('.ah-office-case')).toHaveCount(TSK_CHAPTERS.length)
    for (const chapter of TSK_CHAPTERS) await expect(hub.locator('.ah-office-cases')).toContainText(chapter.name.split(' ')[0])
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })

    // e. 真实准备：09001 选择调查员 / 自动构筑 / 确认准备（AI 席位同请求 autoHubMove 准备）。
    const prepared = await prepareSeatThroughUi(page, hub, { code: HOST_CODE })
    expect(prepared.state.investigators[0].code).toBe(HOST_CODE)
    expect(prepared.state.investigators.length).toBe(2)
    expect(prepared.state.hubReady).toBe(true)
    const aiInvestigator = prepared.state.investigators[1]
    expect(aiInvestigator, 'AI 席位必须有真实调查员').toBeTruthy()
    annotate(testInfo, 'evidence',
      `大厅准备：座位 0=${HOST_CODE} ${investigatorName(HOST_CODE)}；`
      + `座位 1（AI）=${aiInvestigator.code} ${aiInvestigator.name}；hubReady=${prepared.state.hubReady}`)
    await shot(page, testInfo, `p8-release-prepared-${label}`)

    // f. 序幕 + 首章 riddlesAndRain：真实 hubBeginScenario → 牌桌。
    const { session: playing } = await beginCurrentChapter(page, hub, {
      chapterName: FIRST_CHAPTER.name,
      beforeBegin: async departure => {
        expect(await departure.locator('.ah-departure-member').count()).toBe(2)
        await shot(page, testInfo, `p8-release-departure-${label}`)
      },
    })
    expect(playing.state.scenario.id).toBe(FIRST_CHAPTER.id)
    await waitForPlayableTable(page)
    let current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.scenario.id).toBe(FIRST_CHAPTER.id)
    expect(current.state.investigators[0].code).toBe(HOST_CODE)
    expect(current.state.investigators[0].hand.length).toBeGreaterThan(0)
    expect((current.state.locations || []).length).toBeGreaterThan(0)
    // 序幕初始化真实世界地图（London / 时间 0 / 26 个初始解锁）——不是注入。
    const prologueMap = mapProjection(current)
    expect(prologueMap, '序幕必须初始化世界地图').toBeTruthy()
    expect(prologueMap.current).toBe('London')
    expect(prologueMap.time).toBe(0)
    expect(prologueMap.unlocked.length).toBeGreaterThanOrEqual(26)
    await expect(page.locator('.ah-table')).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name.split(' ')[0])
    await expect(page.locator('.ah-departure-split')).toHaveCount(0)
    await shot(page, testInfo, `p8-release-table-${label}`)

    // g. 一条真实合法动作（资源/抽牌这类不打开选择窗口的标准动作）→ revision 前进。
    const playable = (current.state.legalMoves || []).find(move => move.action === 'resource' || move.action === 'draw')
    expect(playable, '局内应有可提交的真实标准动作').toBeTruthy()
    const acted = await submitMove(page, sessionId, current.state.revision, playable)
    expect(acted.payload.ok, acted.payload.error).toBe(true)
    expect(acted.payload.session.state.revision).toBe(current.state.revision + 1)
    await waitForPlayableTable(page)
    current = await view(page, sessionId)
    expect(current.state.revision).toBeGreaterThan(playing.state.revision)
    // 牌桌的世界地图机制摘要（真实 UI）：展开 details 后显示当前地点/时间；目的地投影已在 facts 里。
    const summary = page.locator('.ah-mechanic-summary summary').first()
    if (await summary.count()) await summary.click().catch(() => {})
    await expect(page.locator('.ah-tsk-map')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.ah-tsk-map [data-tsk-map-current]')).toHaveAttribute('data-tsk-map-current', 'London')
    await shot(page, testInfo, `p8-release-table-after-move-${label}`)

    // h. 关卡设置指南（真实 UI）：分区 / 折叠剧透 / 中文正文 / 焦点恢复。
    await assertChapterGuide(page, testInfo, label, FIRST_CHAPTER, { annotateScenario: false })

    // i. 关末结算（真实 finishScenario）→ 世界地图相位。
    current = await finishScenarioThroughDebug(page, hub, sessionId, FIRST_CHAPTER.id)
    await shot(page, testInfo, `p8-release-result-${label}`)
    current = await advanceToWorldMap(page, hub, sessionId, {
      label: '发布：世界地图', testInfo, choiceShot: `p8-release-interlude-choice-${label}`,
    })
    const deadHeatMove = embarkMoveTo(current, DEAD_HEAT_NODE)
    expect(deadHeatMove, `世界地图必须给出 deadHeat 目的地 ${DEAD_HEAT_NODE} 的启程候选；`
      + `实际=${JSON.stringify(embarkMoves(current).slice(0, 8))}`).toBeTruthy()
    const mapEvidence = await assertWorldMapPanel(page, hub, current, testInfo, `p8-release-worldmap-${label}`)
    annotate(testInfo, 'evidence',
      `世界地图（发布）：current=${mapEvidence.map.current} time=${mapEvidence.map.time} `
      + `destinations=${mapEvidence.map.destinations.length}；deadHeat 目的地 ${DEAD_HEAT_NODE} cost=${deadHeatMove.cost}`)
    await expect(hub).toHaveAttribute('data-ui-state', 'interlude')

    // j. 真实启程 deadHeat（Marrakesh）→ 时间 +1 → 下一章出发准备（真实 hubEmbark + progressCampaign）。
    const embarked = await clickEmbark(page, hub, current, deadHeatMove, `发布：启程 ${DEAD_HEAT.name}`)
    expect(embarked.state.uiState).toBe('scenarioSetup')
    expect(embarked.state.campaign.flow?.nodeId).toBe(DEAD_HEAT.id)
    expect(embarked.state.hubSelectedScenarioId).toBe(DEAD_HEAT.id)
    const afterMap = mapProjection(embarked)
    expect(afterMap.current).toBe(DEAD_HEAT_NODE)
    // 章节结局本身会按真实规则记时间（谜雨结局 +1/+2），所以以启程前地图时间为基准。
    expect(afterMap.time).toBe(mapEvidence.map.time + deadHeatMove.cost)
    expect(embarked.state.campaign.records.currentLocation).toBe(DEAD_HEAT_NODE)
    await refreshUi(page)
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioSetup', { timeout: 30_000 })
    await shot(page, testInfo, `p8-release-embarked-${label}`)

    // k. 出发准备显示 deadHeat → 真实开始 → deadHeat 牌桌（启程结果落到真实任务链）。
    await confirmSeat(page, hub, sessionId, '发布：deadHeat 出发准备')
    const second = await beginCurrentChapter(page, hub, { chapterName: DEAD_HEAT.name })
    expect(second.session.state.scenario.id).toBe(DEAD_HEAT.id)
    await waitForPlayableTable(page)
    current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.scenario.id).toBe(DEAD_HEAT.id)
    await expect(page.locator('.bg-game-title').first()).toContainText(DEAD_HEAT.name.split(' ')[0])
    await shot(page, testInfo, `p8-release-deadheat-table-${label}`)
    annotate(testInfo, 'scenario', DEAD_HEAT.id)

    // l. 无脚本错误、无横向溢出（1px 容差）；控制台 error / 404 资源只登记为证据（不隐藏）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    await assertNoHorizontalOverflow(page)
    if (consoleErrors.length || missingResources.length) {
      // 只记路径与查询串：账本里不出现本次运行的本机 origin/端口（可复现性）。
      const displayResource = url => {
        try {
          const parsed = new URL(url)
          return parsed.pathname + parsed.search
        } catch {
          return String(url)
        }
      }
      annotate(testInfo, 'evidence',
        `控制台 error ${consoleErrors.length} 条；404 资源 ${missingResources.length} 个：`
        + JSON.stringify([...new Set(missingResources)].slice(0, 8).map(displayResource)))
    }
  })
}

// ---------------------------------------------------------------------------
// spec 2（progression）：关末结算 → 世界地图选目的地 → 下一章 → 再回地图（循环可重复）
// ---------------------------------------------------------------------------
for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P8 ${label} 逐章推进：真实关末结算 → 世界地图选目的地 → 下一章`, async ({ page }, testInfo) => {
    test.skip(!tskLaunchable(), 'theScarletKeys 尚未在 content/registered.js 注册为可启动战役')
    testInfo.setTimeout(PROGRESSION_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'progression')
    annotate(testInfo, 'scenario', DEAD_HEAT.id)
    annotate(testInfo, 'debugJump',
      'POST /api/debug（host-only，真实 debugCommand + 事务提交）「结束这关」三次：'
      + 'riddlesAndRain / deadHeat / dealingsInTheDark 的关末结算。跨章加速原语，章内夹具为 0；'
      + '每次结算后仍由真实 /api/move + 真实局外页按钮推进。')

    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    // a. 真实大厅 → 首章牌桌（与发布门禁同一真实路径）。
    const setup = await openTskLobby(page)
    const { session, hub } = await startTskGame(page, setup, { seats: 2 })
    const sessionId = session.sessionId
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })
    await prepareSeatThroughUi(page, hub, { code: HOST_CODE })
    const first = await beginCurrentChapter(page, hub, { chapterName: FIRST_CHAPTER.name })
    expect(first.session.state.scenario.id).toBe(FIRST_CHAPTER.id)
    await waitForPlayableTable(page)
    let current = await view(page, sessionId)
    expect(current.state.campaign.scenarioResults.length).toBe(0)
    expect(mapProjection(current)?.current).toBe('London')
    await shot(page, testInfo, `p8-progression-riddlesAndRain-table-${label}`)

    // b. 真实关末结算（调试加速，已披露）→ 真实结算页。
    current = await finishScenarioThroughDebug(page, hub, sessionId, FIRST_CHAPTER.id)
    await shot(page, testInfo, `p8-progression-result-${label}`)

    // c. 真实 hubContinue → 幕间 I → 世界地图（真实幕间准备/分支选择）。
    current = await advanceToWorldMap(page, hub, sessionId, {
      label: '逐章：第一段世界地图', testInfo, choiceShot: `p8-progression-interlude-choice-${label}`,
    })
    const firstMap = mapProjection(current)
    expect(firstMap.current).toBe('London')
    // 真实章节结局会推进时间（谜雨结局 +1/+2）；这里断言地图与战役记录口径一致、时间非负。
    expect(firstMap.time).toBeGreaterThanOrEqual(0)
    expect(current.state.campaign.records.time).toBe(firstMap.time)
    annotate(testInfo, 'evidence', `首章结算后世界地图：current=${firstMap.current} time=${firstMap.time}`)
    const firstMove = embarkMoveTo(current, DEAD_HEAT_NODE)
    expect(firstMove, '第一段世界地图应出现 deadHeat 目的地候选').toBeTruthy()
    await assertWorldMapPanel(page, hub, current, testInfo, `p8-progression-worldmap1-${label}`)
    await expect(hub).toHaveAttribute('data-ui-state', 'interlude')

    // d. 世界地图选目的地 deadHeat（真实 hubEmbark）→ 时间 +1 → 出发准备。
    current = await clickEmbark(page, hub, current, firstMove, `逐章：启程 ${DEAD_HEAT_NODE}`)
    expect(current.state.uiState).toBe('scenarioSetup')
    expect(current.state.campaign.flow?.nodeId).toBe(DEAD_HEAT.id)
    expect(current.state.hubSelectedScenarioId).toBe(DEAD_HEAT.id)
    expect(mapProjection(current).current).toBe(DEAD_HEAT_NODE)
    expect(mapProjection(current).time).toBe(firstMap.time + firstMove.cost)
    await refreshUi(page)
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioSetup', { timeout: 30_000 })
    await shot(page, testInfo, `p8-progression-deadHeat-departure-${label}`)

    // e. 真实开始 deadHeat：牌桌 + 时间增加 + 指南面板可见。
    await confirmSeat(page, hub, sessionId, '逐章：deadHeat 出发准备')
    const second = await beginCurrentChapter(page, hub, { chapterName: DEAD_HEAT.name })
    expect(second.session.state.scenario.id).toBe(DEAD_HEAT.id)
    await waitForPlayableTable(page)
    current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.campaign.flow?.nodeId).toBe(DEAD_HEAT.id)
    expect(current.state.campaign.scenarioIndex).toBe(TSK_CHAPTERS.findIndex(chapter => chapter.id === DEAD_HEAT.id))
    await expect(page.locator('.bg-game-title').first()).toContainText(DEAD_HEAT.name.split(' ')[0])
    await assertChapterGuide(page, testInfo, label, DEAD_HEAT)
    await shot(page, testInfo, `p8-progression-deadHeat-table-${label}`)
    annotate(testInfo, 'evidence',
      `deadHeat 牌桌：time=${mapProjection(current)?.time} current=${mapProjection(current)?.current} `
      + `hand=${current.state.investigators[0].hand.length} locations=${current.state.locations.length}`)

    // f. 再结算 → 回到世界地图（同一循环第二次），时间/位置保持增长。
    current = await finishScenarioThroughDebug(page, hub, sessionId, DEAD_HEAT.id)
    current = await advanceToWorldMap(page, hub, sessionId, { label: '逐章：第二段世界地图' })
    const secondMap = mapProjection(current)
    expect(secondMap.current).toBe(DEAD_HEAT_NODE)
    // deadHeat 结局本身也会按规则记时间：只断言不倒退 + 战役记录与地图口径一致。
    expect(secondMap.time).toBeGreaterThanOrEqual(firstMap.time + firstMove.cost)
    expect(current.state.campaign.records.time).toBe(secondMap.time)
    const secondMove = embarkMoveTo(current, DEALINGS_NODE)
    expect(secondMove, `第二段世界地图应出现 dealingsInTheDark 目的地 ${DEALINGS_NODE} 候选；`
      + `实际=${JSON.stringify(embarkMoves(current).slice(0, 6))}`).toBeTruthy()
    await assertWorldMapPanel(page, hub, current, testInfo, `p8-progression-worldmap2-${label}`)

    // g. 第二目的地 dealingsInTheDark（真实 hubEmbark）→ 时间继续增加 → 牌桌/指南。
    current = await clickEmbark(page, hub, current, secondMove, `逐章：启程 ${DEALINGS_NODE}`)
    expect(current.state.uiState).toBe('scenarioSetup')
    expect(current.state.campaign.flow?.nodeId).toBe(DEALINGS.id)
    expect(current.state.hubSelectedScenarioId).toBe(DEALINGS.id)
    expect(mapProjection(current).current).toBe(DEALINGS_NODE)
    expect(mapProjection(current).time).toBe(secondMap.time + secondMove.cost)
    await refreshUi(page)
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioSetup', { timeout: 30_000 })
    await shot(page, testInfo, `p8-progression-dealingsInTheDark-departure-${label}`)
    await confirmSeat(page, hub, sessionId, '逐章：dealingsInTheDark 出发准备')
    const third = await beginCurrentChapter(page, hub, { chapterName: DEALINGS.name })
    expect(third.session.state.scenario.id).toBe(DEALINGS.id)
    await waitForPlayableTable(page)
    current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    await expect(page.locator('.bg-game-title').first()).toContainText(DEALINGS.name.split(' ')[0])
    await assertChapterGuide(page, testInfo, label, DEALINGS)
    await shot(page, testInfo, `p8-progression-dealingsInTheDark-table-${label}`)
    annotate(testInfo, 'scenario', DEALINGS.id)

    // h. 第三次回到世界地图：证明启程循环可重复（真实状态里已访问两处、时间累加）。
    current = await finishScenarioThroughDebug(page, hub, sessionId, DEALINGS.id)
    current = await advanceToWorldMap(page, hub, sessionId, { label: '逐章：第三段世界地图' })
    const thirdMap = mapProjection(current)
    expect(thirdMap.current).toBe(DEALINGS_NODE)
    expect(thirdMap.time).toBeGreaterThanOrEqual(secondMap.time + secondMove.cost)
    const visitedNodes = current.state.campaign.tsk?.map?.visited || current.state.campaign.records.mapVisitedLocations
    expect(visitedNodes, `已访问地图节点：${JSON.stringify(visitedNodes)}`)
      .toEqual(expect.arrayContaining(['London', DEAD_HEAT_NODE, DEALINGS_NODE]))
    expect(current.state.campaign.records.time).toBe(thirdMap.time)
    expect(current.state.campaign.records.currentLocation).toBe(DEALINGS_NODE)
    await assertWorldMapPanel(page, hub, current, testInfo, `p8-progression-worldmap3-${label}`)
    expect(embarkMoves(current).length, '回到地图后仍有真实启程候选').toBeGreaterThanOrEqual(3)
    annotate(testInfo, 'evidence',
      `启程循环：时间 ${firstMap.time}→${thirdMap.time}；visited=${JSON.stringify(visitedNodes)}；`
      + `scenarioResults=${current.state.campaign.scenarioResults.length}；`
      + `records.currentLocation=${current.state.campaign.records.currentLocation}`)
    await shot(page, testInfo, `p8-progression-worldmap3-candidates-${label}`)

    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    await assertNoHorizontalOverflow(page)
  })
}

// ---------------------------------------------------------------------------
// spec 3（online）：双真人真实开局 + 隐私 + 权限边界 + 断线恢复
// ---------------------------------------------------------------------------
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1',
  () => resolve(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(resolve => {
  server.stopRelay?.()
  server.online?.close()
  server.closeAllConnections()
  server.close(resolve)
})

for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P8 ${label} 联机/隐私/权限/断线：双人真实开局`, async ({ browser }, testInfo) => {
    test.skip(!tskLaunchable(), 'theScarletKeys 尚未在 content/registered.js 注册为可启动战役')
    testInfo.setTimeout(ONLINE_TIMEOUT)
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'online')
    annotate(testInfo, 'scenario', FIRST_CHAPTER.id)
    annotate(testInfo, 'debugJump',
      'POST /api/debug（联机房主专用通道 action=debug）「结束这关」一次：把双人首章推进到真实结算，'
      + '以便在世界地图相位验证非房主不能启程（hubEmbark 权限边界）；其余全部真实 /api/online/command move。')

    const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
    const relay = createRelay()
    const relayUrl = await listen(relay)
    const halls = []
    let host, guest, guestReconnected, context
    const errors = []
    try {
      // 两个独立大厅实例：同一中转服务、同一会话、各席位自己的观察投影。
      for (let index = 0; index < 2; index++) {
        const server = createServer({ mods, persist: false })
        await server.ready
        halls.push({ server, url: await listen(server) })
      }
      const api = async (index, route, body) => {
        const response = await fetch(`${halls[index].url}/api/online/${route}`, {
          method: body ? 'POST' : 'GET',
          headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        })
        return response.json()
      }
      const command = (index, action, body = {}) => api(index, 'command',
        { action, body: { operationId: randomUUID(), ...body } })
      const status = async index => (await api(index, 'status')).session
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
      /** 轮询某个大厅的席位快照（联机快照经中转异步到达，直接读一次会读到上一 revision）。 */
      const waitForStatus = async (index, predicate, label, { attempts = 120, delay = 100 } = {}) => {
        let last = null
        for (let attempt = 0; attempt < attempts; attempt++) {
          last = await status(index)
          if (last && predicate(last)) return last
          await sleep(delay)
        }
        throw new Error(`${label} 超时：座位 ${index} revision=${last?.state?.revision} `
          + `uiState=${last?.state?.uiState} legal=${JSON.stringify((last?.state?.legalMoves || []).map(move => move.action).slice(0, 12))}`)
      }

      const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
        settings: { campaignId: TSK_CAMPAIGN, seed: `tsk-online-${label}` } })
      expect(created.ok, created.error).toBe(true)
      const joined = await api(1, 'join', { relayUrl, code: created.room.code })
      expect(joined.ok, joined.error).toBe(true)
      expect((await api(1, 'ready', { ready: true })).ok).toBe(true)

      // 同一 browser context：两个大厅端口不同 origin，各自保存自己座位的会话；
      // 断线恢复要重开页面后仍能读回同一 origin 的 localStorage。
      context = await browser.newContext({ viewport: { width, height } })
      host = await context.newPage()
      guest = await context.newPage()
      for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
      await host.goto(halls[0].url)
      await guest.goto(halls[1].url)

      // a. 真实联机开局：房主 /api/online/command start → 另一大厅看到同一绯红密钥会话。
      const started = await command(0, 'start')
      expect(started.ok, started.error).toBe(true)
      expect(started.session.state.campaign.id).toBe(TSK_CAMPAIGN)
      await expect.poll(async () => (await status(1))?.state?.campaign?.id).toBe(TSK_CAMPAIGN)
      expect((await status(0)).state.investigators.length).toBe(2)
      expect((await status(1)).state.investigators.length).toBe(2)
      expect((await status(0)).state.humanSeats).toEqual([0, 1])
      await expect(host.locator('.ah-hub')).toBeVisible({ timeout: 60_000 })
      await expect(host.locator('.bg-game-title').first()).toContainText(TSK_NAME)
      await shot(host, testInfo, `p8-online-${label}-hub`)

      const act = async (index, action, matches = () => true) => {
        let session, move
        for (let attempt = 0; attempt < 80; attempt++) {
          session = await status(index)
          move = (session.state.legalMoves || []).find(item => item.action === action && matches(item))
          if (move) break
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        expect(move, `${action} 不在座位 ${index} 的合法动作里；legal: ${JSON.stringify((session.state.legalMoves || [])
          .filter(item => item.action === action).slice(0, 4))}`).toBeTruthy()
        const result = await command(index, 'move', { revision: session.state.revision, move })
        expect(result.ok, result.error).toBe(true)
        return result.session
      }

      // b. 两名真人各自准备自己的席位（真实 /api/online/command move）。
      //    座位 1 也必须有自己的选择调查员/自动构筑/确认动作，证明两座位都能在准备阶段操作。
      const hostStart = await act(0, 'hubGoSetup')
      expect(hostStart.state.uiState).toBe('scenarioSetup')
      const guestReadyToPick = await waitForStatus(1, session =>
        session.state.legalMoves.some(move => move.action === 'hubSelectInvestigator' && move.code === GUEST_CODE),
      '座位 1 可选调查员')
      const guestCandidates = guestReadyToPick.state.legalMoves.filter(move => move.action === 'hubSelectInvestigator')
      expect(guestCandidates.some(move => move.code === GUEST_CODE), '座位 1 必须能选择自己的 09004').toBe(true)
      await act(0, 'hubSelectInvestigator', move => move.code === HOST_CODE)
      const guestAfterHostPick = await waitForStatus(1, session =>
        !session.state.legalMoves.some(move => move.action === 'hubSelectInvestigator' && move.code === HOST_CODE),
      '座位 0 已选 09001 后不再出现在座位 1 候选')
      expect(guestAfterHostPick.state.legalMoves.some(move => move.action === 'hubSelectInvestigator' && move.code === HOST_CODE),
        '座位 0 已选/占用的调查员不能出现在座位 1 候选').toBe(false)
      await act(0, 'hubAutoDeck')
      await act(0, 'hubDoneSeat')
      await act(1, 'hubSelectInvestigator', move => move.code === GUEST_CODE)
      await act(1, 'hubAutoDeck')
      await act(1, 'hubDoneSeat')
      const prepared = await waitForStatus(0, session => session.state.hubReady === true
        && session.state.campaign.investigators[0]?.code === HOST_CODE
        && session.state.campaign.investigators[1]?.code === GUEST_CODE
        && Object.values(session.state.hubSeatDone || {}).filter(Boolean).length === 2, '两席准备完成')
      expect(prepared.state.hubReady).toBe(true)
      expect(prepared.state.campaign.investigators[0].code).toBe(HOST_CODE)
      expect(prepared.state.campaign.investigators[1].code).toBe(GUEST_CODE)
      await act(0, 'hubSetLeader')

      // c. 权限边界（准备阶段）：非房主不能开始关卡；房主可以。
      const hostSetup = (await waitForStatus(0, session =>
        session.state.legalMoves.some(move => move.action === 'hubBeginScenario'), '房主可开始关卡')).state
      const guestSetup = (await waitForStatus(1, session =>
        session.state.revision === hostSetup.revision, '座位 1 追上房主 revision')).state
      expect(hostSetup.legalMoves.some(move => move.action === 'hubBeginScenario'), '房主应有 hubBeginScenario').toBe(true)
      expect(guestSetup.legalMoves.some(move => move.action === 'hubBeginScenario'), '非房主不应有 hubBeginScenario').toBe(false)
      const guestBeginDenied = await command(1, 'move', {
        revision: guestSetup.revision, move: { action: 'hubBeginScenario' },
      })
      expect(guestBeginDenied.ok, '非房主提交 hubBeginScenario 必须被拒绝').toBe(false)
      expect((await status(1)).state.revision, '被拒绝的越权动作不得推进 revision').toBe(guestSetup.revision)
      const entering = await act(0, 'hubBeginScenario')
      expect(entering.state.campaign.id).toBe(TSK_CAMPAIGN)

      // d. 开局待决选择由各自座位真实应答，直到双方都进入首章牌桌。
      for (let guard = 0; guard < 120; guard++) {
        let changed = false
        for (let seat = 0; seat < 2; seat++) {
          const revision = (await status(0)).state.revision
          await expect.poll(async () => (await status(seat)).state.revision).toBe(revision)
          const own = await status(seat)
          const move = (own.state.legalMoves || []).find(item => item.action === 'choose' && ['done', 'skip'].includes(item.optionId))
            || (own.state.legalMoves || []).find(item => item.action === 'choose')
          if (!move) continue
          const result = await command(seat, 'move', { revision: own.state.revision, move })
          expect(result.ok, result.error).toBe(true)
          changed = true
        }
        if (!changed) break
      }
      const hostPlaying = await status(0)
      const guestPlaying = await status(1)
      expect(hostPlaying.state.uiState).toBe('inScenario')
      expect(guestPlaying.state.uiState).toBe('inScenario')
      expect(hostPlaying.state.scenario.id).toBe(FIRST_CHAPTER.id)
      expect(guestPlaying.state.scenario.id).toBe(FIRST_CHAPTER.id)
      expect(hostPlaying.state.campaign.scenarioResults.length).toBe(0)
      expect((hostPlaying.state.legalMoves || []).length).toBeGreaterThan(0)

      // e. 隐私：对方座位手牌为空；未揭露隐匿迷你卡没有真身字段；页面各看自己的手牌。
      //    两个页面都先跳过开局故事演出，让截图真实呈现牌桌与各自手牌（不是同一张故事卡）。
      for (const page of [host, guest]) {
        await dismissPresentation(page)
        await page.waitForTimeout(300)
        await expect(page.locator('.ah-cinematic')).toHaveCount(0)
      }
      expect(hostPlaying.state.investigators[0].hand.length).toBeGreaterThan(0)
      expect(hostPlaying.state.investigators[1].hand).toEqual([])
      expect(guestPlaying.state.investigators[1].hand.length).toBeGreaterThan(0)
      expect(guestPlaying.state.investigators[0].hand).toEqual([])
      const hostConcealed = hostPlaying.state.mechanics?.tsk?.concealed || []
      const guestConcealed = guestPlaying.state.mechanics?.tsk?.concealed || []
      const hiddenOf = list => list.filter(card => card.visible !== true)
      expect(hiddenOf(guestConcealed).length, '两席位的未揭露迷你卡数量必须一致（公开信息）')
        .toBe(hiddenOf(hostConcealed).length)
      for (const card of [...hiddenOf(hostConcealed), ...hiddenOf(guestConcealed)]) {
        expect(card, `未揭露迷你卡不得下发真身字段：${JSON.stringify(card)}`).not.toHaveProperty('kind')
        expect(card).not.toHaveProperty('decoy')
        expect(card).not.toHaveProperty('id')
      }
      await expect(host.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
      await expect(guest.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
      await expect(host.locator('.ah-hand[data-hand-seat="0"]')).toBeVisible()
      await expect(guest.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
      expect(await host.locator('.ah-hand[data-hand-seat="1"]').count()).toBe(0)
      expect(await guest.locator('.ah-hand[data-hand-seat="0"]').count()).toBe(0)
      await expect(host.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name.split(' ')[0])
      await expect(guest.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name.split(' ')[0])
      annotate(testInfo, 'claim', 'privacy')
      annotate(testInfo, 'evidence',
        `隐私：座位 0 手牌=${hostPlaying.state.investigators[0].hand.length} / 座位 1 视图座位 0 手牌=`
        + `${guestPlaying.state.investigators[0].hand.length}；隐匿迷你卡 ${hostConcealed.length} 张（未揭露 ${hiddenOf(hostConcealed).length}）`)
      await shot(host, testInfo, `p8-online-${label}-host-table`)
      await shot(guest, testInfo, `p8-online-${label}-guest-table`)

      // f. 断线恢复：关闭客人页面 → 重开同一大厅 → 回到同一战役会话、版本/手牌一致。
      await guest.close()
      guest = null
      guestReconnected = await context.newPage()
      guestReconnected.on('pageerror', error => errors.push(error.message))
      await guestReconnected.goto(halls[1].url)
      await guestReconnected.waitForSelector('.ah-table, .ah-hub', { timeout: 60_000 })
      await expect.poll(async () => (await status(1))?.state?.revision).toBe((await status(0)).state.revision)
      const resumed = await status(1)
      expect(resumed.state.campaign.id).toBe(TSK_CAMPAIGN)
      expect(resumed.state.scenario.id).toBe(FIRST_CHAPTER.id)
      expect(resumed.state.investigators[1].hand.length).toBeGreaterThan(0)
      expect(resumed.state.investigators[0].hand).toEqual([])
      await expect(guestReconnected.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
      annotate(testInfo, 'claim', 'disconnect')
      await shot(guestReconnected, testInfo, `p8-online-${label}-reconnect`)

      // g. 权限边界（关末/世界地图）：非房主不能 hubContinue，也不能 hubEmbark；房主可以。
      let current = await status(0)
      const ended = await command(0, 'debug', { revision: current.state.revision, command: { text: '结束这关' } })
      expect(ended.ok, ended.error).toBe(true)
      for (let guard = 0; guard < 80; guard++) {
        let changed = false
        for (let seat = 0; seat < 2; seat++) {
          const own = await status(seat)
          const move = (own.state.legalMoves || []).find(item => item.action === 'choose')
          if (!move) continue
          const result = await command(seat, 'move', { revision: own.state.revision, move })
          expect(result.ok, result.error).toBe(true)
          changed = true
        }
        if (!changed) break
      }
      current = await waitForStatus(0, session => session.state.uiState === 'scenarioResult', '房主关末结算')
      expect(current.state.uiState).toBe('scenarioResult')
      const guestResult = await waitForStatus(1, session =>
        session.state.revision === current.state.revision, '座位 1 追上结算 revision')
      const guestContinue = await command(1, 'move', {
        revision: guestResult.state.revision, move: { action: 'hubContinue' },
      })
      expect(guestContinue.ok, '非房主提交 hubContinue 必须被拒绝').toBe(false)
      expect((await status(1)).state.revision).toBe(guestResult.state.revision)
      await act(0, 'hubContinue')

      // 幕间：两个座位都要真实确认自己的席位（真实并发准备），随后流程停下在世界地图节点。
      for (let guard = 0; guard < 40; guard++) {
        const own = await status(1)
        const doneMove = (own.state.legalMoves || []).find(move => move.action === 'hubDoneSeat')
        if (doneMove) {
          const result = await command(1, 'move', { revision: own.state.revision, move: doneMove })
          expect(result.ok, result.error).toBe(true)
        }
        const hostView = await status(0)
        if ((hostView.state.legalMoves || []).some(move => move.action === 'hubDoneSeat')) await act(0, 'hubDoneSeat')
        for (let seat = 0; seat < 2; seat++) {
          const seatView = await status(seat)
          const choose = (seatView.state.legalMoves || []).find(item => item.action === 'choose')
          if (choose) {
            const result = await command(seat, 'move', { revision: seatView.state.revision, move: choose })
            expect(result.ok, result.error).toBe(true)
          }
        }
        const map = (await status(0)).state.mechanics?.tsk?.map
        if (map?.canEmbark) break
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      current = await status(0)
      const map = current.state.mechanics?.tsk?.map
      expect(map?.canEmbark, `联机世界地图相位：${JSON.stringify({
        ui: current.state.uiState, node: current.state.campaign.flow?.nodeId, time: map?.time,
      })}`).toBe(true)
      const hostMoves = (current.state.legalMoves || []).filter(move => move.action === 'hubEmbark')
      expect(hostMoves.length, '房主应有真实 hubEmbark 候选').toBeGreaterThanOrEqual(3)
      const guestMap = await status(1)
      expect((guestMap.state.legalMoves || []).some(move => move.action === 'hubEmbark'),
        '非房主不应看到 hubEmbark 候选').toBe(false)
      const guestEmbarkDenied = await command(1, 'move', {
        revision: guestMap.state.revision, move: { action: 'hubEmbark', destination: DEAD_HEAT_NODE },
      })
      expect(guestEmbarkDenied.ok, '非房主提交 hubEmbark 必须被拒绝').toBe(false)
      expect((await status(1)).state.revision).toBe(guestMap.state.revision)
      const deadHeatMove = hostMoves.find(move => move.destination === DEAD_HEAT_NODE && move.expedite !== true)
      expect(deadHeatMove, '房主世界地图应有 deadHeat 目的地候选').toBeTruthy()
      const mapTimeBefore = map?.time
      const embarked = await act(0, 'hubEmbark', move => move.destination === DEAD_HEAT_NODE)
      expect(embarked.state.uiState).toBe('scenarioSetup')
      expect(embarked.state.campaign.flow?.nodeId).toBe(DEAD_HEAT.id)
      // 章节结局本身会按真实规则记时间，因此以启程前地图时间为基准做相对断言。
      expect(embarked.state.mechanics?.tsk?.map?.time).toBe(mapTimeBefore + deadHeatMove.cost)
      expect(embarked.state.mechanics?.tsk?.map?.current).toBe(DEAD_HEAT_NODE)
      annotate(testInfo, 'claim', 'permission')
      annotate(testInfo, 'evidence',
        `权限：座位 1 被拒绝 hubBeginScenario / hubContinue / hubEmbark；房主真实启程 ${DEAD_HEAT_NODE}（`
        + `cost=${deadHeatMove.cost} time=${mapTimeBefore}→${embarked.state.mechanics?.tsk?.map?.time}）`)

      // h. 房主页面刷新到真实世界地图/出发准备相位并截图；客人页面重载后在同一会话。
      await host.reload()
      await expect(host.locator('.ah-hub')).toBeVisible({ timeout: 60_000 })
      await expect.poll(async () => host.locator('.ah-hub').getAttribute('data-ui-state')).toBe('scenarioSetup')
      await shot(host, testInfo, `p8-online-${label}-embarked`)
      await guestReconnected.reload()
      await guestReconnected.waitForSelector('.ah-hub', { timeout: 60_000 })
      await expect.poll(async () => guestReconnected.locator('.ah-hub').getAttribute('data-ui-state')).toBe('scenarioSetup')
      const guestNow = await status(1)
      expect(guestNow.state.campaign.flow?.nodeId).toBe(DEAD_HEAT.id)
      expect(guestNow.state.mechanics?.tsk?.map?.current).toBe(DEAD_HEAT_NODE)
      await shot(guestReconnected, testInfo, `p8-online-${label}-guest-embarked`)

      expect(errors).toEqual([])
      await assertNoHorizontalOverflow(host)
      await assertNoHorizontalOverflow(guestReconnected)
    } finally {
      await host?.close()
      await guest?.close()
      await guestReconnected?.close()
      await context?.close()
      await Promise.all(halls.map(hall => stop(hall.server)))
      await stop(relay)
    }
  })
}
