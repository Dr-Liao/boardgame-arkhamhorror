// 八循环《绯红密钥》（The Scarlet Keys）P8 大厅定制升级卡浏览器验收（桌面 1440×900 / 移动 390×844）。
//
// 独立于 D 的发布 spec（tests/tsk-release.browser.mjs）与本循环其它证据链；本文件只证明
// docs/campaign/theScarletKeys/README.md P8 清单第 3 项的「构筑期初始勾选 + 关间升级勾选」：
//
//   1) 真实大厅 catalog → 绯红密钥（/api/start）→ 关卡选择（真实 hubSelectScenario）→
//      hubGoSetup → 调查员 02002（雷克斯·墨菲）→ 保存包含 09042「鸦翎羽毛笔」的合法牌组；
//   2) 卡组构筑页顶部出现「定制升级卡」面板（真实观察投影 mechanics.tsk.customizationHub）：
//      data-hub-customization、初始态、0 勾选、0 XP、**没有**勾选按钮（截图 custom-initial-*）；
//   3) 真实 hubDoneSeat → 出发准备 → 真实 hubBeginScenario → 牌桌；
//   4) host-only /api/debug「结束这关」（真实 finishScenario/结局/记录）→ 真实 hubContinue →
//      幕间 I（真实 interlude 节点、开放升级窗）；
//   5) host-only /api/debug「给 3 经验」（真实 awardExperience）→ 刷新 → 升级页面板给出真实
//      hubCustomize 按钮（截图 custom-interlude-*）→ 真实点选一格 → 投影 checked/level 变化、
//      XP 3→2（截图 custom-interlude-upgraded-*）；
//   6) 真实「刷新」（GET /api/session 服务端权威状态）后同一会话的勾选与剩余 2 XP 仍在
//      （截图 custom-refresh-*）。
//
// 说明：不做整页刷新后「读取此存档」的续玩证据——本次运行中它被一个与本链无关的既有内容缺口挡住
// （`unknownCardCodes` 在若干局面里命中缺失卡号 09519，存档迁移报「卡牌已不存在，无法升级」）；
// 真实刷新（服务端 GET /api/session）已足以证明勾选/经验落在服务端权威状态、不是前端缓存。
//
// 真实口径：不 page.route 改写 /api/start、/api/session、/api/move、/api/debug；不写 session.state；
// 牌组保存和定制勾选均走真实 legalMoves + /api/move。
// 跨过整章只用 host-only 调试通道（与大厅「结束这关」同一 finishScenario 路径），并在每个用例的
// debugJump annotation 里披露。
//
// 证据账本：audit/tsk-customization-browser.json（tools/playwright-tsk-customization-reporter.mjs）。
import { test, expect } from '@playwright/test'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'
import {
  TSK_CAMPAIGN, FIRST_CHAPTER, openTskLobby, startTskGame, chooseScenarioThroughUi,
  beginCurrentChapter, waitForPlayableTable, fetchSession, submitDebug, submitMove, settlePendingChoices,
  syncUiToState, hubTab, clickSettled, settleUi, shot, annotate,
} from './tsk-browser-helpers.mjs'

const SPEC_TIMEOUT = 480_000
const CUSTOM_INVESTIGATOR = '02002'
const CUSTOM_CODE = '09042'
const CUSTOM_NAME = ALL_CARDS[CUSTOM_CODE]?.nameZh || 'Quill of the Birds'
const INVESTIGATOR_NAME = ALL_CARDS[CUSTOM_INVESTIGATOR]?.nameZh || CUSTOM_INVESTIGATOR
const XP_GRANT = 3

function tskLaunchable() {
  try {
    contentRegistry.assertLaunchable(TSK_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const panelOf = hub => hub.locator('[data-hub-customization="true"]')
const optionButtons = panel => panel.locator('[data-hub-customize-option]')
const sessionOf = async (page, sessionId) => {
  const session = await fetchSession(page, sessionId)
  expect(session, '真实 /api/session 必须返回会话').toBeTruthy()
  return session
}
const customizationOf = session => session?.state?.mechanics?.tsk?.customizationHub || null
const deckOf = session => session?.state?.campaign?.investigators?.[0]?.deck || []

/** 关闭可能遮住局外页的演出/待决面板（真实按钮）。 */
async function clearOverlays(page) {
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.first().click({ timeout: 3000 }).catch(() => {})
  const next = page.getByRole('dialog').getByRole('button', { name: '继续', exact: true })
  if (await next.count()) await next.first().click({ timeout: 3000 }).catch(() => {})
}

/** 真实局外页主按钮：从「战役总览」页签点工作流主按钮并等待对应 /api/move。 */
async function clickPrimary(page, hub, expectedAction, label) {
  await hubTab(hub, '战役总览').catch(() => {})
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 60_000 })
  await clickSettled(page, primary, label || expectedAction)
  const response = await responded
  const body = await response.json()
  expect(body.ok, body.error).toBe(true)
  const posted = response.request().postDataJSON()?.move?.action
  if (posted) expect(posted, `真实主按钮应提交 ${expectedAction}`).toBe(expectedAction)
  return body.session
}

/** 首章前用真实大厅提交一副包含鸦翎羽毛笔的合法牌组。 */
async function prepareCustomSeat(page, hub, sessionId) {
  await clearOverlays(page)
  await clickPrimary(page, hub, 'hubGoSetup', '配置调查员与卡组')
  await expect(hub).toHaveAttribute('data-ui-state', 'scenarioSetup')
  const select = hub.getByRole('button', {
    name: new RegExp(`^选择调查员：${escapeRegExp(INVESTIGATOR_NAME)}`),
  }).first()
  const selected = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubSelectInvestigator')
  await clickSettled(page, select, `选择调查员：${INVESTIGATOR_NAME}`)
  const selectedBody = await (await selected).json()
  expect(selectedBody.ok, selectedBody.error).toBe(true)

  const auto = hub.getByRole('button', { name: '使用推荐卡组', exact: true }).first()
  const built = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubSetDeck')
  await clickSettled(page, auto, '使用推荐卡组')
  const response = await built
  const builtBody = await response.json()
  expect(builtBody.ok, builtBody.error).toBe(true)
  const session = builtBody.session
  expect(session.state.investigators[0].code).toBe(CUSTOM_INVESTIGATOR)
  if (deckOf(session).includes(CUSTOM_CODE)) return session

  const codes = response.request().postDataJSON().move.codes.slice()
  const replacement = codes.findIndex(code => ALL_CARDS[code]?.klass === ALL_CARDS[CUSTOM_CODE].klass)
  expect(replacement).toBeGreaterThanOrEqual(0)
  codes[replacement] = CUSTOM_CODE
  const saved = await submitMove(page, sessionId, session.state.revision, { action: 'hubSetDeck', codes })
  expect(saved.payload.ok, saved.payload.error).toBe(true)
  await syncUiToState(page, 'scenarioSetup')
  return saved.payload.session
}

/** 首章前场景准备下的定制面板断言（初始态、0 勾选、无勾选按钮）。 */
async function assertInitialPanel(page, hub, session, testInfo, label) {
  const projection = customizationOf(session)
  expect(projection, 'scenarioSetup 必须投影 tsk.customizationHub').toBeTruthy()
  expect(projection.availableXp).toBe(0)
  const entry = projection.entries.find(item => item.code === CUSTOM_CODE)
  expect(entry, `投影条目必须包含 ${CUSTOM_CODE}`).toBeTruthy()
  expect(entry.name).toBe(CUSTOM_NAME)
  expect(entry.checked).toEqual([])
  expect(entry.level).toBe(0)
  expect(entry.canUpgrade).toBe(false)
  expect(entry.options.length).toBeGreaterThanOrEqual(7)

  const panel = panelOf(hub)
  await expect(panel).toBeVisible({ timeout: 30_000 })
  await expect(panel).toHaveAttribute('data-hub-customize-state', 'initial')
  await expect(panel).toHaveAttribute('data-hub-customize-xp', '0')
  await expect(panel.locator('h2')).toContainText('定制升级卡')
  await expect(panel).toContainText(CUSTOM_NAME)
  await expect(panel).toContainText('初始勾选：0 格')
  await expect(panel.locator(`[data-hub-customize-level="0"]`)).toHaveCount(1)
  await expect(panel.locator('[data-hub-customize-card-xp="0"]')).toHaveCount(1)
  const quill = panel.locator(`[data-hub-customize-card="${CUSTOM_CODE}"]`)
  const namedAsset = quill.getByRole('combobox', { name: '选择书籍或法术支援 1' })
  const deckTitles = new Set(deckOf(session).map(code => ALL_CARDS[code])
    .filter(card => card?.type === 'asset' && card.traits?.some(trait => trait === 'Tome' || trait === 'Spell'))
    .map(card => card.name))
  expect(deckTitles.size).toBeGreaterThan(0)
  await expect(namedAsset).toBeVisible()
  const options = await namedAsset.locator('option').evaluateAll(items => items.map(item => item.value))
  expect(options.slice(1).sort()).toEqual([...deckTitles].sort())
  await settleUi(page)
  await expect(async () => {
    await namedAsset.selectOption(options[1], { timeout: 3000 })
    await quill.getByRole('button', { name: '确认选择' }).click({ timeout: 3000 })
  }).toPass({ timeout: 15_000 })
  await expect(quill.getByText(/已记录/)).toBeVisible()
  const preview = quill.locator(`button[data-zoom-code="${CUSTOM_CODE}"]`)
  await expect(async () => {
    await preview.scrollIntoViewIfNeeded({ timeout: 3000 })
  }).toPass({ timeout: 15_000 })
  await expect(preview.locator('.ah-table-art')).toHaveAttribute('data-image-state', 'displayable')
  const artBounds = await preview.boundingBox()
  const listBounds = await quill.locator('ul').boundingBox()
  if (label === 'mobile') expect(artBounds.y + artBounds.height).toBeLessThanOrEqual(listBounds.y)
  else expect(artBounds.x + artBounds.width).toBeLessThanOrEqual(listBounds.x)
  await expect(quill.getByRole('checkbox')).toHaveCount(entry.options.reduce((sum, option) => sum + option.checks, 0))
  await expect(quill.getByRole('checkbox', { checked: true })).toHaveCount(0)
  const livingQuill = quill.locator('details').filter({ hasText: '笔如有神' })
  await expect(livingQuill).toBeVisible()
  await expect(livingQuill.locator('p')).toBeHidden()
  await expect(livingQuill.locator('summary')).toHaveText('笔如有神')
  await expect(quill.getByRole('checkbox', { name: '笔如有神第 1 格' })).toBeDisabled()
  await livingQuill.locator('summary').click()
  await expect(livingQuill.locator('p')).toBeVisible()
  await expect(livingQuill.locator('p')).toContainText('不会触发趁乱攻击')
  const supernatural = quill.locator('li').filter({ hasText: '神奇记录' })
  await expect(supernatural).not.toContainText('Supernatural Record')
  await expect(supernatural.locator('button')).toHaveCount(0)
  await expect(supernatural.getByRole('checkbox', { checked: false })).toHaveCount(4)
  await supernatural.locator('summary').click()
  await expect(supernatural.locator('p')).toBeVisible()
  expect(await optionButtons(panel).count(), '初始构筑期不得渲染勾选按钮').toBe(0)
  const moves = (session.state.legalMoves || []).filter(move => move.action === 'hubCustomize')
  expect(moves, '0 XP 的初始构筑期不得给出 hubCustomize 候选').toEqual([])
  await shot(page, testInfo, `custom-initial-${label}`)
}

/** 幕间面板断言 + 真实点选一格。 */
async function upgradeThroughPanel(page, hub, sessionId, testInfo, label) {
  let session = await sessionOf(page, sessionId)
  expect(session.state.uiState, '首章结算后应进入幕间').toBe('interlude')
  const projection = customizationOf(session)
  expect(projection?.availableXp, `幕间应发到 ${XP_GRANT} XP`).toBe(XP_GRANT)
  const entry = projection.entries.find(item => item.code === CUSTOM_CODE)
  expect(entry.checked).toEqual([])

  await hubTab(hub, '升级')
  const panel = panelOf(hub)
  await expect(panel).toBeVisible({ timeout: 30_000 })
  await expect(panel).toHaveAttribute('data-hub-customize-state', 'interlude')
  await expect(panel).toHaveAttribute('data-hub-customize-xp', String(XP_GRANT))
  await expect(panel.locator(`[data-hub-customize-card-xp="${XP_GRANT}"]`)).toHaveCount(1)
  await expect(panel).toContainText(`剩余经验 ${XP_GRANT} XP`)
  const buttons = optionButtons(panel.locator(`[data-hub-customize-card="${CUSTOM_CODE}"]`))
  await expect(buttons.first()).toBeVisible({ timeout: 30_000 })
  expect(await buttons.count(), '每个仍有空位的选项都应有一个勾选按钮').toBe(7)
  await expect(buttons.first()).toHaveAttribute('title', '为笔如有神勾选 1 格（1 XP）')
  // 幕间纪事在面板上方：把面板滚到吸顶头部/页签下方再截图（证据必须看得见勾选按钮）。
  await panel.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
  await page.waitForTimeout(150)
  await shot(page, testInfo, `custom-interlude-${label}`)

  const target = panel.locator(`[data-hub-customize-option="${CUSTOM_CODE}:0"]`)
  await expect(target).toBeVisible({ timeout: 30_000 })
  await expect(target).toHaveAccessibleName('为笔如有神勾选 1 格（1 XP）')
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubCustomize')
  await clickSettled(page, target, '定制勾选第一格')
  const response = await responded
  const body = await response.json()
  expect(body.ok, body.error).toBe(true)
  const posted = response.request().postDataJSON()?.move || {}
  expect(posted.code).toBe(CUSTOM_CODE)
  expect(posted.optionIndex).toBe(0)
  expect(posted.cost).toBe(1)
  expect(posted.availableXp).toBe(XP_GRANT)

  session = await sessionOf(page, sessionId)
  expect(session.state.campaign.tsk.customizations.bySeat[0][CUSTOM_CODE]).toEqual([0])
  expect(session.state.campaign.investigators[0].xp).toBe(XP_GRANT - 1)
  expect(session.state.campaign.investigators[0].spentXp).toBe(1)
  const after = customizationOf(session)
  expect(after.availableXp).toBe(XP_GRANT - 1)
  const afterEntry = after.entries.find(item => item.code === CUSTOM_CODE)
  expect(afterEntry.checked).toEqual([0])
  expect(afterEntry.level).toBe(1)
  expect(afterEntry.options[0].checkedCount).toBe(1)
  await expect(panel).toHaveAttribute('data-hub-customize-xp', String(XP_GRANT - 1))
  await expect(panel.locator('[data-hub-customize-level="1"]')).toHaveCount(1)
  await expect(panel.locator(`[data-hub-customize-card-xp="${XP_GRANT - 1}"]`)).toHaveCount(1)
  await expect(panel).toContainText(`剩余经验 ${XP_GRANT - 1} XP`)
  await expect(panel.getByRole('checkbox', { name: '笔如有神第 1 格' })).toBeChecked()
  await panel.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
  await page.waitForTimeout(150)
  await shot(page, testInfo, `custom-interlude-upgraded-${label}`)
  return session
}

// ---------------------------------------------------------------------------
// 2 个 spec：desktop 1440×900 / mobile 390×844（真实大厅，无状态注入）
// ---------------------------------------------------------------------------
for (const [label, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P8 定制卡 ${label}：真实大厅构筑期 0 勾选 → 幕间用 XP 勾选一格 → 刷新保留`, async ({ page }, testInfo) => {
    test.skip(!tskLaunchable(), 'theScarletKeys 尚未在 content/registered.js 注册为可启动战役')
    testInfo.setTimeout(SPEC_TIMEOUT)
    page.setDefaultTimeout(60_000)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'customization')
    annotate(testInfo, 'scenario', FIRST_CHAPTER.id)
    annotate(testInfo, 'investigator', `${CUSTOM_INVESTIGATOR} ${INVESTIGATOR_NAME}`)
    annotate(testInfo, 'card', `${CUSTOM_CODE} ${CUSTOM_NAME}`)
    annotate(testInfo, 'debugJump',
      'POST /api/debug（host-only，真实 debugCommand + 事务提交）两次：「结束这关」把首章推进到真实关末结算；'
      + `「给 ${XP_GRANT} 经验」经真实 awardExperience 发放幕间经验（首章 0 胜利点自然结算为 0 XP）。`
      + '选人/自动构筑/勾选/刷新全部经由真实 UI 与 /api/move。')

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

    // a. 真实大厅 → 绯红密钥（单人席位；本链只验证定制勾选，AI 席位不是被测对象）→ 关卡选择。
    const setup = await openTskLobby(page)
    await shot(page, testInfo, `custom-lobby-${label}`)
    const { session, hub } = await startTskGame(page, setup, { seats: 1 })
    const sessionId = session.sessionId
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })

    // b. 首章前准备：真实选人并保存含定制卡的牌组。
    let current = await prepareCustomSeat(page, hub, sessionId)
    expect(deckOf(current)).toContain(CUSTOM_CODE)

    // c. 卡组构筑页顶部的定制面板：初始 0 勾选、0 XP、没有按钮。
    await hubTab(hub, '卡组构筑')
    await assertInitialPanel(page, hub, current, testInfo, label)
    annotate(testInfo, 'check', 'initial')

    // d. 确认准备（真实 hubDoneSeat）→ 出发准备。
    current = await sessionOf(page, sessionId)
    if (current.state.legalMoves.some(move => move.action === 'hubConfirmDeck')) {
      const confirmed = await submitMove(page, sessionId, current.state.revision, { action: 'hubConfirmDeck' })
      expect(confirmed.payload.ok, confirmed.payload.error).toBe(true)
      await syncUiToState(page, 'scenarioSetup')
      current = confirmed.payload.session
    }
    if (!current.state.hubReady) {
      await clickPrimary(page, hub, 'hubDoneSeat', '确认准备')
      current = await sessionOf(page, sessionId)
    }
    expect(current.state.hubReady, '全桌应已准备').toBe(true)
    annotate(testInfo, 'evidence',
      `首章前：座位 0=${CUSTOM_INVESTIGATOR} ${INVESTIGATOR_NAME}；牌组合 ${CUSTOM_CODE} ${CUSTOM_NAME}；`
      + `定制勾选 ${JSON.stringify(customizationOf(current)?.entries.map(item => item.checked))}；hubReady=${current.state.hubReady}`)

    // e. 真实开始首章 → 牌桌。
    await beginCurrentChapter(page, hub, {
      chapterName: FIRST_CHAPTER.name,
      beforeBegin: async () => { await shot(page, testInfo, `custom-departure-${label}`) },
    })
    await waitForPlayableTable(page)
    current = await sessionOf(page, sessionId)
    expect(current.state.uiState).toBe('inScenario')
    expect(current.state.scenario.id).toBe(FIRST_CHAPTER.id)

    // f. 真实关末结算（host-only debug，同一 finishScenario）→ 真实 hubContinue → 幕间 I。
    const ended = await submitDebug(page, sessionId, current.state.revision, '结束这关')
    expect(ended.payload.ok, ended.payload.error).toBe(true)
    current = await settlePendingChoices(page, sessionId)
    expect(current.state.uiState, '关末应停在结算页').toBe('scenarioResult')
    await syncUiToState(page, 'scenarioResult')
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioResult')

    const continued = await clickPrimary(page, hub, 'hubContinue', '查看结算并进入关间准备')
    expect(continued.state.uiState).toBe('interlude')
    expect(continued.state.campaign.flow.nodeId, '首章结算后应停在幕间 I（interlude1）').toBe('interlude1')
    // 幕间经验：真实 host-only 调试通道（awardExperience）。首章 0 胜利点自然结算为 0 XP。
    const granted = await submitDebug(page, sessionId, continued.state.revision, `给 ${XP_GRANT} 经验`)
    expect(granted.payload.ok, granted.payload.error).toBe(true)
    await syncUiToState(page, 'interlude')
    await settleUi(page)
    await expect(hub).toHaveAttribute('data-ui-state', 'interlude')

    // g. 升级页面板：真实 hubCustomize 按钮 → 落实一格。
    current = await upgradeThroughPanel(page, hub, sessionId, testInfo, label)
    annotate(testInfo, 'check', 'upgrade')
    annotate(testInfo, 'evidence',
      `幕间勾选：${CUSTOM_CODE} ${CUSTOM_NAME} 第 1 格；bySeat=${JSON.stringify(current.state.campaign.tsk.customizations.bySeat[0])}；`
      + `剩余 XP=${current.state.campaign.investigators[0].xp}；level=${customizationOf(current).entries[0].level}`)

    // h. 真实「刷新」（GET /api/session，服务端权威状态）后勾选与剩余 XP 仍在：
    //    刷新会重取会话并重绘局外页，面板值必须来自服务端而不是前端缓存。
    const beforeRefresh = await sessionOf(page, sessionId)
    await hubTab(hub, '战役总览')
    const refresh = page.getByRole('button', { name: '刷新', exact: true })
    const refreshed = page.waitForResponse(response => response.url().includes('/api/session?'), { timeout: 30_000 })
    await clickSettled(page, refresh.first(), '刷新')
    const refreshedBody = await (await refreshed).json()
    expect(refreshedBody.session, '刷新必须返回真实会话').toBeTruthy()
    await settleUi(page)
    const afterRefresh = await sessionOf(page, sessionId)
    expect(afterRefresh.state.revision).toBeGreaterThanOrEqual(beforeRefresh.state.revision)
    expect(afterRefresh.state.campaign.tsk.customizations.bySeat[0][CUSTOM_CODE]).toEqual([0])
    expect(afterRefresh.state.campaign.investigators[0].xp).toBe(XP_GRANT - 1)
    expect(customizationOf(afterRefresh).entries[0].checked).toEqual([0])
    await hubTab(hub, '升级')
    const refreshedPanel = panelOf(hub)
    await expect(refreshedPanel).toBeVisible({ timeout: 30_000 })
    await expect(refreshedPanel).toHaveAttribute('data-hub-customize-xp', String(XP_GRANT - 1))
    await expect(refreshedPanel.locator('[data-hub-customize-level="1"]')).toHaveCount(1)
    await expect(refreshedPanel.locator(`[data-hub-customize-card-xp="${XP_GRANT - 1}"]`)).toHaveCount(1)
    await expect(refreshedPanel).toContainText(`剩余经验 ${XP_GRANT - 1} XP`)
    await expect(refreshedPanel).toContainText('已勾 1/')
    await expect(refreshedPanel.getByRole('checkbox', { name: '笔如有神第 1 格' })).toBeChecked()
    await refreshedPanel.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await page.waitForTimeout(150)
    await shot(page, testInfo, `custom-refresh-${label}`)
    annotate(testInfo, 'check', 'refresh')
    annotate(testInfo, 'evidence',
      `刷新恢复：revision ${beforeRefresh.state.revision}→${afterRefresh.state.revision}；勾选仍为 `
      + `${JSON.stringify(afterRefresh.state.campaign.tsk.customizations.bySeat[0][CUSTOM_CODE])}；`
      + `剩余 XP=${afterRefresh.state.campaign.investigators[0].xp}`)

    // i. 无前端异常、无横向溢出（移动端 390 单列）。
    expect(pageErrors, `页面异常：${pageErrors.join(' | ')}`).toEqual([])
    expect(missingResources.filter(url => !/\.map$/.test(url)), `缺失资源：${missingResources.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '界面不得横向溢出').toBe(true)
    expect(consoleErrors.filter(text => !/favicon|Failed to load resource/.test(text)),
      `控制台错误：${consoleErrors.join(' | ')}`).toEqual([])
  })
}
