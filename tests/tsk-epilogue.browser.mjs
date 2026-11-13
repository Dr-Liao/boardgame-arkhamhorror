// 八循环《绯红密钥》（The Scarlet Keys）P8 尾声/通古斯卡终章浏览器证据（桌面 1440×900 / 移动 390×844）。
//
// 本 spec 是 P8 README 第 3 项「地图启程、逐章推进与尾声」中**尾声/终章**那一段的独立证据链：
// 发布门禁的 tests/tsk-release.browser.mjs 覆盖 release/progression/online，但没有走到世界地图
// 时间阈值、被迫启程与战役终章，因此单独一条链（audit/tsk-epilogue-browser.json）。
//
// 真实路线（每视口各跑一次，全部经真实大厅 / 真实 HTTP / 真实 web 界面）：
//   1. 真实大厅启动绯红密钥（2 席：09001 真人 + AI，AI 由服务端同一条 autoHubMove 路径准备）；
//   2. 真实关卡选择 / 确认准备 / 开始首章谜雨 riddlesAndRain → 牌桌；
//   3. host-only POST /api/debug「结束这关 resolution2」（真实 debugCommand 解析 + 事务提交，
//      finishScenario/结局/XP/记录全部真实）→ 真实 hubContinue → 幕间 I → 世界地图；
//   4. **时间累积**：在世界地图相位用真实 /api/move 反复提交 hubEmbark，走 London ↔ Bermuda
//      （Bermuda → 幕间 20 theGreatWork，London → 幕间 27 deadAndGone），每个幕间用真实 hubDoneSeat
//      完成关间准备、真实 choose 收敛分支，直到 state.mechanics.tsk.map.time ≥ 35。
//      每次旅行都真实累计清单/地图原语给出的耗时（London↔Bermuda 单程 1 时间；幕间 27 自身还会
//      markTime），并真实结算 α/ε/β/ζ/γ 五份到期状况报告（hubAdvanceReport）。
//      本步是 P8 的「时间加速」披露项：没有直接写 session.state / records.time，也没有 page.route
//      改写响应；加速只体现在「反复走真实地图弧线」而不是逐章打完十关。
//   5. 时间 ≥35 后，世界地图只给出唯一候选「被迫启程：通古斯卡」；点击真实候选按钮
//      （[data-hub-embark="Tunguska"]）→ endgameApproach → 钥匙议会 congressOfTheKeys 出发准备；
//   6. 真实确认准备 + 开始当前关卡 → 钥匙议会牌桌（关卡设置指南 + 真实开场审判）→
//      host-only /api/debug「结束这关 resolution1」→ 真实 scenarioResult；
//   7. 真实 hubContinue → 尾声节点 epilogue（内容层按真实战役记录写 Foundation Trust / Cell
//      Deception / 最终结局）→ end → 真实 campaignResult：
//      断言 data-ui-state="campaignResult"、调查纪事里「尾声」正文可见、三个结局之一被记录
//      （state.campaign.records.campaignOutcome）。
//
// 真实口径：不 page.route 改写 /api/start、/api/session、/api/move；不写 session.state；
// 章节内不做夹具。跨章只用 host-only POST /api/debug 的「结束这关」（与大厅调试控制台同一条
// debugCommand + finishScenario 路径），并在 annotation debugJump 与
// artifacts/migration/tsk/reports/p8-epilogue-report.md 里逐条披露。
//
// 证据账本：audit/tsk-epilogue-browser.json（tools/playwright-tsk-epilogue-reporter.mjs）。
// 证据命令（在 games/arkhamhorror 下）：node tools/run-tsk-epilogue-browser.mjs
import { test, expect } from '@playwright/test'
import {
  TSK_CAMPAIGN, TSK_NAME, TSK_CHAPTERS, FIRST_CHAPTER, investigatorName,
  openTskLobby, startTskGame, chooseScenarioThroughUi, prepareSeatThroughUi, beginCurrentChapter,
  waitForPlayableTable, fetchSession, submitMove, submitDebug, settleUi, syncUiToState,
  hubTab, clickSettled, dismissPresentation, shot, annotate, SHOT_DIR,
} from './tsk-browser-helpers.mjs'
import { contentRegistry } from '../content/registered.js'
import { campaignFlowExtras } from '../content/campaigns/theScarletKeys/flow.js'

const EPILOGUE_TIMEOUT = 480_000
const HOST_CODE = '09001'
const CONGRESS = TSK_CHAPTERS.find(chapter => chapter.id === 'congressOfTheKeys')
const CONGRESS_ID = CONGRESS.id
// 阈值/强制目的地来自战役清单（内容读点），不在 spec 里手抄 35 / Tunguska。
const FORCED_TIME = campaignFlowExtras.forcedEndgameTime
const FORCED_NODE = campaignFlowExtras.forcedEndgameNode
const FORCED_NAME = campaignFlowExtras.mapNodeNames?.[FORCED_NODE] || FORCED_NODE
const ENDGAME_NODE_ID = campaignFlowExtras.endgameApproachNodeId
const MAP_NODE_ID = campaignFlowExtras.mapNodeId
// 尾声结局（内容层 epilogue.js#runScarletKeysEpilogue 写入 records.campaignOutcome 的三个短标签，
// 对应正文段 epilogue2/4/5）。这里只做只读断言表，不改内容。
const OUTCOMES = Object.freeze({
  coterieAlliance: Object.freeze({ marker: '一起对抗人类最大的威胁', record: 'theRedCoterieAndTheCellAgreedToWorkTogether' }),
  permanentPosition: Object.freeze({ marker: '终身职位', record: 'theCellWasGivenAPermanentPosition' }),
  dismantled: Object.freeze({ marker: '就此解散', record: 'theCellWasDismantled' }),
})

function tskLaunchable() {
  try {
    // contentRegistry 由生产组合根加载；与发布门禁同一可启动判据。
    contentRegistry.assertLaunchable(TSK_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

/** 失败现场：截图 + 界面快照写入 annotation（只在失败时；不掩盖真实错误）。 */
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const viewport = /mobile/.test(testInfo.title) ? 'mobile' : 'desktop'
  const path = `${SHOT_DIR}epilogue-${viewport}-failure.png`
  await page.screenshot({ path, fullPage: true, animations: 'disabled' }).catch(() => {})
  testInfo.annotations.push({ type: 'screenshot', description: path })
  const snapshot = await page.evaluate(() => ({
    hub: document.querySelector('.ah-hub')?.getAttribute('data-ui-state') || null,
    table: Boolean(document.querySelector('.ah-table')),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
    workflow: [...document.querySelectorAll('.ah-workflow-next button')].map(node => (node.textContent || '').slice(0, 40)).slice(0, 4),
    mapPanel: Boolean(document.querySelector('[data-hub-world-map]')),
    embarkButtons: [...document.querySelectorAll('[data-hub-embark]')].map(node => ({
      destination: node.getAttribute('data-hub-embark'), text: (node.textContent || '').trim(),
    })).slice(0, 6),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
  })).catch(error => ({ error: String(error) }))
  testInfo.annotations.push({ type: 'failure', description: JSON.stringify(snapshot) })
})

// ---------------------------------------------------------------------------
// 真实会话读取 / 待决选择 / 界面同步（与发布门禁同一套真实接口）
// ---------------------------------------------------------------------------

/** 真实 /api/session（按浏览器座位投影）→ sessionView；state 在 .state。 */
async function view(page, sessionId) {
  const session = await fetchSession(page, sessionId)
  expect(session, '真实 /api/session 必须返回会话').toBeTruthy()
  return session
}

/** 用真实 /api/move choose 结算全部待决选择（默认 done/skip/self/keep，其次第一个合法项）。 */
async function drainChoices(page, sessionId, { max = 96 } = {}) {
  let session = await view(page, sessionId)
  for (let guard = 0; guard < max; guard++) {
    const choice = session.state.pendingChoice
    if (!choice) return session
    const ids = (choice.options || []).map(option => String(option.id))
    const pick = ['done', 'skip', 'self', 'keep'].find(id => ids.includes(id)) || ids[0]
    const move = (session.state.legalMoves || [])
      .find(item => item.action === 'choose' && String(item.optionId) === pick)
      || { action: 'choose', choiceId: choice.id, optionId: pick }
    const result = await submitMove(page, sessionId, session.state.revision, move)
    expect(result.status, '真实 /api/move choose 的 HTTP 状态').toBe(200)
    expect(result.payload.ok, `${choice.kind}:${result.payload.error}`).toBe(true)
    session = result.payload.session
  }
  throw new Error('待决选择超过安全上限仍未收敛')
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

// ---------------------------------------------------------------------------
// 世界地图 / 时间轴
// ---------------------------------------------------------------------------

/** 世界地图公开投影（真实观察字段：state.mechanics.tsk.map；含 destinations/canEmbark/phase）。 */
function mapProjection(session) {
  return session?.state?.mechanics?.tsk?.map || null
}

function embarkMoves(session) {
  return (session?.state?.legalMoves || []).filter(move => move.action === 'hubEmbark')
}

/**
 * 从结算页 / 幕间推进到「世界地图相位」：scenarioResult → 真实 hubContinue；
 * 幕间 → 真实 hubDoneSeat（必要时真实 /api/move choose 分支）；直到 canEmbark 且有 hubEmbark。
 */
async function advanceToWorldMap(page, hub, sessionId, { label = '世界地图', testInfo = null } = {}) {
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
      continue
    }
    await refreshUi(page)
    await page.waitForTimeout(450)
  }
  throw new Error(`未到达世界地图相位：${JSON.stringify({
    uiState: last?.state?.uiState, flowNode: last?.state?.campaign?.flow?.nodeId,
    canEmbark: mapProjection(last)?.canEmbark ?? null,
    legal: (last?.state?.legalMoves || []).map(move => move.action).slice(0, 20),
    time: last?.state?.mechanics?.tsk?.map?.time,
  })}`)
}

/** 真实调试通道结束当前关卡（host-only /api/debug；引擎完整走 finishScenario/结局/XP/记录）。 */
async function finishScenarioThroughDebug(page, hub, sessionId, expectedChapterId, { resolution, label, testInfo = null }) {
  let session = await view(page, sessionId)
  expect(session.state.uiState).toBe('inScenario')
  expect(session.state.scenario.id).toBe(expectedChapterId)
  const before = session.state.campaign.scenarioResults.length
  const ended = await submitDebug(page, sessionId, session.state.revision, `结束这关 ${resolution}`)
  expect(ended.status, '真实 /api/debug 的 HTTP 状态').toBe(200)
  expect(ended.payload.ok, ended.payload.error).toBe(true)
  // 结局钩子可能要求真实 choose（例如谜雨的渡鸦之眼持有者）：先收敛，再等关卡结算完成。
  session = await drainChoices(page, sessionId)
  session = await waitForScenarioResult(page, sessionId, expectedChapterId)
  expect(session.state.campaign.scenarioResults.length).toBe(before + 1)
  expect(session.state.campaign.scenarioResults.at(-1).scenarioId).toBe(expectedChapterId)
  if (testInfo) {
    annotate(testInfo, 'evidence',
      `调试关末结算（已披露）：${label} → /api/debug「结束这关 ${resolution}」→ scenarioResult；`
      + `scenarioResults=${session.state.campaign.scenarioResults.length}`)
  }
  await dismissPresentation(page)
  await syncUiToState(page, 'scenarioResult')
  await expect(hub).toHaveAttribute('data-ui-state', 'scenarioResult', { timeout: 30_000 })
  return session
}

/** 轮询真实会话直到关卡结算完成（解决 debug 事务里 choose 重放后的异步收尾）。 */
async function waitForScenarioResult(page, sessionId, expectedChapterId) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const session = await view(page, sessionId)
    if (session.state.uiState === 'scenarioResult') return session
    await page.waitForTimeout(150)
  }
  const last = await view(page, sessionId)
  throw new Error(`关卡 ${expectedChapterId} 的结算未到达 scenarioResult（uiState=${last?.state?.uiState} `
    + `pending=${last?.state?.pendingChoice?.kind || null}）`)
}

/** 出发准备页：确认本座位准备（真实 hubDoneSeat）。AI 席位由服务端同一请求内的 autoHubMove 完成。 */
async function confirmSeat(page, hub, sessionId, label) {
  let session = await view(page, sessionId)
  if (session.state.hubReady) return session
  expect(primaryActionFor(session.state), `${label} 的出发准备应可确认席位`).toBe('hubDoneSeat')
  await clickHubPrimary(page, hub, sessionId, 'hubDoneSeat', `${label}：确认准备`)
  session = await view(page, sessionId)
  expect(session.state.hubReady, `${label} 全桌准备完成`).toBe(true)
  return session
}

/**
 * 时间累积（P8 披露项）：真实世界地图启程循环 London ↔ Bermuda，每次启程/幕间结算都是
 * 真实 /api/move；不写 session.state、不改 records.time。返回 { session, trace, reports, travels }。
 */
async function accumulateTimeToForcedEndgame(page, sessionId, { testInfo = null, viewport = 'desktop', sleepEvery = 5 } = {}) {
  let session = await drainChoices(page, sessionId)
  const startMap = mapProjection(session)
  expect(startMap?.canEmbark, `时间累积起点必须停在世界地图相位（map=${JSON.stringify(startMap && {
    current: startMap.current, time: startMap.time, canEmbark: startMap.canEmbark,
  })}）`).toBe(true)
  expect(startMap.time, '世界地图时间轴起点').toBeLessThan(FORCED_TIME)
  const trace = [startMap.time]
  const reports = []
  let travels = 0
  for (let cycle = 0; cycle < 80; cycle++) {
    session = await drainChoices(page, sessionId)
    let map = mapProjection(session)
    expect(map, '真实会话必须始终带世界地图投影').toBeTruthy()
    if (map.time >= FORCED_TIME) break
    const reportMove = (session.state.legalMoves || []).find(move => move.action === 'hubAdvanceReport')
    if (reportMove) {
      const result = await submitMove(page, sessionId, session.state.revision, reportMove)
      expect(result.status, '真实 /api/move hubAdvanceReport 的 HTTP 状态').toBe(200)
      expect(result.payload.ok, result.payload.error).toBe(true)
      reports.push(String(reportMove.report))
      session = await drainChoices(page, sessionId)
      map = mapProjection(session)
      expect(map?.canEmbark, '状况报告结算后必须回到世界地图相位').toBe(true)
      trace.push(map.time)
      continue
    }
    const from = map.current
    const destination = from === 'London' ? 'Bermuda' : from === 'Bermuda' ? 'London' : null
    expect(destination, `时间累积只走 London↔Bermuda（真实幕间 27/20）；当前地图节点 ${from}`).toBeTruthy()
    const embark = (session.state.legalMoves || []).find(move => move.action === 'hubEmbark'
      && move.destination === destination && move.expedite !== true)
    expect(embark, `世界地图应给出 ${from}→${destination} 的真实启程候选；`
      + `实际=${JSON.stringify(embarkMoves(session).slice(0, 8))}`).toBeTruthy()
    const result = await submitMove(page, sessionId, session.state.revision, embark)
    expect(result.status, '真实 /api/move hubEmbark 的 HTTP 状态').toBe(200)
    expect(result.payload.ok, result.payload.error).toBe(true)
    travels += 1
    session = await closeInterludeWindow(page, sessionId)
    map = mapProjection(session)
    expect(session.state.campaign.flowStage, '幕间结算后流程必须回到 map 停点').toBe('map')
    expect(map?.canEmbark, `第 ${cycle + 1} 次启程后必须回到世界地图相位`).toBe(true)
    trace.push(map.time)
    if (cycle % sleepEvery === sleepEvery - 1) await page.waitForTimeout(10)
  }
  session = await drainChoices(page, sessionId)
  const finalMap = mapProjection(session)
  expect(finalMap.time, `真实累积时间必须达到强制终局阈值 ${FORCED_TIME}`).toBeGreaterThanOrEqual(FORCED_TIME)
  expect(session.state.campaign.flowStage).toBe('map')
  expect(session.state.campaign.flow?.nodeId).toBe(MAP_NODE_ID)
  annotate(testInfo, 'timeTrace', JSON.stringify(trace))
  annotate(testInfo, 'timeAcceleration',
    `P8 披露：世界地图时间由真实 /api/move hubEmbark 累积（London↔Bermuda，触发幕间 27/20），`
    + `共 ${travels} 次旅行、${reports.length} 份真实状况报告（${reports.join('/') || '无'}）；`
    + `时间轨迹 ${JSON.stringify(trace)}。未写 session.state/records.time，未 page.route 改写接口。`)
  annotate(testInfo, 'evidence',
    `时间累积：start=${trace[0]} final=${finalMap.time} travels=${travels} reports=${reports.join('/') || '无'} `
    + `current=${finalMap.current} unlocked=${finalMap.unlocked?.length}`)
  return { session, trace, reports, travels }
}

/**
 * 关闭真实幕间窗口：幕间停点需要每个座位真实 hubDoneSeat；AI 座位由服务端 autoHubMove 完成。
 * 若正在等 AI 行动（座位 0 暂无合法动作）就短暂轮询；待决分支用真实 choose 收敛。
 */
async function closeInterludeWindow(page, sessionId) {
  for (let guard = 0; guard < 24; guard++) {
    let session = await drainChoices(page, sessionId)
    if (session.state.campaign.flowStage !== 'interlude') return session
    const done = (session.state.legalMoves || []).find(move => move.action === 'hubDoneSeat')
    if (!done) {
      await page.waitForTimeout(100)
      continue
    }
    const result = await submitMove(page, sessionId, session.state.revision, done)
    expect(result.status, '真实 /api/move hubDoneSeat 的 HTTP 状态').toBe(200)
    expect(result.payload.ok, result.payload.error).toBe(true)
  }
  const last = await view(page, sessionId)
  throw new Error(`幕间窗口未关闭：uiState=${last.state.uiState} flowStage=${last.state.campaign.flowStage}`
    + ` node=${last.state.campaign.flow?.nodeId} legal=${JSON.stringify((last.state.legalMoves || []).map(move => move.action))}`)
}

/** 世界地图面板 + 被迫启程候选（真实 DOM，不是状态注入）。 */
async function assertForcedEndgamePanel(page, hub, session) {
  const map = mapProjection(session)
  expect(map.canEmbark, '时间 ≥35 时世界地图应可启程').toBe(true)
  expect(map.time).toBeGreaterThanOrEqual(FORCED_TIME)
  expect(map.forced, '地图公开投影必须给出强制目的地').toBe(FORCED_NODE)
  const embarks = embarkMoves(session)
  expect(embarks.length, `被迫启程时只应有一个启程候选；实际=${JSON.stringify(embarks)}`).toBe(1)
  expect(embarks[0].destination).toBe(FORCED_NODE)
  expect(embarks[0].label, `被迫启程候选 label（实际 ${embarks[0].label}）`).toContain('被迫启程')
  expect(embarks[0].label).toContain(FORCED_NAME)
  expect(Number.isFinite(embarks[0].cost) && embarks[0].cost >= 1, '启程耗时必须是真实正数').toBe(true)
  for (const destination of map.destinations || []) {
    if (destination.destination === FORCED_NODE) continue
    expect(destination.forcedBlocked, `${destination.destination} 应被强制目的地挡住`).toBe(true)
  }
  // 真实 UI：启程面板 + 唯一候选按钮（DOM 数据来自真实 legalMoves）。
  const panel = hub.locator('[data-hub-world-map]')
  await expect(panel).toBeVisible({ timeout: 30_000 })
  await expect(panel.locator('[data-tsk-map-forced]')).toHaveAttribute('data-tsk-map-forced', FORCED_NODE)
  const buttons = panel.locator('[data-hub-embark]')
  await expect(buttons).toHaveCount(1)
  const forcedButton = panel.locator(`[data-hub-embark="${FORCED_NODE}"]`)
  await expect(forcedButton).toBeVisible()
  await expect(forcedButton).toBeEnabled()
  await expect(forcedButton).toContainText('被迫启程')
  await expect(forcedButton).toContainText(FORCED_NAME)
  await expect(panel).toContainText(`只能启程前往${FORCED_NAME}`)
  return { map, embark: embarks[0], panel, forcedButton }
}

/** 点击真实「被迫启程」按钮 → endgameApproach → 钥匙议会出发准备。 */
async function clickForcedEmbark(page, hub, forcedButton) {
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubEmbark', { timeout: 60_000 })
  await clickSettled(page, forcedButton, '被迫启程：通古斯卡')
  const body = await (await responded).json()
  expect(body.ok, body.error).toBe(true)
  return body.session
}

async function syncHubState(page, hub, uiState) {
  await refreshUi(page)
  await expect(hub).toHaveAttribute('data-ui-state', uiState, { timeout: 30_000 })
}

async function assertNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
}

// ---------------------------------------------------------------------------
// 2 个 spec（desktop 1440×900 / mobile 390×844）
// ---------------------------------------------------------------------------
for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P8 ${label} 尾声：时间 ≥35 被迫启程通古斯卡 → 钥匙议会 → 尾声 → 战役终章`, async ({ page }, testInfo) => {
    test.skip(!tskLaunchable(), 'theScarletKeys 尚未在 content/registered.js 注册为可启动战役')
    testInfo.setTimeout(EPILOGUE_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'epilogue')
    annotate(testInfo, 'scenario', CONGRESS_ID)
    annotate(testInfo, 'debugJump',
      'host-only POST /api/debug（真实 debugCommand 解析 + 正常事务提交）「结束这关 resolution2」'
      + '（谜雨）与「结束这关 resolution1」（钥匙议会）：只做跨章/终章的关末结算（finishScenario/结局/XP/记录），'
      + '章内不做夹具、不写 session.state。终章本身仍由真实世界地图时间累积到 35 后唯一被迫启程进入。')

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

    // a. 真实大厅：启动页 → 调查准备设置 → 绯红密钥 2 席（1 真人 + 1 AI）。
    const setup = await openTskLobby(page)
    await shot(page, testInfo, `epilogue-${label}-lobby`)
    const { session, hub } = await startTskGame(page, setup, { seats: 2 })
    const sessionId = session.sessionId
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
    await expect(page.locator('.bg-game-title').first()).toContainText(TSK_NAME)
    await shot(page, testInfo, `epilogue-${label}-hub`)

    // b. 真实局外页：选首章谜雨 → 09001 选择调查员 / 自动构筑 / 确认准备（AI 席位同请求准备）。
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })
    const prepared = await prepareSeatThroughUi(page, hub, { code: HOST_CODE })
    expect(prepared.state.investigators[0].code).toBe(HOST_CODE)
    expect(prepared.state.hubReady, '真实大厅准备完成').toBe(true)
    annotate(testInfo, 'evidence',
      `大厅准备：座位 0=${HOST_CODE} ${investigatorName(HOST_CODE)}；`
      + `座位 1（AI）=${prepared.state.investigators[1].code} ${prepared.state.investigators[1].name}`)

    // c. 真实开始首章 riddlesAndRain → 牌桌 + 序幕初始化世界地图（London / time 0 / 26 解锁）。
    const first = await beginCurrentChapter(page, hub, {
      chapterName: FIRST_CHAPTER.name,
      beforeBegin: async departure => {
        await expect(departure.locator('.ah-departure-member')).toHaveCount(2)
      },
    })
    expect(first.session.state.scenario.id).toBe(FIRST_CHAPTER.id)
    await waitForPlayableTable(page)
    let current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.scenario.id).toBe(FIRST_CHAPTER.id)
    expect(current.state.investigators[0].code).toBe(HOST_CODE)
    expect(current.state.investigators[0].hand.length).toBeGreaterThan(0)
    const prologueMap = mapProjection(current)
    expect(prologueMap, '序幕必须初始化世界地图').toBeTruthy()
    expect(prologueMap.current).toBe('London')
    expect(prologueMap.time).toBe(0)
    expect(prologueMap.unlocked.length).toBeGreaterThanOrEqual(26)
    await expect(page.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name.split(' ')[0])
    await shot(page, testInfo, `epilogue-${label}-first-table`)

    // d. 真实关末结算（调试加速，已披露）→ 真实 hubContinue → 幕间 I → 世界地图。
    current = await finishScenarioThroughDebug(page, hub, sessionId, FIRST_CHAPTER.id, {
      resolution: 'resolution2', label: '首章谜雨', testInfo,
    })
    await shot(page, testInfo, `epilogue-${label}-first-result`)
    current = await advanceToWorldMap(page, hub, sessionId, { label: `epilogue-${label}`, testInfo })
    let map = mapProjection(current)
    expect(map.current).toBe('London')
    expect(map.time).toBeGreaterThanOrEqual(0)
    expect(current.state.campaign.records.time).toBe(map.time)
    annotate(testInfo, 'evidence', `首章结算后世界地图：current=${map.current} time=${map.time}`)

    // e. 真实时间累积 loop：London↔Bermuda 反复启程 + 幕间确认/分支，直到 time ≥ 35。
    const accumulated = await accumulateTimeToForcedEndgame(page, sessionId, { testInfo, viewport: label })
    current = accumulated.session
    map = mapProjection(current)
    expect(current.state.campaign.records.time).toBe(map.time)

    // f. 时间 ≥35：UI 只给「被迫启程：通古斯卡」；断言投影/合法动作/DOM 三处一致。
    await syncHubState(page, hub, 'interlude')
    await expect(hub).toHaveAttribute('data-ui-state', 'interlude')
    current = await view(page, sessionId)
    const forced = await assertForcedEndgamePanel(page, hub, current)
    annotate(testInfo, 'claim', 'forcedEndgame')
    await assertNoHorizontalOverflow(page)
    await shot(page, testInfo, `epilogue-${label}-worldmap-forced`)

    // g. 点击真实候选 → endgameApproach → 钥匙议会出发准备（时间继续按真实耗时累计）。
    const beforeForcedTime = forced.map.time
    const embarked = await clickForcedEmbark(page, hub, forced.forcedButton)
    expect(embarked.state.uiState).toBe('scenarioSetup')
    expect(embarked.state.campaign.flow?.nodeId).toBe(CONGRESS_ID)
    expect(embarked.state.hubSelectedScenarioId).toBe(CONGRESS_ID)
    expect(mapProjection(embarked).current).toBe(FORCED_NODE)
    expect(mapProjection(embarked).time).toBe(beforeForcedTime + forced.embark.cost)
    expect(embarked.state.campaign.records.tskEndgameForced, '被迫启程必须记入战役记录').toBe(true)
    expect(embarked.state.campaign.flow.history.some(visit => visit.nodeId === ENDGAME_NODE_ID),
      '被迫启程必须经过 endgameApproach 节点').toBe(true)
    annotate(testInfo, 'evidence',
      `被迫启程：time ${beforeForcedTime}→${mapProjection(embarked).time}（cost=${forced.embark.cost}）`
      + ` current=${mapProjection(embarked).current} node=${embarked.state.campaign.flow.nodeId}`)
    await syncHubState(page, hub, 'scenarioSetup')

    // h. 真实确认准备 + 开始钥匙议会 → 终章牌桌（真实开场审判/设置）。
    await confirmSeat(page, hub, sessionId, '终章：钥匙议会出发准备')
    const congress = await beginCurrentChapter(page, hub, {
      chapterName: CONGRESS.name,
      beforeBegin: async departure => {
        await expect(departure.locator('.ah-departure-member')).toHaveCount(2)
        await assertNoHorizontalOverflow(page)
        await shot(page, testInfo, `epilogue-${label}-congress-departure`)
      },
    })
    expect(congress.session.state.scenario.id).toBe(CONGRESS_ID)
    await waitForPlayableTable(page)
    current = await view(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.scenario.id).toBe(CONGRESS_ID)
    expect(current.state.campaign.flow?.nodeId).toBe(CONGRESS_ID)
    expect(current.state.investigators[0].hand.length).toBeGreaterThan(0)
    expect((current.state.locations || []).length).toBeGreaterThan(0)
    await expect(page.locator('.ah-table')).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText(CONGRESS.name.split(' ')[0])
    const congressMap = mapProjection(current)
    expect(congressMap.current).toBe(FORCED_NODE)
    expect(congressMap.time).toBeGreaterThanOrEqual(FORCED_TIME)
    annotate(testInfo, 'evidence',
      `钥匙议会牌桌：time=${congressMap.time} current=${congressMap.current} hand=${current.state.investigators[0].hand.length} `
      + `locations=${current.state.locations.length} acts=${current.state.acts?.length} agendas=${current.state.agendas?.length}`)
    await assertNoHorizontalOverflow(page)
    await shot(page, testInfo, `epilogue-${label}-congress-table`)

    // i. 真实终章结算（调试加速，已披露）→ 真实 hubContinue → 尾声 → campaignResult。
    current = await finishScenarioThroughDebug(page, hub, sessionId, CONGRESS_ID, {
      resolution: 'resolution1', label: '钥匙议会', testInfo,
    })
    annotate(testInfo, 'claim', 'congressTerminal')
    await shot(page, testInfo, `epilogue-${label}-congress-result`)

    const continued = await clickHubPrimary(page, hub, sessionId, 'hubContinue', '终章：查看结算并进入尾声')
    expect(continued.state.uiState).toBe('campaignResult')
    expect(continued.state.campaign.finished).toBe(true)
    expect(continued.state.campaign.flow?.nodeId).toBe('end')
    const history = continued.state.campaign.flow.history.map(visit => visit.nodeId)
    expect(history, '真实流程必须经过 endgameApproach → congressOfTheKeys → epilogue → end')
      .toEqual(expect.arrayContaining([ENDGAME_NODE_ID, CONGRESS_ID, 'epilogue', 'end']))

    // j. 真实 campaignResult：数据断言 + 尾声正文可见 + 三个结局之一被记录。
    const final = await waitForCampaignResult(page, sessionId)
    const records = final.state.campaign.records
    const outcome = records.campaignOutcome
    const ending = OUTCOMES[outcome]
    expect(ending, `尾声必须记录三个结局之一（实际 campaignOutcome=${JSON.stringify(outcome)}）`).toBeTruthy()
    const marker = ending.marker
    expect(records[ending.record], `尾声结局记录 ${ending.record} 必须为真`).toBe(true)
    expect(final.state.campaign.finished, '战役必须 finished').toBe(true)
    expect(final.state.campaign.flow?.nodeId).toBe('end')
    expect(final.state.status).toBe('over')
    await syncHubState(page, hub, 'campaignResult')
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignResult')
    await expect(page.locator('.bg-game-status').first()).toContainText('战役终章')
    if (!(await hub.locator('.ah-story-page').count())) await hubTab(hub, '调查纪事')
    await expect(hub.locator('.ah-story-page')).toBeVisible({ timeout: 30_000 })
    const storyText = (await hub.locator('.ah-story-page').innerText()).replace(/\s+/g, ' ')
    expect(storyText, '调查纪事必须显示尾声正文').toContain('尾声')
    expect(storyText, '尾声正文必须出现泰勒专员').toContain('泰勒')
    expect(storyText, `尾声正文必须命中 campaignOutcome=${outcome} 的结局段（${marker}）`).toContain(marker)
    annotate(testInfo, 'claim', 'epilogue')
    annotate(testInfo, 'evidence',
      `campaignResult：outcome=${outcome} result=${final.state.campaign.result} `
      + `trust=${records.foundationTrust} deception=${records.cellDeception} `
      + `chapters=${(records.chaptersCompleted || []).length} keysHeld=${(records.keysHeld || []).length} `
      + `erased=${(records.erasedCards || []).length} time=${mapProjection(final)?.time}`)
    await assertNoHorizontalOverflow(page)
    await shot(page, testInfo, `epilogue-${label}-epilogue-story`)

    // 战役终章总览（结局名/阶段）也是真实 UI 证据。
    await hubTab(hub, '战役总览')
    await expect(hub.locator('.ah-office-result')).toBeVisible({ timeout: 30_000 })
    await expect(hub.locator('.ah-office-result')).toContainText('战役终章')
    await shot(page, testInfo, `epilogue-${label}-campaign-result`)

    // k. 无脚本错误、无横向溢出（1px 容差）；控制台 error / 404 资源只登记为证据（不隐藏）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    await assertNoHorizontalOverflow(page)
    if (consoleErrors.length || missingResources.length) {
      annotate(testInfo, 'evidence',
        `控制台 error ${consoleErrors.length} 条；404 资源 ${missingResources.length} 个：`
        + JSON.stringify([...new Set(missingResources)].slice(0, 8)))
    }
  })
}

/** 轮询真实会话直到 campaignResult（放弃/失败收尾也照样给出真实 uiState 便于诊断）。 */
async function waitForCampaignResult(page, sessionId) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const session = await view(page, sessionId)
    if (session.state.uiState === 'campaignResult') return session
    await page.waitForTimeout(150)
  }
  const last = await view(page, sessionId)
  throw new Error(`未到达 campaignResult：uiState=${last.state.uiState} node=${last.state.campaign?.flow?.nodeId} `
    + `status=${last.state.status} outcome=${last.state.campaign?.records?.campaignOutcome}`)
}
