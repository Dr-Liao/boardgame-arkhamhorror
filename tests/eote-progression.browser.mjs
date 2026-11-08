// 《地球边缘》（EotE）P8 战役推进浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// 真实大厅起步，逐章推进整条战役主线：
//   序幕 → 亡命冰原 I → 检查点 I（寻找失踪队员）→ 亡命冰原 II → 检查点 II（留下战斗）
//   → 亡命冰原 III → 幕间 I（升级窗）→ 致命幻景（幕间 I 的可选门；用真实 debug 通道「跳到」进入）
//   → 失落之峰 → 幕间 II（升级窗）→ 古老者之城 → 幕间 III（升级窗）→ 疯狂之心 I
//   → 检查点 III → 疯狂之心 II → 尾声 → 战役结局。
//
// 真实口径（不伪造状态、不做章内夹具）：
//   · 真实大厅 /api/start（战役=地球边缘、2 席=1 真人 + 1 AI）→ 真实局外页 UI 选关/选调查员/
//     自动构筑/确认准备 → 出发准备 → 真实 hubBeginScenario → 序幕的「战役选择」真实待决面板；
//   · 每章：真实牌桌 + 关卡设置指南面板断言 + 真实地点/手牌事实；结算用单机调试通道
//     （host-only POST /api/debug「结束这关」，仍走引擎 finishScenario/结局/XP/记录）作为
//     P8 允许的推进原语，并在账本 annotation debugJump 里显式登记；
//   · 关间：真实局外页按钮 hubContinue → 检查点/幕间面板 → 幕间升级窗（真实 /api/move：
//     hubPurchase + hubConfirmUpgrades）→ hubDoneSeat → 下一章 scenarioSetup；
//     检查点/幕间分支（寻找/留下/无视那扇门）走真实 /api/move choose（与 UI 面板同一协议），
//     并在面板出现时截图记录真实界面；
//   · 记录投影：每关结算后断言 campaign.scenarioResults 增长与 eote 记录（伙伴状态镜像/庇护值），
//     终局断言 8 章全部完成、campaign.finished、尾声正文与纪念记录仍在。
//
// 证据账本：audit/eote-release-browser.json（tools/playwright-eote-release-reporter.mjs，phase=progression）。
import { test, expect } from '@playwright/test'
import { contentRegistry } from '../content/registered.js'
import { EOTE_CHAPTERS, FIRST_CHAPTER, EOTE_CAMPAIGN, openEoteLobby, startEoteGame,
  chooseScenarioThroughUi, prepareSeatThroughUi, beginCurrentChapter, waitForPlayableTable,
  fetchSession, submitMove, submitDebug, settleUi, syncUiToState, dismissPresentation, hubTab, actLegal,
  refreshHubTo, clickSettled, shot, annotate, assertChapterGuide, SHOT_DIR } from './eote-browser-helpers.mjs'

const PROGRESSION_TIMEOUT = 420_000
const INVESTIGATOR = '08001'
const CHAPTER = Object.fromEntries(EOTE_CHAPTERS.map(chapter => [chapter.id, chapter]))
const MAINLINE = EOTE_CHAPTERS.map(chapter => chapter.id)

// 战役分支的真实选项（检查点/幕间门）——按 (章节流程节点 → 选项 id) 定向选择。
const STORY_PREFERENCES = Object.freeze({
  checkpoint1Choice: ['search'],
  checkpoint2Choice: ['stand'],
  interlude1DoorChoice: ['ignore'],
  interlude2Night3Choice: ['ignore'],
  interlude2Night4Choice: ['ignore'],
  interlude3Night3Choice: ['ignore'],
  interlude3Night4Choice: ['ignore'],
})

function eoteLaunchable() {
  try {
    contentRegistry.assertLaunchable(EOTE_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

// 失败现场：截图 + 当前界面快照写入 annotation（仅失败时，便于定位真实大厅/时序问题）。
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const viewport = /mobile/.test(testInfo.title) ? 'mobile' : 'desktop'
  const path = `${SHOT_DIR}p8-progression-${viewport}-failure.png`
  await page.screenshot({ path, fullPage: true, animations: 'disabled' }).catch(() => {})
  testInfo.annotations.push({ type: 'screenshot', description: path })
  const snapshot = await page.evaluate(() => ({
    hub: document.querySelector('.ah-hub')?.getAttribute('data-ui-state') || null,
    table: Boolean(document.querySelector('.ah-table')),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.getAttribute('aria-label')),
    workflow: [...document.querySelectorAll('.ah-workflow-next button')].map(node => (node.textContent || '').slice(0, 40)).slice(0, 4),
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
  })).catch(error => ({ error: String(error) }))
  testInfo.annotations.push({ type: 'failure', description: JSON.stringify(snapshot) })
})

const chapterName = id => CHAPTER[id]?.name || id

/** 从真实会话里取当前事实（不读页面状态）。 */
async function facts(page, sessionId) {
  const session = await fetchSession(page, sessionId)
  expect(session, '真实 /api/session 必须返回会话').toBeTruthy()
  return session
}

/** 用真实 /api/move choose 结算全部待决选择（战役分支按 STORY_PREFERENCES 定向）。 */
async function drainChoices(page, sessionId, preferences = STORY_PREFERENCES) {
  for (let guard = 0; guard < 48; guard++) {
    const session = await facts(page, sessionId)
    const choice = session.state.pendingChoice
    if (!choice) return session
    const ids = (choice.options || []).map(option => String(option.id))
    const nodeId = session.state.campaign?.flow?.nodeId
    const preferred = preferences[nodeId] || []
    const pick = preferred.find(id => ids.includes(id))
      ?? ['done', 'skip', 'self', 'keep'].find(id => ids.includes(id))
      ?? ids[0]
    const move = (session.state.legalMoves || [])
      .find(item => item.action === 'choose' && String(item.optionId) === pick)
      ?? { action: 'choose', choiceId: choice.id, optionId: pick }
    const result = await submitMove(page, sessionId, session.state.revision, move)
    expect(result.payload.ok, `${choice.kind}:${result.payload.error}`).toBe(true)
  }
  return facts(page, sessionId)
}

const hubState = async (hub) => (await hub.count() ? hub.getAttribute('data-ui-state') : 'absent')

/** 等待局外页进入指定 uiState（刷新驱动；真实界面）。 */
async function waitForHubState(page, hub, sessionId, target, label, { timeout = 180_000 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const session = await drainChoices(page, sessionId)
    if (session.state.uiState === target) {
      await settleUi(page)
      const refresh = page.getByRole('button', { name: '刷新', exact: true })
      if (await refresh.count()) await refresh.first().click().catch(() => {})
      await page.waitForTimeout(400)
      if (await hubState(hub) === target) return facts(page, sessionId)
    }
    const refresh = page.getByRole('button', { name: '刷新', exact: true })
    if (await refresh.count()) await refresh.first().click().catch(() => {})
    await page.waitForTimeout(500)
  }
  throw new Error(`等待 ${label} 失败：uiState=${(await facts(page, sessionId)).state.uiState} hub=${await hubState(hub)}`)
}

// 逐章显式结局键（真实 debugCommand「结束这关 <结局>」；避免随机结局把发布门禁绑到未修的结局分支）。
const CHAPTER_RESOLUTIONS = Object.freeze({
  iceAndDeathPart1: 'R1',
  iceAndDeathPart2: 'R1',
  iceAndDeathPart3: 'resolution1',
  fatalMirage: 'victory',
  toTheForbiddenPeaks: 'R1',
  cityOfTheElderThings: 'R1',
  theHeartOfMadnessPart1: 'R1',
  theHeartOfMadnessPart2: 'R1',
})

/** 真实 UI 结束当前关卡（调试通道「结束这关 <结局>」，引擎完整走 finishScenario/结局/XP/记录）。 */
async function finishScenarioThroughDebug(page, hub, sessionId, expectedChapterId) {
  let current = await facts(page, sessionId)
  expect(current.state.uiState).toBe('inScenario')
  expect(current.state.scenario.id).toBe(expectedChapterId)
  const resolution = CHAPTER_RESOLUTIONS[expectedChapterId]
  expect(resolution, `${expectedChapterId} 未登记显式结局键`).toBeTruthy()
  const ended = await submitDebug(page, sessionId, current.state.revision, `结束这关 ${resolution}`)
  expect(ended.payload.ok, ended.payload.error).toBe(true)
  current = await drainChoices(page, sessionId)
  expect(current.state.uiState).toBe('scenarioResult')
  const result = current.state.campaign.scenarioResults.at(-1)
  expect(result, '真实结算记录必须存在').toBeTruthy()
  expect(result.scenarioId).toBe(expectedChapterId)
  // 调试提交不会驱动界面：关掉结局演出后，用真实「刷新局势」把界面同步到局外页结算页。
  await dismissPresentation(page)
  await syncUiToState(page, 'scenarioResult')
  await expect(hub).toHaveAttribute('data-ui-state', 'scenarioResult', { timeout: 30_000 })
  return current
}

/**
 * 真实局外页按钮「查看结算并进入关间准备」（hubContinue）。
 * expect='interlude'：进入检查点/幕间面板；expect='scenarioSetup'：直接回到下一章准备
 * （致命幻景结束后的 fatalMirageReturn 就是这种回场）。
 */
async function continueToInterlude(page, hub, sessionId, { expect: target = 'interlude' } = {}) {
  let current = await facts(page, sessionId)
  expect(current.state.uiState).toBe('scenarioResult')
  // 结算页默认停在剧情页签（该页签下工作流主按钮隐藏）：切到战役总览再点真实主按钮。
  await hubTab(hub, '战役总览')
  await refreshHubTo(page, hub, 'scenarioResult')
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubContinue')
  await clickSettled(page, primary, '查看结算并进入关间准备')
  const body = await (await responded).json()
  expect(body.ok, body.error).toBe(true)
  current = await waitForHubState(page, hub, sessionId, target, `进入 ${target}`)
  if (target === 'interlude') expect(current.state.campaign.flowStage).toMatch(/checkpoint|interlude/)
  return current
}

/** 真实出发准备 → 下一章牌桌（真实 hubBeginScenario）。 */
async function beginChapterThroughUi(page, hub, sessionId, chapterId, testInfo, viewportLabel) {
  const chapter = CHAPTER[chapterId]
  expect(chapter, `未知章节 ${chapterId}`).toBeTruthy()
  const setup = await waitForHubState(page, hub, sessionId, 'scenarioSetup', `${chapterId} 出发准备`)
  expect(setup.state.hubSelectedScenarioId, `下一章应为 ${chapterId}`).toBe(chapterId)
  const { session } = await beginCurrentChapter(page, hub, {
    chapterName: chapter.name,
    beforeBegin: async departure => {
      await expect(departure.locator('h2')).toContainText(chapter.name)
      await shot(page, testInfo, `p8-progression-${viewportLabel}-${chapterId}-departure`)
    },
  })
  await waitForPlayableTable(page)
  const current = await facts(page, sessionId)
  expect(current.state.uiState).toBe('inScenario')
  expect(current.state.scenario.id).toBe(chapterId)
  expect(current.state.investigators[0].code).toBe(INVESTIGATOR)
  expect(current.state.investigators[0].hand.length).toBeGreaterThan(0)
  expect((current.state.locations || []).length).toBeGreaterThan(0)
  await expect(page.locator('.ah-table')).toBeVisible()
  await expect(page.locator('.bg-game-title').first()).toContainText(chapter.name.split(' ')[0])
  await assertChapterGuide(page, testInfo, viewportLabel, chapter)
  await shot(page, testInfo, `p8-progression-${viewportLabel}-${chapterId}-table`)
  annotate(testInfo, 'evidence',
    `${chapterId}：hand=${current.state.investigators[0].hand.length}，locations=${current.state.locations.length}，`
    + `actionsLeft=${current.state.investigators[0].actionsLeft}`)
  return current
}

/**
 * 完成检查点/幕间：可选真实升级（hubPurchase + hubConfirmUpgrades）→ 真实 UI hubDoneSeat →
 * 真实 /api/move choose 结算检查点分支/幕间门 → 下一章 scenarioSetup 或战役结局。
 */
async function completeInterludeThroughUi(page, hub, sessionId, testInfo, viewportLabel, nodeId, { allowUpgrade = true } = {}) {
  let current = await waitForHubState(page, hub, sessionId, 'interlude', `${nodeId} 幕间面板`)
  expect(current.state.campaign.flow?.nodeId).toBe(nodeId)
  const upgradesAllowed = current.state.campaign.upgradesAllowed === true
  expect(upgradesAllowed, `${nodeId} 的升级窗权限`).toBe(nodeId.startsWith('interlude'))
  const briefing = hub.locator('.ah-hub-interlude')
  await expect(briefing).toBeVisible({ timeout: 30_000 })
  expect((await briefing.innerText()).trim().length, `${nodeId} 幕间/检查点正文`).toBeGreaterThan(0)
  await shot(page, testInfo, `p8-progression-${viewportLabel}-${nodeId}`)
  annotate(testInfo, 'evidence',
    `${nodeId}：uiState=interlude，upgradesAllowed=${upgradesAllowed}，flow.nodeId=${nodeId}，`
    + `records.eoteEliminatedPartners=${current.state.campaign.records?.eoteEliminatedPartners ?? 0}`)

  if (allowUpgrade && upgradesAllowed) {
    // 真实升级窗：升级面板 + 真实 /api/move 提交一次合法购入/替换并保存。
    await hubTab(hub, '升级')
    await expect(hub.getByRole('heading', { name: '升级与关间准备', exact: true })).toBeVisible({ timeout: 30_000 })
    await shot(page, testInfo, `p8-progression-${viewportLabel}-${nodeId}-upgrade`)
    const before = await facts(page, sessionId)
    expect(before.state.campaign.upgradesAllowed).toBe(true)
    const purchaseMove = (before.state.legalMoves || []).find(move => move.action === 'hubPurchase')
    if (purchaseMove) {
      const xpBefore = before.state.campaign.investigators[0].xp
      const purchased = await actLegal(page, sessionId, 'hubPurchase')
      expect(purchased.session.state.campaign.investigators[0].upgradeDraft, '真实购入后应生成升级草稿').toBeTruthy()
      const confirmed = await actLegal(page, sessionId, 'hubConfirmUpgrades')
      const record = confirmed.session.state.campaign.investigators[0]
      expect(record.xp).toBeLessThan(xpBefore)
      expect(record.purchases.some(item => item.scenarioIndex === confirmed.session.state.campaign.scenarioIndex)).toBe(true)
      expect(record.upgradeDraft).toBeFalsy()
      await refreshHubTo(page, hub, 'interlude')
      await settleUi(page)
      await shot(page, testInfo, `p8-progression-${viewportLabel}-${nodeId}-upgrade-saved`)
      annotate(testInfo, 'evidence',
        `${nodeId} 升级：XP ${xpBefore}→${record.xp}，purchases=${record.purchases.length}，scenarioIndex=${confirmed.session.state.campaign.scenarioIndex}`)
    } else {
      annotate(testInfo, 'evidence', `${nodeId}：当前会话没有可支付的合法升级（保留 XP 继续）。`)
    }
  }

  // 真实 UI：战役总览页签的「完成关间准备 / 保留 XP 并继续 / 完成升级」主按钮（hubDoneSeat）。
  for (let guard = 0; guard < 12; guard++) {
    current = await drainChoices(page, sessionId)
    if (current.state.uiState !== 'interlude') break
    await hubTab(hub, '战役总览').catch(() => {})
    const refresh = page.getByRole('button', { name: '刷新', exact: true })
    if (await refresh.count()) await refresh.first().click().catch(() => {})
    await page.waitForTimeout(350)
    const primary = hub.locator('.ah-workflow-next button').first()
    if (!(await primary.count()) || !(await primary.isVisible().catch(() => false))) {
      await page.waitForTimeout(400)
      continue
    }
    const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 30_000 })
    await clickSettled(page, primary, `${nodeId} 完成准备`)
    const body = await (await responded).json()
    expect(body.ok, body.error).toBe(true)
    // 分支面板出现时截图（真实界面证据），随后用真实 choose 结算。
    const dialog = hub.locator('[role="dialog"][aria-label="战役选择"]')
    if (await dialog.count()) {
      await shot(page, testInfo, `p8-progression-${viewportLabel}-${nodeId}-choice`)
    }
    current = await drainChoices(page, sessionId)
  }

  const finalState = await drainChoices(page, sessionId)
  expect(['scenarioSetup', 'campaignResult']).toContain(finalState.state.uiState)
  return { session: finalState, upgradesAllowed }
}

/** 断言真实记录投影：结算行增长 + EotE 伙伴状态镜像/庇护值记录存在。 */
function assertRecordProjection(session, expectedCount) {
  const campaign = session.state.campaign
  expect(campaign.scenarioResults.length, '真实结算记录数').toBe(expectedCount)
  expect(Object.keys(campaign.records || {}), '战役记录必须含 EotE 伙伴状态镜像')
    .toEqual(expect.arrayContaining(['eotePartnerStatuses']))
  expect(Object.hasOwn(campaign.records, 'eoteShelterValue'), '战役记录必须含营地庇护值').toBe(true)
  const eote = campaign.eote || {}
  expect(Object.keys(eote), 'campaign.eote 投影').toEqual(expect.arrayContaining(['partners', 'supplies', 'seals']))
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P8 战役推进：真实大厅逐章推进八章→检查点/幕间/升级→尾声（${label} ${width}×${height}）`, async ({ page }, testInfo) => {
    test.skip(!eoteLaunchable(), 'EotE 尚未在 content/registered.js 注册为可启动战役（等待 P8 生产注册）')
    testInfo.setTimeout(PROGRESSION_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'progression')
    annotate(testInfo, 'scenario', FIRST_CHAPTER.id)
    annotate(testInfo, 'debugJump',
      'POST /api/debug（host-only，真实 debugCommand + 事务提交）：「给 20 经验」「结束这关」逐章结算；'
      + '「跳到 fatalMirage」进入幕间 I 的可选幻景门。其余全部是真实大厅/真实 /api/move/真实 UI。')

    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    // a. 真实大厅 → 第一章牌桌（与发布门禁同一真实路径）。
    const setup = await openEoteLobby(page)
    const { session, hub } = await startEoteGame(page, setup, { seats: 2 })
    const sessionId = session.sessionId
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })
    await prepareSeatThroughUi(page, hub, { code: INVESTIGATOR })
    await beginChapterThroughUi(page, hub, sessionId, 'iceAndDeathPart1', testInfo, label)
    let current = await facts(page, sessionId)
    expect(current.state.campaign.scenarioResults.length).toBe(0)

    // b. 真实调试通道制造 XP，保证幕间升级窗有可购买项。
    const xpGrant = await submitDebug(page, sessionId, current.state.revision, '给 20 经验')
    expect(xpGrant.payload.ok, xpGrant.payload.error).toBe(true)
    current = await drainChoices(page, sessionId)
    expect(current.state.campaign.investigators[0].xp).toBeGreaterThanOrEqual(20)

    // c. 亡命冰原 I → 检查点 I（真实结算 + 真实局外页按钮）→ 检查点 I 分支「去寻找失踪队员」。
    expect((await finishScenarioThroughDebug(page, hub, sessionId, 'iceAndDeathPart1')).state.uiState).toBe('scenarioResult')
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('checkpoint1')
    expect(current.state.campaign.flowStage).toBe('checkpoint')
    assertRecordProjection(current, 1)
    await shot(page, testInfo, `p8-progression-${label}-checkpoint1-result`)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'checkpoint1', { allowUpgrade: false })

    // d. 亡命冰原 II → 检查点 II（分支「留下战斗」）→ 亡命冰原 III。
    await beginChapterThroughUi(page, hub, sessionId, 'iceAndDeathPart2', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'iceAndDeathPart2')
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('checkpoint2')
    assertRecordProjection(current, 2)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'checkpoint2', { allowUpgrade: false })
    await beginChapterThroughUi(page, hub, sessionId, 'iceAndDeathPart3', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'iceAndDeathPart3')

    // e. 幕间 I（升级窗）：真实 /api/move 购入并保存升级 → 下一章（失落之峰 scenarioSetup）。
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('interlude1')
    expect(current.state.campaign.upgradesAllowed).toBe(true)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'interlude1')
    current = await facts(page, sessionId)
    expect(current.state.uiState).toBe('scenarioSetup')
    expect(current.state.hubSelectedScenarioId).toBe('toTheForbiddenPeaks')

    // f. 致命幻景（幕间 I 的可选门）：调试「跳到」仍需真实 startScenario + 真实牌桌/指南。
    const jumpFatal = await submitDebug(page, sessionId, current.state.revision, '跳到 fatalMirage')
    expect(jumpFatal.payload.ok, jumpFatal.payload.error).toBe(true)
    await drainChoices(page, sessionId)
    // 调试提交后界面仍停在局外页：反复点真实「刷新局势 / 刷新」把会话拉回界面，直到牌桌挂载。
    const table = page.locator('.ah-table')
    for (let attempt = 0; attempt < 60; attempt++) {
      await dismissPresentation(page)
      await settleUi(page)
      if (await table.count() && await table.first().isVisible()) break
      const tableRefresh = page.getByRole('button', { name: '刷新局势' })
      const hubRefresh = page.getByRole('button', { name: '刷新', exact: true })
      if (await tableRefresh.count()) await tableRefresh.first().click().catch(() => {})
      else if (await hubRefresh.count()) await hubRefresh.first().click().catch(() => {})
      await page.waitForTimeout(600)
    }
    await expect(table).toBeVisible({ timeout: 60_000 })
    await waitForPlayableTable(page)
    current = await facts(page, sessionId)
    expect(current.state.scenario.id).toBe('fatalMirage')
    await expect(page.locator('.bg-game-title').first()).toContainText(chapterName('fatalMirage').split(' ')[0])
    await assertChapterGuide(page, testInfo, label, CHAPTER.fatalMirage)
    await shot(page, testInfo, `p8-progression-${label}-fatalMirage-table`)
    await finishScenarioThroughDebug(page, hub, sessionId, 'fatalMirage')

    // g. 失落之峰（从致命幻景返回的真实 stepReturn）→ 幕间 II → 古老者之城。
    current = await continueToInterlude(page, hub, sessionId, { expect: 'scenarioSetup' })
    expect(current.state.uiState).toBe('scenarioSetup')
    expect(current.state.hubSelectedScenarioId).toBe('toTheForbiddenPeaks')
    await beginChapterThroughUi(page, hub, sessionId, 'toTheForbiddenPeaks', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'toTheForbiddenPeaks')
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('interlude2')
    assertRecordProjection(current, 5)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'interlude2')
    await beginChapterThroughUi(page, hub, sessionId, 'cityOfTheElderThings', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'cityOfTheElderThings')

    // h. 幕间 III → 疯狂之心 I → 检查点 III → 疯狂之心 II。
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('interlude3')
    assertRecordProjection(current, 6)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'interlude3')
    await beginChapterThroughUi(page, hub, sessionId, 'theHeartOfMadnessPart1', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'theHeartOfMadnessPart1')
    current = await continueToInterlude(page, hub, sessionId)
    expect(current.state.campaign.flow?.nodeId).toBe('checkpoint3')
    expect(current.state.campaign.upgradesAllowed).toBe(false)
    assertRecordProjection(current, 7)
    await completeInterludeThroughUi(page, hub, sessionId, testInfo, label, 'checkpoint3', { allowUpgrade: false })
    await beginChapterThroughUi(page, hub, sessionId, 'theHeartOfMadnessPart2', testInfo, label)
    await finishScenarioThroughDebug(page, hub, sessionId, 'theHeartOfMadnessPart2')

    // i. 尾声与战役结局：真实 hubContinue 走完尾声子图（连续幕间口径）→ campaignResult。
    current = await facts(page, sessionId)
    expect(current.state.uiState).toBe('scenarioResult')
    await hubTab(hub, '战役总览')
    await refreshHubTo(page, hub, 'scenarioResult')
    const primary = hub.locator('.ah-workflow-next button').first()
    await expect(primary).toBeVisible({ timeout: 30_000 })
    const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubContinue')
    await clickSettled(page, primary, '查看结算并进入尾声')
    const epilogueBody = await (await responded).json()
    expect(epilogueBody.ok, epilogueBody.error).toBe(true)
    current = await drainChoices(page, sessionId)
    const deadlineResult = Date.now() + 120_000
    while (Date.now() < deadlineResult) {
      current = await drainChoices(page, sessionId)
      if (current.state.uiState === 'campaignResult') break
      const refresh = page.getByRole('button', { name: '刷新', exact: true })
      if (await refresh.count()) await refresh.first().click().catch(() => {})
      await page.waitForTimeout(500)
    }
    expect(current.state.uiState).toBe('campaignResult')
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignResult', { timeout: 30_000 })
    expect(current.state.status).toBe('over')
    expect(current.state.campaign.finished).toBe(true)
    await expect(page.locator('body')).toContainText('战役已完成')
    const finishedResults = current.state.campaign.scenarioResults.map(result => result.scenarioId)
    expect([...new Set(finishedResults)].sort(), '8 章全部出现在真实结算记录里')
      .toEqual([...MAINLINE].sort())
    assertRecordProjection(current, 8)
    const finalCampaign = current.state.campaign
    // campaign.eote 的真实投影形状：partners = { roster, ... }、supplies/seals 同层。
    expect(Array.isArray(finalCampaign.eote.partners?.roster), '伙伴名册投影应为数组').toBe(true)
    expect(finalCampaign.eote.partners.roster.length).toBeGreaterThan(0)
    expect(Object.keys(finalCampaign.records.eotePartnerStatuses || {}).length).toBeGreaterThan(0)
    expect(Object.keys(finalCampaign.records).some(key => /suppliesRecovered|eoteShelterValue|seal/i.test(key)),
      `战役记录键：${JSON.stringify(Object.keys(finalCampaign.records))}`).toBe(true)
    annotate(testInfo, 'evidence',
      `八章结算=${JSON.stringify([...new Set(finishedResults)])}；campaign.finished=${finalCampaign.finished}；`
      + `记录键=${JSON.stringify(Object.keys(finalCampaign.records).filter(key => /eote|supplies|seal|partner|memor/i.test(key)))}`)
    await shot(page, testInfo, `p8-progression-${label}-campaign-result`)
    await settleUi(page)

    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
  })
}
