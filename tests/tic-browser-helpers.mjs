// TIC P8 发布/联机浏览器验收共用工具（teammate brw 的 P8 证据链，独立于 P7 的
// tests/playwright/playwright.tic.config.mjs 链；后者在 tools/tic-evidence.mjs#sources 里被
// Node 账本哈希，改动会同时作废 4 份账本，因此本链不碰它们）。
//
// 这里只放「真实大厅/真实接口」的操作原语：
//   · 大厅启动页 → 调查准备设置 → /api/start（真实会话）；
//   · 真实局外页 UI 准备席位：工作流主按钮（hubGoSetup）→ 选择调查员 → 自动构筑 → 确认准备
//     （确认后由真实 server 的同一次 /api/move 内把 AI 席位准备完）；
//   · 出发准备 → 开始当前关卡（hubBeginScenario）→ 牌桌演出/待决选择清空；
//   · 同一来源的 POST /api/move、POST /api/debug 提交（不是伪造状态、不是 route 注入）；
//   · 截图：一律写到仓库根目录 artifacts/migration/tic/p8/screenshots/，annotation 交给
//     tools/playwright-tic-release-reporter.mjs 生成 repo 根相对路径 + sha256。
//
// 不做的事：不 page.route 改写 /api/start 或 /api/session；不注册测试专用内容；不写状态。
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

export const MOD_ROOT = fileURLToPath(new URL('../', import.meta.url))
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const SHOT_DIR = fileURLToPath(new URL('../../../artifacts/migration/tic/p8/screenshots/', import.meta.url))
mkdirSync(SHOT_DIR, { recursive: true })

export const TIC_CAMPAIGN = 'theInnsmouthConspiracy'
export const TIC_INVESTIGATORS = Object.freeze(['07001', '07002', '07003', '07004', '07005'])

/** 截图写入固定目录并登记 annotation（repo 根相对路径由报告器计算）。 */
export async function shot(page, testInfo, name, { fullPage = true } = {}) {
  const path = `${SHOT_DIR}${name}.png`
  await page.screenshot({ path, fullPage, animations: 'disabled' })
  testInfo.annotations.push({ type: 'screenshot', description: path })
  return path
}

/** 记录本用例观测的 phase / viewport / scenario / debugJump 等 annotation。 */
export function annotate(testInfo, type, description) {
  if (description === undefined || description === null || description === '') return
  testInfo.annotations.push({ type, description: String(description) })
}

/** 真实大厅：启动页 → 诡镇奇谈 → 调查准备设置弹窗。 */
export async function openTicLobby(page) {
  await page.goto('/index.html')
  const card = page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })
  await expect(card).toBeVisible({ timeout: 30_000 })
  await card.click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await expect(setup).toBeVisible()
  return setup
}

/**
 * 真实 /api/start：战役=印斯茅斯暗潮、席位=seats。返回 { session, hub }。
 * 调用前先用 openTicLobby 拿到设置弹窗；本函数负责截图前的下拉断言。
 */
export async function startTicGame(page, setup, { seats = 4 } = {}) {
  const campaignSelect = setup.getByRole('combobox', { name: '战役', exact: true })
  const options = await campaignSelect.locator('option').evaluateAll(nodes =>
    nodes.map(node => ({ value: node.value, label: node.textContent })))
  expect(options.map(option => option.value), '真实大厅战役下拉必须包含 TIC').toContain(TIC_CAMPAIGN)
  expect(options.find(option => option.value === TIC_CAMPAIGN)?.label).toContain('印斯茅斯暗潮')
  await campaignSelect.selectOption(TIC_CAMPAIGN)
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(String(seats))
  const started = page.waitForResponse(response => response.url().endsWith('/api/start'))
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const body = await (await started).json()
  expect(body.ok, body.error).toBe(true)
  const session = body.session
  expect(session.state.campaign.id).toBe(TIC_CAMPAIGN)
  const hub = page.locator('.ah-hub')
  await expect(hub).toBeVisible({ timeout: 30_000 })
  await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
  await expect(page.locator('.bg-game-title').first()).toContainText('印斯茅斯暗潮')
  return { session, hub }
}

/** 在局外页用真实 UI 完成一个真人席位：hubGoSetup → 选择调查员 → 自动构筑 → 确认准备。 */
export async function prepareSeatThroughUi(page, hub, { investigatorName, code = '07001' } = {}) {
  // campaignHub 的工作流主按钮即 hubGoSetup（label 选择调查员）。
  const primary = hub.locator('.ah-workflow-next button').first()
  await expect(primary).toBeVisible({ timeout: 30_000 })
  const setupResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubGoSetup')
  await primary.click()
  const setupBody = await (await setupResponse).json()
  expect(setupBody.ok, setupBody.error).toBe(true)
  expect(setupBody.session.state.uiState).toBe('scenarioSetup')

  // 候选池（真实 hubInvestigatorChoices 投影）：TIC 五人都在可选列表里。
  const candidate = hub.getByRole('button', { name: new RegExp(`^选择调查员：${investigatorName}`) })
  await expect(candidate.first()).toBeVisible({ timeout: 30_000 })
  const selectResponse = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubSelectInvestigator')
  await candidate.first().click()
  const selectBody = await (await selectResponse).json()
  expect(selectBody.ok, selectBody.error).toBe(true)
  expect(selectBody.session.state.investigators[0].code).toBe(code)
  expect(selectBody.session.state.legalMoves.filter(move => move.action === 'hubSelectInvestigator')
    .map(move => move.code)).toEqual(expect.arrayContaining([...TIC_INVESTIGATORS]))

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

/**
 * 出发准备页：断言章节名，可选 beforeBegin 回调（截图/额外断言），再点「开始当前关卡」
 * （真实 hubBeginScenario）。返回 { session, beginBody }。
 */
export async function beginCurrentChapter(page, hub, { chapterName, beforeBegin = null }) {
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  const departure = hub.locator('.ah-office-departure')
  if (!(await departure.count())) {
    await nav.getByRole('button', { name: '开始关卡', exact: true }).click()
  }
  await expect(departure).toBeVisible({ timeout: 30_000 })
  await expect(departure.locator('h2')).toContainText(chapterName)
  if (typeof beforeBegin === 'function') await beforeBegin(departure)
  const start = departure.locator('.ah-departure-start')
  await expect(start).toBeEnabled({ timeout: 30_000 })
  const began = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
  await start.click()
  const beginBody = await (await began).json()
  expect(beginBody.ok, beginBody.error).toBe(true)
  const session = beginBody.session
  expect(session.state.uiState).toBe('inScenario')
  expect(session.state.scenario?.id).toBeTruthy()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
  return { session, beginBody }
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

/** 真实局内待决选择：点第一个可用选项（真实 /api/move），直到本次没有待决选择。 */
export async function settleTableToPlayable(page) {
  await page.waitForTimeout(600)
  let stable = 0
  for (let guard = 0; guard < 400 && stable < 6; guard++) {
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(150)
      continue
    }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(150)
      continue
    }
    const options = page.locator('.ah-choice-option:not([disabled])')
    if (await options.count()) {
      const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 30_000 }).catch(() => null)
      await options.first().click({ timeout: 5000 }).catch(() => {})
      await responded
      stable = 0
      await page.waitForTimeout(150)
      continue
    }
    if (await page.locator('.ah-cinematic').count() || await page.locator('.ah-choice').count()) {
      stable = 0
      await page.waitForTimeout(300)
      continue
    }
    stable += 1
    await page.waitForTimeout(300)
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

/** 页面内用真实 /api/move 提交一条合法动作（同源 fetch，同协议）。 */
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

/**
 * 单机调试通道（host-only POST /api/debug，真实 debugCommand 解析 + 事务提交）。
 * command.targetSeat 用于指定作用座位（例如给 AI 席位发伤害/经验）。
 */
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
export async function settlePendingChoices(page, sessionId, { max = 20 } = {}) {
  let session = await fetchSession(page, sessionId)
  for (let guard = 0; guard < max; guard++) {
    const choice = session?.state?.pendingChoice
    if (!choice) return session
    const optionIds = (choice.options || []).map(option => String(option.id))
    const pick = optionIds.find(id => ['done', 'skip', 'self'].includes(id))
      || optionIds.find(id => choice.legalMoves?.some?.(move => move.optionId === id))
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
export async function waitForSessionState(page, sessionId, predicate, label, { attempts = 160, delay = 250 } = {}) {
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

/** 连续 3 个 250ms 没有演出层，视为界面稳定（TCU P10 发布门禁同一口径）。 */
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

/** 切换局外页页签（等宽按钮文案来自 web/locales 的真实 i18n）。 */
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

