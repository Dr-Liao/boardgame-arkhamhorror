// 《地球边缘》（EotE）P8 发布/推进/联机浏览器验收共用工具（真实大厅 / 真实 HTTP，零状态注入）。
//
// 独立于 P7 的 tests/eote-scenarios.browser.mjs 证据链：P8 三个 spec 只用本文件提供的
// 「真实大厅 / 真实接口」操作原语：
//   · 启动页 → 调查准备设置 → 战役下拉（地球边缘）→ 真实 POST /api/start；
//   · 真实局外页 UI 准备席位：关卡选择（hubSelectScenario）→ 配置调查员（hubGoSetup）→
//     选择调查员（hubSelectInvestigator）→ 自动构筑（hubAutoDeck）→ 确认准备（hubDoneSeat，
//     AI 席位由服务端同一条 autoHubMove 路径在同一请求内准备完）；
//   · 出发准备页（真实 hubBeginScenario）→ 序幕/战役选择的真实待决面板（DOM 点击）→ 牌桌；
//   · 局内待决选择、牌桌演出、单机调试通道（host-only POST /api/debug）的真实提交；
//   · 截图统一写 artifacts/migration/eote/p8/screenshots/，annotation 交给
//     tools/playwright-eote-release-reporter.mjs 生成 repo 根相对路径 + sha256。
//
// 不做的事：不 page.route 改写 /api/start、/api/session、/api/move；不注册测试专用内容；
// 不直接写 session.state / campaign.records。
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

import { chapters as EOTE_CHAPTER_LIST } from '../content/campaigns/edgeOfTheEarth/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

export const MOD_ROOT = fileURLToPath(new URL('../', import.meta.url))
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const SHOT_DIR = fileURLToPath(new URL('../../../artifacts/migration/eote/p8/screenshots/', import.meta.url))
mkdirSync(SHOT_DIR, { recursive: true })

export const EOTE_CAMPAIGN = 'edgeOfTheEarth'
export const EOTE_NAME = '地球边缘'
export const EOTE_CHAPTERS = EOTE_CHAPTER_LIST
export const FIRST_CHAPTER = EOTE_CHAPTERS[0]
export const FINAL_CHAPTER = EOTE_CHAPTERS.at(-1)
// 调查员卡号固定，名字从卡表数据读（不手抄中文名）。
export const EOTE_INVESTIGATOR_CODES = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
export const investigatorName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
export const EOTE_INVESTIGATORS = Object.freeze(EOTE_INVESTIGATOR_CODES.map(code => Object.freeze({
  code, name: investigatorName(code),
})))

/** 截图写入固定目录并登记 annotation（repo 根相对路径由报告器计算）。 */
export async function shot(page, testInfo, name, { fullPage = true } = {}) {
  const path = `${SHOT_DIR}${name}.png`
  await page.screenshot({ path, fullPage, animations: 'disabled' })
  testInfo.annotations.push({ type: 'screenshot', description: path })
  return path
}

/** 记录本用例观测的 phase / viewport / scenario / claim / debugJump 等 annotation。 */
export function annotate(testInfo, type, description) {
  if (description === undefined || description === null || description === '') return
  testInfo.annotations.push({ type, description: String(description) })
}

/** 真实大厅：启动页 → 诡镇奇谈 → 调查准备设置弹窗。 */
export async function openEoteLobby(page) {
  await page.goto('/index.html')
  const card = page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await expect(setup).toBeVisible()
  return setup
}

/** 真实 /api/start：战役=地球边缘、席位=seats。返回 { session, hub, campaignLabel }。 */
export async function startEoteGame(page, setup, { seats = 2 } = {}) {
  const campaignSelect = setup.getByRole('combobox', { name: '战役', exact: true })
  const options = await campaignSelect.locator('option').evaluateAll(nodes =>
    nodes.map(node => ({ value: node.value, label: node.textContent })))
  expect(options.map(option => option.value), '真实大厅战役下拉必须包含 EotE').toContain(EOTE_CAMPAIGN)
  const campaignLabel = options.find(option => option.value === EOTE_CAMPAIGN)?.label || ''
  expect(campaignLabel).toContain(EOTE_NAME)
  await campaignSelect.selectOption(EOTE_CAMPAIGN)
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(String(seats))
  const started = page.waitForResponse(response => response.url().endsWith('/api/start'))
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const body = await (await started).json()
  expect(body.ok, body.error).toBe(true)
  const session = body.session
  expect(session.state.campaign.id).toBe(EOTE_CAMPAIGN)
  const hub = page.locator('.ah-hub')
  await expect(hub).toBeVisible({ timeout: 30_000 })
  await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
  await expect(page.locator('.bg-game-title').first()).toContainText(EOTE_NAME)
  return { session, hub, campaignLabel }
}

/** 局外页切页签（按钮文案来自 web/locales 的真实 i18n）。 */
export async function hubTab(hub, label) {
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  await nav.getByRole('button', { name: label, exact: true }).click()
}

/** 局外页工作流主按钮（label 由真实 legalMoves 文案决定）。 */
export async function hubPrimary(hub) {
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  return primary
}

/**
 * 关卡选择页：点第 index 章的真实「选择」按钮（hubSelectScenario），并断言章节名。
 * 真实流程里首关也需要先选关才能「配置调查员」。
 */
export async function chooseScenarioThroughUi(page, hub, { chapter, index = 0 }) {
  await hubTab(hub, '关卡选择')
  const cases = hub.locator('.ah-office-case')
  await expect(cases).toHaveCount(EOTE_CHAPTERS.length)
  const target = cases.nth(index)
  await expect(target).toContainText(chapter.name)
  const choose = target.locator('button')
  if (await choose.count()) {
    const selected = await target.evaluate(element => element.classList.contains('selected'))
    if (!selected) {
      const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
        && response.request().postDataJSON()?.move?.action === 'hubSelectScenario')
      await choose.first().click()
      const body = await (await responded).json()
      expect(body.ok, body.error).toBe(true)
    }
  }
  return page.locator('.ah-hub')
}

/** 在局外页用真实 UI 完成一个真人席位：hubGoSetup → 选择调查员 → 自动构筑 → 确认准备。 */
export async function prepareSeatThroughUi(page, hub, { code = '08001' } = {}) {
  const name = investigatorName(code)
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  const setupResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubGoSetup')
  await primary.click()
  const setupBody = await (await setupResponse).json()
  expect(setupBody.ok, setupBody.error).toBe(true)
  expect(setupBody.session.state.uiState).toBe('scenarioSetup')

  const candidate = hub.getByRole('button', { name: new RegExp(`^选择调查员：${name}`) })
  await expect(candidate.first()).toBeVisible({ timeout: 30_000 })
  const selectResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubSelectInvestigator')
  await candidate.first().click()
  const selectBody = await (await selectResponse).json()
  expect(selectBody.ok, selectBody.error).toBe(true)
  expect(selectBody.session.state.investigators[0].code).toBe(code)
  expect(selectBody.session.state.legalMoves.filter(move => move.action === 'hubSelectInvestigator')
    .map(move => move.code)).toEqual(expect.arrayContaining([...EOTE_INVESTIGATOR_CODES]))

  const deck = hub.getByRole('button', { name: '自动构筑合法牌组', exact: true }).first()
  await expect(deck).toBeEnabled({ timeout: 30_000 })
  const deckResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubAutoDeck')
  await deck.click()
  const deckBody = await (await deckResponse).json()
  expect(deckBody.ok, deckBody.error).toBe(true)

  const ready = hub.getByRole('button', { name: '确认准备', exact: true }).first()
  await expect(ready).toBeEnabled({ timeout: 30_000 })
  const readyResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubDoneSeat')
  await ready.click()
  const readyBody = await (await readyResponse).json()
  expect(readyBody.ok, readyBody.error).toBe(true)
  // 同一条 /api/move 内，真实 server 用与大厅相同的 autoHubMove 路径准备完 AI 席位。
  expect(readyBody.session.state.hubReady, '1 名真人确认后全桌应已准备完毕').toBe(true)
  return readyBody.session
}

/** 开局演出/待决选择是异步队列：点掉「跳过演出 / 继续」直到队列清空。 */
export async function dismissPresentation(page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await page.locator('.ah-cinematic').count() === 0) return
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(150)
      continue
    }
    const next = page.getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(150)
      continue
    }
    await page.waitForTimeout(150)
  }
}

/** 牌桌是否处于行动/故事演出队列（此时动作条与地图交互被暂存）。 */
async function isPresenting(page) {
  const table = page.locator('.ah-table').first()
  if (!(await table.count())) return false
  return table.evaluate(element => element.classList.contains('ah-presenting')).catch(() => false)
}

/** 真实玩家路径清空待决选择/演出队列（换牌/故事/遭遇目标/EotE 机制选择/行动演出）。 */
export async function settleTableToPlayable(page) {
  await page.waitForTimeout(500)
  let stable = 0
  for (let guard = 0; guard < 400 && stable < 6; guard++) {
    if (await isPresenting(page)) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(200)
      continue
    }
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) { await skip.first().click({ timeout: 3000, force: true }).catch(() => {}); stable = 0; await page.waitForTimeout(120); continue }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) { await next.first().click({ timeout: 3000, force: true }).catch(() => {}); stable = 0; await page.waitForTimeout(120); continue }
    // EotE 机制选择（伙伴选派/封印/演武等）：pick 一项 → 确认。
    const mechanic = page.locator('.ah-mechanic-choice')
    if (await mechanic.count()) {
      const pick = mechanic.locator('[data-option-id^="pick:"]:not([disabled]), [data-option-id]:not([disabled])').first()
      if (await pick.count()) await pick.click({ timeout: 5000 }).catch(() => {})
      const confirm = mechanic.locator('[data-option-id="confirm"]')
      if (await confirm.count()) await confirm.click({ timeout: 5000 }).catch(() => {})
      stable = 0; await page.waitForTimeout(150); continue
    }
    const done = page.locator('.ah-choice [data-option-id="done"]:not([disabled])')
    if (await done.count()) { await done.first().click({ timeout: 5000 }).catch(() => {}); stable = 0; await page.waitForTimeout(150); continue }
    const option = page.locator('.ah-choice .ah-choice-option:not([disabled])')
    if (await option.count()) { await option.first().click({ timeout: 5000 }).catch(() => {}); stable = 0; await page.waitForTimeout(150); continue }
    if (await page.locator('.ah-cinematic, .ah-choice, .ah-mechanic-choice').count()) { stable = 0; await page.waitForTimeout(250); continue }
    stable += 1
    await page.waitForTimeout(250)
  }
}

/** 全量跑时演出队列会出现 >1s 的间隔：反复结算，直到连续 1.2s 无演出、无待决选择。 */
export async function waitForPlayableTable(page, timeout = 120_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await settleTableToPlayable(page)
    await page.waitForTimeout(1200)
    if (await page.locator('.ah-cinematic').count() === 0 && await page.locator('.ah-choice').count() === 0) return
  }
  throw new Error(`牌桌演出/待决选择未清空（cinematic=${await page.locator('.ah-cinematic').count()} choice=${await page.locator('.ah-choice').count()}）`)
}

/** 读取真实会话（与 web/game-ui.js 的「刷新局势」同一个 GET /api/session）。 */
export async function fetchSession(page, sessionId) {
  return page.evaluate(async id => {
    const response = await fetch('/api/session?sessionId=' + encodeURIComponent(id))
    const payload = await response.json()
    return payload.session || null
  }, sessionId)
}

/** 页面内用真实 /api/move 提交一条动作（同源 fetch，同协议）。 */
export async function submitMove(page, sessionId, revision, move) {
  return page.evaluate(async ({ sessionId: id, revision: rev, move: value }) => {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: id, revision: rev, move: { ...value, revision: rev } }),
    })
    return { status: response.status, payload: await response.json() }
  }, { sessionId, revision, move })
}

/** 单机调试通道（host-only POST /api/debug，真实 debugCommand 解析 + 事务提交）。 */
export async function submitDebug(page, sessionId, revision, text, targetSeat = undefined) {
  return page.evaluate(async ({ sessionId: id, revision: rev, text: command, targetSeat: target }) => {
    const response = await fetch('/api/debug', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: id, revision: rev,
        command: { text: command, ...(Number.isInteger(target) ? { targetSeat: target } : {}) } }),
    })
    return { status: response.status, payload: await response.json() }
  }, { sessionId, revision, text, targetSeat })
}

/** 把当前会话里所有待决选择按 done/skip/self/第一个合法选项结算掉（真实 /api/move）。 */
export async function settlePendingChoices(page, sessionId, { max = 24 } = {}) {
  let session = await fetchSession(page, sessionId)
  for (let guard = 0; guard < max; guard++) {
    const choice = session?.state?.pendingChoice
    if (!choice) return session
    const optionIds = (choice.options || []).map(option => String(option.id))
    const pick = optionIds.find(id => ['done', 'skip', 'self'].includes(id))
      || optionIds[0]
    const move = (session.state.legalMoves || []).find(item => item.action === 'choose' && String(item.optionId) === pick)
      || { action: 'choose', choiceId: choice.id, optionId: pick }
    const result = await submitMove(page, sessionId, session.state.revision, move)
    expect(result.payload.ok, `${choice.kind}:${result.payload.error}`).toBe(true)
    session = result.payload.session
  }
  return session
}

/** 轮询真实会话直到 predicate 成立。 */
export async function waitForSessionState(page, sessionId, predicate, label, { attempts = 200, delay = 250 } = {}) {
  let last = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await fetchSession(page, sessionId)
    if (last && predicate(last)) return last
    await page.waitForTimeout(delay)
  }
  throw new Error(`等待真实会话状态超时：${label}（最后 ${JSON.stringify({
    uiState: last?.state?.uiState, revision: last?.state?.revision,
    node: last?.state?.campaign?.flow?.nodeId, pending: last?.state?.pendingChoice?.kind || null,
  })}）`)
}

/** 点局外页头的「刷新」把真实会话同步到界面，并等到目标 data-ui-state。 */
export async function refreshHubTo(page, hub, uiState) {
  const button = page.getByRole('button', { name: '刷新', exact: true })
  if (await button.count()) await button.first().click()
  await expect(hub).toHaveAttribute('data-ui-state', uiState, { timeout: 30_000 })
}

/** 按会话 legalMoves 找到指定 action 的合法动作并真实提交；返回 { session, move }。 */
export async function actLegal(page, sessionId, action, matches = () => true, { attempts = 40 } = {}) {
  let session = null
  let move = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    session = await fetchSession(page, sessionId)
    move = (session?.state?.legalMoves || []).find(item => item.action === action && matches(item))
    if (move) break
    await page.waitForTimeout(100)
  }
  expect(move, `${action} 不在合法动作里：${JSON.stringify((session?.state?.legalMoves || [])
    .filter(item => item.action === action).slice(0, 4))}`).toBeTruthy()
  const result = await submitMove(page, sessionId, session.state.revision, move)
  expect(result.payload.ok, result.payload.error).toBe(true)
  return { session: result.payload.session, move }
}

/** 连续 3 个 250ms 没有演出层，视为界面稳定。 */
export async function settleUi(page) {
  let quiet = 0
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await page.locator('.ah-cinematic').count()) {
      quiet = 0
      await dismissPresentation(page)
      continue
    }
    quiet += 1
    if (quiet >= 3) return
    await page.waitForTimeout(250)
  }
}

/** 演出可能一张接一张排队：点按前先稳定；被拦截就再稳定后重试（仍是真实点击，不是 force）。 */
export async function clickSettled(page, locator, label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await settleUi(page)
    try {
      await locator.click({ timeout: 8000 })
      return
    } catch (error) {
      if (attempt === 7) throw new Error(`${label || '点击'}失败：${error.message}`)
      await page.waitForTimeout(400)
    }
  }
}

/**
 * 把真实会话同步到界面：牌桌用「刷新局势」，局外页用「刷新」；随后清演出并等到目标 uiState。
 * 用于 API 直推（/api/debug、无 UI 按钮的 move）之后的界面断言。
 */
export async function syncUiToState(page, targetUiState, { timeout = 60_000 } = {}) {
  const tableRefresh = page.getByRole('button', { name: '刷新局势' })
  const hubRefresh = page.getByRole('button', { name: '刷新', exact: true })
  if (await tableRefresh.count()) await clickSettled(page, tableRefresh.first(), '刷新局势')
  else if (await hubRefresh.count()) await clickSettled(page, hubRefresh.first(), '刷新')
  else throw new Error('界面上找不到「刷新局势 / 刷新」按钮')
  const hub = page.locator('.ah-hub')
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await settleUi(page)
    if (await hub.count() && await hub.getAttribute('data-ui-state') === targetUiState) return
    await page.waitForTimeout(250)
  }
  throw new Error(`界面未进入 uiState=${targetUiState}（hub=${await hub.count() ? await hub.getAttribute('data-ui-state') : 'absent'}）`)
}

/**
 * 局外页「战役选择」待决面板：点真实按钮直到面板消失。
 * pick(buttonTexts) 返回要点的下标（默认第一个可用项；用于检查点分支的定向选择）。
 */
export async function settleHubChoices(page, hub, { pick = null, max = 12 } = {}) {
  for (let guard = 0; guard < max; guard++) {
    await settleUi(page)
    const dialog = hub.locator('[role="dialog"][aria-label="战役选择"]')
    if (!(await dialog.count())) return
    const buttons = dialog.locator('button:not([disabled])')
    const count = await buttons.count()
    if (!count) return
    const texts = await buttons.allTextContents()
    const index = typeof pick === 'function' ? Math.max(0, pick(texts.map(text => text.trim()))) : 0
    const target = buttons.nth(Math.min(index, count - 1))
    const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 30_000 }).catch(() => null)
    await clickSettled(page, target, `战役选择：${texts[index] || ''}`)
    await responded
    await page.waitForTimeout(250)
  }
}

/**
 * 出发准备页：断言章节名，可选 beforeBegin 回调（截图/额外断言），点「开始当前关卡」
 * （真实 hubBeginScenario），并结算序幕/战役选择待决面板，直到真实牌桌挂载。
 */
export async function beginCurrentChapter(page, hub, { chapterName, beforeBegin = null, pick = null } = {}) {
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  const departure = hub.locator('.ah-office-departure')
  if (!(await departure.count())) {
    await nav.getByRole('button', { name: '开始关卡', exact: true }).click().catch(() => {})
  }
  await expect(departure).toBeVisible({ timeout: 30_000 })
  await expect(departure.locator('h2')).toContainText(chapterName)
  if (typeof beforeBegin === 'function') await beforeBegin(departure)
  const start = departure.locator('.ah-departure-start')
  await expect(start).toBeEnabled({ timeout: 30_000 })
  const began = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
  await clickSettled(page, start, '开始当前关卡')
  const beginBody = await (await began).json()
  expect(beginBody.ok, beginBody.error).toBe(true)
  // 序幕/导入的战役选择由真实局外页面板承载：点真实按钮，直到牌桌挂载。
  for (let guard = 0; guard < 20; guard++) {
    await settleHubChoices(page, hub, { pick })
    await dismissPresentation(page)
    if (await page.locator('.ah-table').count() && await page.locator('.ah-table').first().isVisible()) break
    const refresh = page.getByRole('button', { name: '刷新', exact: true })
    if (await refresh.count()) await refresh.first().click().catch(() => {})
    await page.waitForTimeout(400)
  }
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
  const session = await waitForSessionState(page, beginBody.session.sessionId,
    current => current.state?.uiState === 'inScenario', '进入关卡')
  return { session, beginBody }
}

/** 关卡设置指南面板断言（与 P7 同一交互口径）：分区/折叠展开/中文缺项/关闭恢复焦点。 */
export async function assertChapterGuide(page, testInfo, viewportLabel, chapter, { annotateScenario = true } = {}) {
  if (await page.locator('.ah-carddetail-backdrop').count()) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
  await page.locator('[data-scenario-setup]').click({ timeout: 5000 })
  const guide = page.getByRole('dialog', { name: '关卡设置' })
  await expect(guide).toBeVisible()
  await expect.poll(async () => await guide.locator('.ah-setup-section').count(), { timeout: 20_000 }).toBeGreaterThan(0)
  await expect(guide.locator('h2')).toContainText(chapter.name.split(' ')[0])
  const titles = (await guide.locator('.ah-setup-section h3').allTextContents()).map(text => text.trim())
  expect(titles, `${chapter.id} 指南分区`).toContain('设置')
  const details = guide.locator('details')
  expect(await details.count(), `${chapter.id} 折叠剧透分区`).toBeGreaterThan(0)
  await expect(guide.locator('details[open]')).toHaveCount(0)
  await details.last().locator('summary').click({ timeout: 5000 })
  await expect(details.last()).toHaveAttribute('open', '')
  const blocks = (await guide.locator('.ah-guide-block').allTextContents()).map(text => text.trim()).filter(Boolean)
  expect(blocks.length, `${chapter.id} 指南正文块`).toBeGreaterThan(0)
  const englishOnly = blocks.filter(text => !/[\u4e00-\u9fff]/.test(text))
  expect(englishOnly, `${chapter.id} 指南块不得以英文冒充中文：${englishOnly[0] || ''}`).toEqual([])
  if (annotateScenario) testInfo.annotations.push({ type: 'scenario', description: chapter.id })
  await shot(page, testInfo, `p8-${viewportLabel}-${chapter.id}-guide`)
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => Boolean(document.activeElement?.matches?.('[data-scenario-setup]')))).toBe(true)
}

/** 局外页「战役选择」/结算页的真实主按钮推进（hubContinue / hubDoneSeat / hubBeginScenario）。 */
export async function clickWorkflowPrimary(page, hub, { action, label }) {
  await settleHubChoices(page, hub)
  const primary = await hubPrimary(hub)
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 30_000 })
  await clickSettled(page, primary, label || action || '局外页主按钮')
  const body = await (await responded).json()
  expect(body.ok, body.error).toBe(true)
  if (action) {
    const posted = (await responded.request().postDataJSON())?.move?.action
    expect(posted, `真实主按钮应提交 ${action}`).toBe(action)
  }
  return body.session
}
