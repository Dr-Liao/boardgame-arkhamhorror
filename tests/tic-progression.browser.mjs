// 《印斯茅斯暗潮》（TIC）P8 战役推进浏览器证据：第一章结算 → 幕间/升级窗 → 第二章开始。
//
// 为什么单列 spec：真实 TIC 第一章开局没有「撤退」选项，浏览器里无法靠普通行动把第一章打到结算；
// Lead 决定允许用真实单机调试通道（POST /api/debug，host-only，仍走 mod.debugCommand 解析 +
// 正常事务提交/校验/存档）结束第一章，作为 P8「逐章推进、升级」的浏览器证据，并在账本里显式
// annotation phase=progression / debugJump，不伪装成普通行动。其余全部是真实实现：
//   · 真实大厅 /api/start（战役=印斯茅斯暗潮）、真实局外页 UI 准备 07001 → 第一章牌桌；
//   · 先经调试通道「经验 3」制造真实 XP，再「结束这关」结算第一章（引擎完整走 finishScenario/
//     结局/XP/记录），然后真实 /api/move：hubContinue → interlude1（无升级窗）→ harperPreparation
//     升级窗（upgradesAllowed=true，自动选择一次合法升级 hubAutoUpgrade）→ 第二章 scenarioSetup；
//   · 用真实局外页断言 8 章关卡列表（第一章已完成、第二章已选择）、出发准备第二章、开始第二章牌桌。
//     （幕间/尾声的规则正确性由 Node 验收覆盖；本 spec 只证明浏览器真实路径与界面。）
//
// 证据命令与 reporter/audit 见 tests/playwright/playwright.tic-release.config.mjs 与
// tools/playwright-tic-release-reporter.mjs → audit/tic-release-browser.json。
import { test, expect } from '@playwright/test'
import { contentRegistry } from '../content/registered.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import {
  TIC_CAMPAIGN, openTicLobby, startTicGame, prepareSeatThroughUi, beginCurrentChapter,
  waitForPlayableTable, fetchSession, submitDebug, settlePendingChoices, settleUi, clickSettled,
  syncUiToState, hubTab, hubPrimary, actLegal, refreshHubTo, shot, annotate,
} from './tic-browser-helpers.mjs'

const PROGRESSION_TIMEOUT = 300_000
const FIRST = chapters[0]
const SECOND = chapters[1]
const FINAL = chapters.at(-1)
const INVESTIGATOR = { code: '07001', name: '玛丽修女' }

function ticLaunchable() {
  try {
    contentRegistry.assertLaunchable(TIC_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P8 战役推进：第一章结算→幕间升级→第二章（${label} ${width}×${height}）`, async ({ page }, testInfo) => {
    test.skip(!ticLaunchable(), 'TIC 尚未在 content/registered.js 注册为可启动战役（等待 P8 生产注册）')
    testInfo.setTimeout(PROGRESSION_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'progression')
    annotate(testInfo, 'scenario', SECOND.id)
    annotate(testInfo, 'debugJump', 'POST /api/debug：经验 3 + 结束这关 + 跳到 intoTheMaelstrom + 受伤 100（单机调试通道；一次 run 内完成第一章→幕间升级→第二章→最终章→战役结局）')

    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    // a. 真实大厅 → 第一章牌桌（与发布门禁同一真实路径）。
    const setup = await openTicLobby(page)
    const { session, hub } = await startTicGame(page, setup, { seats: 1 })
    const sessionId = session.sessionId
    await prepareSeatThroughUi(page, hub, { investigatorName: INVESTIGATOR.name, code: INVESTIGATOR.code })
    await beginCurrentChapter(page, hub, { chapterName: FIRST.name })
    await waitForPlayableTable(page)
    let current = await fetchSession(page, sessionId)
    expect(current.state.scenario.id).toBe(FIRST.id)

    // b. 调试通道制造真实 XP（战斗/结算仍由引擎完整走），证明关间升级窗有可购买项。
    const xpBefore = current.state.campaign.investigators[0].xp
    const grant = await submitDebug(page, sessionId, current.state.revision, '经验 3')
    expect(grant.payload.ok, grant.payload.error).toBe(true)
    current = await fetchSession(page, sessionId)
    expect(current.state.campaign.investigators[0].xp).toBe(xpBefore + 3)

    // c. 调试通道结束第一章（真实 finishScenario/结局/XP/记录），结算到 scenarioResult。
    const end = await submitDebug(page, sessionId, current.state.revision, '结束这关')
    expect(end.payload.ok, end.payload.error).toBe(true)
    await settlePendingChoices(page, sessionId)
    const resolved = await fetchSession(page, sessionId)
    expect(resolved.state.uiState).toBe('scenarioResult')
    expect(resolved.state.campaign.scenarioResults.length).toBe(1)
    expect(resolved.state.campaign.scenarioResults[0].scenarioId).toBe(FIRST.id)
    // 结算页停在 scenarioResult，流程节点等 hubContinue 才前进（pendingNode 指向 interlude1）。
    expect(resolved.state.campaign.pendingNode).toBe('interlude1')

    // d. 界面同步到真实结算页：用牌桌「刷新局势」重放演出后进入局外页 scenarioResult。
    await syncUiToState(page, 'scenarioResult')
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioResult')
    await shot(page, testInfo, `p8-progression-result-${label}`)

    // e. 真实 UI 提交 hubContinue → interlude1（本章流程第一段幕间，upgrades=false）。
    await hubTab(hub, '战役总览')
    const continueButton = await hubPrimary(hub)
    await expect(continueButton).toContainText('查看结算')
    const continued = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubContinue')
    await clickSettled(page, continueButton, '查看结算，进入关间准备')
    const continuedBody = await (await continued).json()
    expect(continuedBody.ok, continuedBody.error).toBe(true)
    expect(continuedBody.session.state.uiState).toBe('interlude')
    expect(continuedBody.session.state.campaign.flow.nodeId).toBe('interlude1')
    expect(continuedBody.session.state.campaign.upgradesAllowed).toBe(false)
    await expect(hub).toHaveAttribute('data-ui-state', 'interlude')
    await expect(hub.locator('.ah-hub-interlude')).toBeVisible()

    // f. 完成第一段幕间 (hubDoneSeat) → 进入 harperPreparation 升级窗（upgradesAllowed=true）。
    // 升级页签下工作流主按钮按设计隐藏，动作在「升级操作」区：未升级时是「保留 N XP 并继续」。
    const keepXp = hub.getByRole('button', { name: /保留\s*\d+\s*XP\s*并继续/ }).first()
    await expect(keepXp).toBeVisible({ timeout: 30_000 })
    const phaseDone = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubDoneSeat')
    await clickSettled(page, keepXp, '保留经验，准备下一关')
    const phaseBody = await (await phaseDone).json()
    expect(phaseBody.ok, phaseBody.error).toBe(true)
    expect(phaseBody.session.state.uiState).toBe('interlude')
    expect(phaseBody.session.state.campaign.flow.nodeId).toBe('harperPreparation')
    expect(phaseBody.session.state.campaign.upgradesAllowed).toBe(true)
    expect(phaseBody.session.state.campaign.scenarioIndex).toBe(1)
    expect(phaseBody.session.state.hubSelectedScenarioId).toBe(SECOND.id)

    // g. 升级窗真实界面：升级面板可见（真实存储快照），并用真实 /api/move 提交一次合法升级：
    //    hubPurchase（挑选当前会话 legalMoves 里的第一组合法购入/替换）→ hubConfirmUpgrades（保存）。
    //    UI 没有「自动升级」入口（hubAutoUpgrade 只给大厅自动代答），因此升级的界面证据是面板 + 保存后状态。
    const upgradeHeading = hub.getByRole('heading', { name: '升级与关间准备', exact: true })
    await expect(upgradeHeading).toBeVisible({ timeout: 30_000 })
    await shot(page, testInfo, `p8-progression-upgrade-${label}`)
    const xpBeforeUpgrade = phaseBody.session.state.campaign.investigators[0].xp
    const purchase = await actLegal(page, sessionId, 'hubPurchase')
    expect(purchase.session.state.campaign.investigators[0].upgradeDraft).toBeTruthy()
    const confirmed = await actLegal(page, sessionId, 'hubConfirmUpgrades')
    const upgradedRecord = confirmed.session.state.campaign.investigators[0]
    expect(upgradedRecord.xp).toBeLessThan(xpBeforeUpgrade)
    expect(upgradedRecord.purchases.some(item => item.scenarioIndex === 1)).toBe(true)
    expect(upgradedRecord.upgradeDraft).toBeFalsy()
    // 两条 /api/move 是页面内 fetch 提交的，点局外页「刷新」把最新会话同步回界面。
    await refreshHubTo(page, hub, 'interlude')
    await settleUi(page)
    await shot(page, testInfo, `p8-progression-upgrade-saved-${label}`)
    const finishUpgrade = hub.getByRole('button', { name: '完成升级，准备下一关', exact: true }).first()
    await expect(finishUpgrade).toBeVisible({ timeout: 30_000 })
    await expect(finishUpgrade).toBeEnabled()

    // h. 完成升级 (hubDoneSeat) → 下一章 scenarioSetup（第二章已选择、8 章列表、已完成/已选择）。
    const nextSetup = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubDoneSeat')
    await clickSettled(page, finishUpgrade, '完成升级，准备下一关')
    const nextBody = await (await nextSetup).json()
    expect(nextBody.ok, nextBody.error).toBe(true)
    expect(nextBody.session.state.uiState).toBe('scenarioSetup')
    expect(nextBody.session.state.campaign.scenarioIndex).toBe(1)
    expect(nextBody.session.state.campaign.flow.nodeId).toBe(SECOND.id)
    expect(nextBody.session.state.hubSelectedScenarioId).toBe(SECOND.id)
    await expect(hub).toHaveAttribute('data-ui-state', 'scenarioSetup')

    await hubTab(hub, '关卡选择')
    await expect(hub.locator('.ah-office-case')).toHaveCount(chapters.length)
    const firstCase = hub.locator('.ah-office-case', { hasText: FIRST.name })
    const secondCase = hub.locator('.ah-office-case', { hasText: SECOND.name })
    await expect(firstCase.first()).toContainText('已完成')
    await expect(secondCase.first()).toContainText('已选择')
    await shot(page, testInfo, `p8-progression-cases-${label}`)

    // i. 升级结束后流程直接进入「已就绪」的下一关 scenarioSetup（真实进展里 hubReady 保持），
    //    真实局外页的「开始关卡」页签显示第二章出发准备。
    const setupState = await fetchSession(page, sessionId)
    expect(setupState.state.uiState).toBe('scenarioSetup')
    expect(setupState.state.hubReady).toBe(true)
    await hubTab(hub, '开始关卡')
    const departure = hub.locator('.ah-office-departure')
    await expect(departure).toBeVisible({ timeout: 30_000 })
    await expect(departure.locator('h2')).toContainText(SECOND.name)
    await shot(page, testInfo, `p8-progression-departure-${label}`)

    const beganSecond = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
    await clickSettled(page, departure.locator('.ah-departure-start'), '开始当前关卡')
    const beganBody = await (await beganSecond).json()
    expect(beganBody.ok, beganBody.error).toBe(true)
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
    await waitForPlayableTable(page)
    const second = await fetchSession(page, sessionId)
    expect(second.state.uiState).toBe('inScenario')
    expect(second.state.scenario.id).toBe(SECOND.id)
    expect(second.state.campaign.scenarioResults.length).toBe(1)
    await expect(page.locator('.bg-game-title').first()).toContainText(SECOND.name)
    await shot(page, testInfo, `p8-progression-chapter2-${label}`)

    // j. 跳到最终章（真实 POST /api/debug → 引擎 startScenario 重建关卡；annotation 已记录 debugJump），
    //    再让调查员被击败：全员出局走真实 noResolution（→ resolution8 战役失败结局）→ campaignResult。
    //    这是 P8 发布门禁里的「最终章/失败分支/战役收尾」浏览器证据；胜利尾声的叙事正确性由 Node 验收覆盖。
    current = await fetchSession(page, sessionId)
    const jump = await submitDebug(page, sessionId, current.state.revision, `跳到 ${FINAL.id}`)
    expect(jump.payload.ok, jump.payload.error).toBe(true)
    await settlePendingChoices(page, sessionId)
    const finalChapter = await fetchSession(page, sessionId)
    expect(finalChapter.state.uiState).toBe('inScenario')
    expect(finalChapter.state.scenario.id).toBe(FINAL.id)
    expect(finalChapter.state.campaign.scenarioIndex).toBe(chapters.length - 1)
    const defeat = await submitDebug(page, sessionId, finalChapter.state.revision, '受伤 100')
    expect(defeat.payload.ok, defeat.payload.error).toBe(true)
    await settlePendingChoices(page, sessionId)
    const over = await fetchSession(page, sessionId)
    expect(over.state.status).toBe('over')
    expect(over.state.uiState).toBe('campaignResult')
    expect(over.state.campaign.finished).toBe(true)
    expect(over.state.outcome).toBe('defeat')
    await syncUiToState(page, 'campaignResult')
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignResult')
    await expect(page.locator('body')).toContainText('战役已完成')
    await shot(page, testInfo, `p8-progression-campaign-result-${label}`)

    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    await settleUi(page)
  })
}
