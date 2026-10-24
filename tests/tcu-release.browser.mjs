// 万象无终（TCU）P10 发布级浏览器实机证据：真实大厅 → 序章 → 首章结算 → 下一章。
//
// 与 P8 的 tests/tcu-scenarios.browser.mjs 的区别（P8 证据不能替代本文件）：
//   · P8 用「真实引擎按章建局 + /api/start 路由改写」的合成外壳，绕开当时 catalog-only 的战役门禁；
//     P10 战役已 playable，这里全程走**真实大厅**：启动页 → 调查准备设置 → 大厅局外页 → 序章牌桌。
//   · 没有任何 page.route 改写 /api/start 或 /api/session；会话由真实大厅创建并落盘。
//   · 进入序章后的推进动作（移动入口大厅 → 撤退 → 反应跳过 → 关卡结算 → hubContinue）由页面内
//     fetch 提交到真实的 POST /api/move（同源、同版本号协议，服务端仍走 validateMove/applyMove），
//     不是点击伪造，也不是手写状态；随后用界面自带的「刷新局势 / 刷新」同步真实会话并断言渲染。
//   · 桌面 1440×950 与移动 390×844 各一条；截图与视口经 annotation 交给
//     tools/playwright-tcu-reporter.mjs 汇总成 audit/tcu-browser-acceptance.json（runner 生成，不手写）。
//
// 地图适配说明（P10 已修）：修复前进入关卡时演出阶段先渲染占位地图（场景 data-map-width/height = 1×1），
// fitMap 把缩放记成 1.3、fitted=true，真实地点进场后 queueMicrotask/ResizeObserver 都不再适配，玩家看到空白地图。
// Lead 已在 web/game-ui.js 让 fit 记录 scene 尺寸、几何变化时重新适配。本文件仍保留一次界面 aria-description
// 文档化的「双击地图空白处适配」手势（幂等，修复前后都成立），再用 toBeInViewport 断言地点可见。
//
// 证据命令（5 个 spec 必须一次跑齐，报告器一次写文件）：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs \
//     tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §3：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/tcu-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const START_TIMEOUT = 120_000

// 读取真实会话（与 web/game-ui.js 的「刷新局势」同一个 GET /api/session）。
async function fetchSession(page, sessionId) {
  return page.evaluate(async id => {
    const response = await fetch('/api/session?sessionId=' + encodeURIComponent(id))
    const payload = await response.json()
    return payload.session || null
  }, sessionId)
}

// 引擎推进是异步的（/api/move 返回即已提交）：等真实会话满足条件，而不是等固定时长。
async function waitForSession(page, sessionId, predicate, label) {
  let last = null
  for (let attempt = 0; attempt < 160; attempt++) {
    last = await fetchSession(page, sessionId)
    if (last && predicate(last)) return last
    await page.waitForTimeout(250)
  }
  throw new Error(`等待真实会话状态超时：${label}（最后状态 ${JSON.stringify({
    uiState: last?.state?.uiState, revision: last?.state?.revision,
    choice: last?.state?.pendingChoice?.kind || null,
  })}）`)
}

// 在页面内用真实 /api/move 提交一条合法动作：同源 fetch，请求体与 web/game-ui.js 的 cardMove 同形。
async function submitMove(page, sessionId, revision, move) {
  const result = await page.evaluate(async ({ sessionId, revision, move }) => {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, revision, move: { ...move, revision } }),
    })
    return { status: response.status, payload: await response.json() }
  }, { sessionId, revision, move })
  return result
}

// 演出的「跳过演出 / 继续」都走真实按钮；列表为空即演出层已退出。
async function dismissPresentation(page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await page.locator('.ah-cinematic').count() === 0) return
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(200)
      continue
    }
    const next = page.getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(200)
      continue
    }
    await page.waitForTimeout(200)
  }
}

// 连续 3 个 250ms 没有演出层，视为界面稳定；避免按钮点按被演出层拦截。
async function settleUi(page) {
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

// 演出可能一张接一张地排队出现：点按前先稳定；被拦截就再稳定后重试（真实按钮点击，不是 force）。
async function clickSettled(page, locator, label) {
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

// 刷新后界面会重放这段时间的演出；走完演出队列，直到真实状态落到目标 uiState 并完成渲染。
async function syncUi(page, button, uiState, label) {
  await clickSettled(page, button, label)
  for (let attempt = 0; attempt < 12; attempt++) {
    await settleUi(page)
    if (await page.locator(`[data-ui-state="${uiState}"]`).count()) break
    await page.waitForTimeout(300)
  }
  await expect(page.locator(`[data-ui-state="${uiState}"]`)).toBeVisible({ timeout: 30_000 })
}

// 地图适配：进入关卡时演出阶段会先渲染占位地图（场景 1×1），P10 修复后 fit 会在地图几何变化时
// 重新适配；这里仍走一次界面文档化的「双击地图空白处适配」手势（幂等），再断言地点落在视口内。
// 桌面地图区足够高，双击适配后所有地点都在视口内；移动端地图区只有约 123px 高（地图本身
// 缩放下限 0.3，1926×1104 的场景放不进 390 宽），因此移动端只要求当前地点在视口内、
// 「入口大厅」节点真实存在并可读（更强的横纵同时可见在现有 UI 里做不到，不静默放宽成 DOM 存在性）。
async function fitLocationMap(page, complete) {
  const viewport = page.locator('.ah-map-viewport')
  await expect(viewport).toBeVisible()
  await viewport.dblclick({ position: { x: 8, y: 8 }, timeout: 10_000 })
  const entryHall = page.locator('.ah-map-node[data-location-id="entryHall"]').first()
  await expect(page.locator('.ah-map-node[data-location-id="victorianHalls"]').first()).toBeInViewport({ timeout: 10_000 })
  await expect(entryHall).toBeVisible()
  if (complete) await expect(entryHall).toBeInViewport()
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P10 真实大厅→序章→章节实机路径成立（${label} ${width}×${height}）`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    // 标题里带 desktop/mobile，报告器据此归集视口证据。
    test.info().annotations.push({ type: 'viewport', description: label })

    // a. 真实大厅启动页 → 调查准备设置（战役=万象无终；当前 UI 的席位下拉可访问名是「席位数量」）
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.locator('.ah-hub-setup')
    await expect(setup).toBeVisible()
    await expect(setup).toHaveAttribute('aria-label', '调查准备设置')
    await setup.getByRole('combobox', { name: '战役' }).selectOption('theCircleUndone')
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
    const [startResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/start') && response.request().method() === 'POST', { timeout: START_TIMEOUT }),
      setup.getByRole('button', { name: '开始新游戏' }).click(),
    ])
    const started = await startResponse.json()
    expect(started.ok, JSON.stringify(started.error || '')).toBe(true)
    const sessionId = started.session.sessionId
    expect(started.session.state.campaign.id).toBe('theCircleUndone')
    // 大厅确实加载的是万象无终（标题来自真实状态 campaign.name）。
    const hub = page.locator('.ah-hub')
    await expect(hub).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText('万象无终')

    // b. 真实大厅局外页：选择调查员 → 自动构筑 → 确认准备 → 开始关卡 → 开始当前关卡
    await clickSettled(page, hub.getByRole('button', { name: '选择调查员', exact: true }), '选择调查员')
    // 候选人的「ⓘ」档案按钮：不提交选择也能先看完整人物档案（本轮需求：选人时先看到信息）。
    const firstInfo = hub.locator('.ah-office-candidate-info').first()
    await expect(firstInfo).toBeVisible()
    await clickSettled(page, firstInfo, '查看候选人档案')
    const rosterDialog = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(rosterDialog).toBeVisible()
    await expect(rosterDialog).toContainText('罗兰·班克斯')
    await clickSettled(page, page.getByRole('button', { name: '关闭卡牌详情' }), '关闭卡牌详情')
    await expect(rosterDialog).toHaveCount(0)
    // 候选人卡面同样支持按住 Alt 放大（与牌桌共用同一套卡牌交互）。
    const rosterArt = hub.locator('.ah-office-candidate .ah-table-art').first()
    await rosterArt.hover()
    await page.keyboard.down('Alt')
    await expect(page.locator('.ah-card-zoom')).toBeVisible()
    await page.keyboard.up('Alt')
    await expect(page.locator('.ah-card-zoom')).toHaveCount(0)
    const caroline = hub.getByRole('button', { name: /选择调查员：卡洛琳·弗恩/ })
    await expect(caroline.first()).toBeVisible()
    await clickSettled(page, caroline.first(), '选择调查员：卡洛琳·弗恩')
    const autoDeck = hub.getByRole('button', { name: /自动构筑/ }).first()
    await expect(autoDeck).toBeEnabled()
    await clickSettled(page, autoDeck, '自动构筑')
    const confirmSeat = hub.getByRole('button', { name: '确认准备', exact: true }).first()
    await expect(confirmSeat).toBeEnabled()
    await clickSettled(page, confirmSeat, '确认准备')
    await expect(hub.getByRole('button', { name: '开始当前关卡' }).first()).toBeVisible()
    await clickSettled(page, hub.getByRole('navigation', { name: '战役局外页面' })
      .getByRole('button', { name: '开始关卡', exact: true }), '开始关卡标签')
    const begin = hub.getByRole('button', { name: '开始当前关卡' }).first()
    await expect(begin).toBeEnabled()
    await clickSettled(page, begin, '开始当前关卡')

    // c. 序章选人面板（P5 的 tcu-ui 待决选择）→ 加弗瑞拉·米兹拉克 → 序章牌桌
    const storyPanel = page.locator('.ah-story-picker')
    await expect(storyPanel).toBeVisible({ timeout: 30_000 })
    const storyChoice = await waitForSession(page, sessionId,
      session => session.state.pendingChoice?.kind === 'storyInvestigator', '序章故事调查员待决')
    expect((storyChoice.state.pendingChoice.options || []).map(option => String(option.id))).toContain('05046')
    // 观察投影必须把故事调查员的公开卡面身份带给应答座位；旧版只发 id/label，
    // 面板就只剩名字、职业退化、没有属性与生命理智（本轮修复的回归点）。
    const gabriellaOption = storyChoice.state.pendingChoice.options.find(option => String(option.id) === '05046')
    expect(gabriellaOption.klass).toBe('neutral')
    expect(gabriellaOption.classLabel).toBe('中立')
    expect(gabriellaOption.subtitle).toBe('私人警卫')
    expect(gabriellaOption.stats).toEqual({ willpower: 3, intellect: 2, combat: 4, agility: 1 })
    expect(gabriellaOption.health).toBe(8)
    expect(gabriellaOption.sanity).toBe(4)
    // 面板实际渲染：4 张真实卡面（绑定各自卡号）+ 副标题 + 四维（4×4）+ 生命理智 + 独立「详情」按钮。
    await expect(storyPanel.locator('.ah-story-art .ah-table-art')).toHaveCount(4)
    expect(await storyPanel.locator('.ah-story-art .ah-table-art')
      .evaluateAll(nodes => nodes.map(node => node.dataset.artCode))).toEqual(['05046', '05047', '05048', '05049'])
    await expect(storyPanel.locator('.ah-story-face small')).toHaveCount(4)
    await expect(storyPanel.locator('.ah-story-stat')).toHaveCount(16)
    await expect(storyPanel.locator('.ah-story-vitals').first()).toHaveText('生命 8 · 理智 4')
    await expect(storyPanel.locator('[data-story-detail]')).toHaveCount(4)
    // 卡面「可以 Alt」：按住 Alt 悬停 → 放大卡图与规则文字（同一套 card-zoom）。
    const storyZoom = page.locator('.ah-card-zoom')
    await storyPanel.locator('.ah-story-art .ah-table-art').first().hover()
    await page.keyboard.down('Alt')
    await expect(storyZoom).toBeVisible()
    await expect(storyZoom).toHaveAttribute('data-zoom-for', '05046')
    await expect(storyZoom.locator('h3')).toHaveText('加弗瑞拉·米兹拉克')
    await expect(storyZoom.locator('.ah-card-zoom-rules')).not.toBeEmpty()
    await page.keyboard.up('Alt')
    await expect(storyZoom).toHaveCount(0)
    // 「详情」打开完整人物档案（与牌桌其它卡牌详情同一弹窗）：正面卡面 + 背面设置都在，关闭后仍可正常选择。
    await clickSettled(page, storyPanel.locator('[data-story-detail]').first(), '查看故事调查员档案')
    const storyDialog = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(storyDialog).toBeVisible()
    await expect(storyDialog).toContainText('加弗瑞拉·米兹拉克')
    await clickSettled(page, storyDialog.getByRole('button', { name: '背面', exact: true }), '人物档案背面')
    await expect(storyDialog).toContainText('冒险设置')
    await expect(storyDialog).toContainText('起始手牌')
    await clickSettled(page, page.getByRole('button', { name: '关闭卡牌详情' }), '关闭卡牌详情')
    await expect(storyDialog).toHaveCount(0)
    const gabriella = storyPanel.getByRole('button', { name: /^选择 加弗瑞拉·米兹拉克/ })
    await expect(gabriella).toBeVisible()
    await clickSettled(page, gabriella, '选择加弗瑞拉·米兹拉克')
    const inScenario = await waitForSession(page, sessionId,
      session => session.state.uiState === 'inScenario' && !session.state.pendingChoice, '序章牌桌')
    expect(inScenario.state.scenario.id).toBe('disappearanceAtTheTwilightEstate')

    // 真实章节名：牌桌标题来自 state.scenario.name。
    await settleUi(page)
    await expect(page.locator('.bg-game-title').first()).toContainText('暮色庄园失踪事件')
    // 地点：真实地图节点（入口大厅 / 维多利亚式宴会厅）适配到视口内，不是写死文案。
    await fitLocationMap(page, label === 'desktop')
    await expect(page.locator('body')).toContainText('入口大厅')
    await expect(page.locator('body')).toContainText('维多利亚式宴会厅')
    // 幕 / 议程在「调查局势」里可见（与 P8 同一读点，数据来自本局真实状态）。
    await clickSettled(page, page.getByRole('button', { name: '局势', exact: true }), '局势')
    const situation = page.getByRole('dialog', { name: '调查局势' })
    await expect(situation).toBeVisible()
    await expect(situation).toContainText('失踪事件')
    await expect(situation).toContainText('审判·XX')
    await clickSettled(page, page.getByRole('button', { name: '关闭局势详情' }), '关闭局势详情')
    await expect(situation).toHaveCount(0)
    // 无 pageerror、无横向溢出（1px 容差）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    const prologueShot = `${output}p10-release-prologue-${label}.png`
    await settleUi(page)
    await page.screenshot({ path: prologueShot, fullPage: true, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: prologueShot })

    // d. 章节推进：全部通过页面内真实 POST /api/move 提交引擎合法动作。
    let session = inScenario
    expect(session.state.legalMoves.some(move => move.action === 'move' && move.locationId === 'entryHall')).toBe(true)
    let result = await submitMove(page, sessionId, session.state.revision, { action: 'move', locationId: 'entryHall' })
    expect(result.payload.ok, JSON.stringify(result.payload.error || '')).toBe(true)
    session = result.payload.session
    // 撤退：从 legalMoves 里取 rule==='resignEntryHall' 的 scenarioAction，不手写动作对象。
    const resign = session.state.legalMoves.find(move => move.action === 'scenarioAction' && move.rule === 'resignEntryHall')
    expect(resign, '入口大厅撤退动作缺失').toBeTruthy()
    result = await submitMove(page, sessionId, session.state.revision, resign)
    expect(result.payload.ok, JSON.stringify(result.payload.error || '')).toBe(true)
    session = result.payload.session
    // 逐个结算 reaction 待决选择：优先 skip/done，直到关卡结算。
    let guard = 0
    while (session.state.pendingChoice && guard++ < 10) {
      const choice = session.state.pendingChoice
      const optionIds = (choice.options || []).map(option => String(option.id))
      const pick = optionIds.find(id => id === 'skip' || id === 'done')
        || optionIds.find(id => /skip|done/i.test(id))
        || optionIds[0]
      expect(pick, `待决选择 ${choice.kind} 没有可提交选项`).toBeTruthy()
      result = await submitMove(page, sessionId, session.state.revision,
        { action: 'choose', choiceId: choice.id, optionId: pick })
      expect(result.payload.ok, JSON.stringify(result.payload.error || '')).toBe(true)
      session = result.payload.session
    }
    expect(session.state.uiState).toBe('scenarioResult')
    expect((session.state.legalMoves || []).map(move => move.action)).toEqual(['hubContinue'])

    // 用牌桌自带的「刷新局势」把真实会话同步到界面，再提交 hubContinue（真实 /api/move）。
    // 刷新会重放这段时间的演出（故事/密谋揭示），必须把演出队列走完，界面才落到关卡结算页。
    await syncUi(page, page.getByRole('button', { name: '刷新局势' }), 'scenarioResult', '刷新局势')
    expect(session.state.campaign.scenarioIndex).toBe(0)
    result = await submitMove(page, sessionId, session.state.revision, { action: 'hubContinue' })
    expect(result.payload.ok, JSON.stringify(result.payload.error || '')).toBe(true)
    session = result.payload.session
    // 真实战役流程前进到下一章《巫异时刻》（节点与章节序号都取自真实 state.campaign）。
    expect(session.state.uiState).toBe('scenarioSetup')
    expect(session.state.campaign.flow.nodeId).toBe('theWitchingHour')
    expect(session.state.campaign.scenarioIndex).toBe(1)

    // 用大厅自带的「刷新」同步并断言下一章界面。
    await syncUi(page, page.getByRole('button', { name: '刷新', exact: true }), 'scenarioSetup', '刷新')
    const nav = page.getByRole('navigation', { name: '战役局外页面' })
    await clickSettled(page, nav.getByRole('button', { name: '关卡选择' }), '关卡选择')
    const witchingCase = page.locator('.ah-office-case', { hasText: '巫异时刻' })
    await expect(witchingCase.first()).toBeVisible()
    await expect(witchingCase.first()).toContainText('已选择')
    // 出发准备页标题也指向下一章。
    await clickSettled(page, nav.getByRole('button', { name: '开始关卡', exact: true }), '开始关卡标签')
    await expect(page.locator('.ah-office-departure h2')).toContainText('巫异时刻')
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    const chapterShot = `${output}p10-release-chapter-${label}.png`
    await settleUi(page)
    await page.screenshot({ path: chapterShot, fullPage: true, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: chapterShot })
  })
}
