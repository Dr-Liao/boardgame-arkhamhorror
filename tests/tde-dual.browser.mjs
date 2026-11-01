// 食梦者（TDE）P9 双线模式浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// 与 P5 的 tests/tde-modes.browser.mjs 的分工：P5 证据属于 audit/tde-ui-browser.json
// （playwright.tde-ui.config.mjs + 专用 reporter，保持不动）；本文件是 **P9 账本**
// （audit/tde-browser-acceptance.json）里的双线证据，独立路径、独立截图（artifacts/tde-migration/p9-dual-*），
// 并由 tools/playwright-tde-reporter.mjs 汇总。
//
// 覆盖（路线图 §1.4.1 / §7.1 交互 1–2、§11.2 门禁 2）：
//   · 四种开局模式入口（单线 A / 单线 B / 分选 / 并行）；
//   · 奇数人数时「并行双线」置灰并直接显示引擎原因（不是前端另写判断）；
//   · 选完模式后模式门收起：总览页不再有「开局模式 / 换线」面板（2026-11-02 用户口径），
//     分线改在出发准备页每张人物卡的「换位置」完成（真实提交）；
//   · 并行模式人数相等门与自由改线后的不平衡提示；
//   · 真人座位按线选人 + 自动构筑，牌组摘要只来自本线；
//   · 并行开局后局内只渲染本线牌桌（不分屏），另一条线只暴露公开摘要（无手牌/牌堆/事件/日志）。
//
// 入口用 webServer 注册的「双线演示」战役（ARKHAM_BROWSER_DEMO=dualHub，playwright.tde.config.mjs
// 的 webServer 负责设置）：只有声明 parts 的战役才出现模式面板；演示战役的 A/B 两幕复用核心
// 《聚会》的真实关卡模块，面板、分线与局内渲染都是生产 UI 代码。
// 开闸口径：演示战役在 content/browser-demo/dualHub.js 里显式 `dualLineGate:'open'`，只是让
// 「并行双线」的 UI 路径可点；真实《食梦者》的 dualLineGate 仍关（P9.5 才开闸），本 spec 不构成
// TDE 已开闸的证据。双线机制在真实 TDE parts 上的投影由 P9.5 矩阵验收。
//
// 已知引擎缺陷已修（P9，Lead）：并行启动时 launchParallelLanes 先 setPart 把 lane 的
// campaign.chaosBag 写成 []，旧 initializeChaosBag（src/engine/chaos-bag.js）以 truthy 判空，
// 导致逐线袋为空、大厅替 AI 行动时报「混乱袋为空」。现在 initializeChaosBag 把 [] 视为未初始化
// 并按本线 part 袋重建；本 spec 因此正常断言「begin 响应 ok:true、无错误 toast、本线牌桌可行动」。
//
// 证据命令：node ../../node_modules/@playwright/test/cli.js test --config playwright.tde.config.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const DEMO_CAMPAIGN = 'dualHubDemo'

// 从大厅进入双线演示战役：返回 hub locator 与真实 /api/start 的会话（准备阶段用接口推进时要用）。
async function openDualDemo(page, playerCount) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption(DEMO_CAMPAIGN)
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(String(playerCount))
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const session = (await (await started).json()).session
  return { hub: page.locator('.ah-hub'), session }
}

const modePanel = page => page.locator('.ah-hub').getByRole('region', { name: '开局模式', exact: true })
const shot = (testInfo, name) => {
  const path = `${output}${name}.png`
  testInfo.annotations.push({ type: 'screenshot', description: path })
  return path
}

// 开局/演出层会遮住牌桌：把排队中的故事/地点演出走完，截图与行动按钮断言才看得到真实牌桌。
async function dismissPresentation(page) {
  for (let attempt = 0; attempt < 50; attempt++) {
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

// ---------------------------------------------------------------- 交互 1：四模式入口 + 选完模式面板收起
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P9 双线四模式入口、奇数禁并行与选完模式面板收起在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'interaction', description: 'campaignOption' })
    const { hub } = await openDualDemo(page, 3)
    const panel = modePanel(page)
    await expect(panel).toBeVisible()
    // 模式先于一切：首屏没有页签栏、没有关卡/调查员入口。
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(0)
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(1)
    // 四种模式入口都在，三个可用；3 人时并行置灰并显示引擎原因（奇数不能等分）。
    await expect(panel.getByRole('button', { name: '单线 A' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: '单线 B' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: '分选' })).toBeEnabled()
    const parallel = panel.getByRole('button', { name: '并行双线' })
    await expect(parallel).toBeDisabled()
    await expect(parallel).toHaveAttribute('title', /奇数/)
    await expect(panel).toContainText(/两组人数相等/)
    await page.screenshot({ path: shot(testInfo, `p9-dual-mode-gate-${label}`), fullPage: true })

    // 选分选 → 模式门与面板一起收起；总览页不再保留「当前模式 / 逐座位换线」面板。
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '分选' }).click()
    const modeBody = await (await modeCommitted).json()
    expect(modeBody.ok, modeBody.error).toBe(true)
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(0)
    await expect(panel).toHaveCount(0)
    await expect(hub.getByText('开局模式', { exact: true })).toHaveCount(0)
    await expect(hub.getByRole('group', { name: '座位分线' })).toHaveCount(0)
    await expect(hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '战役总览' })).toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: shot(testInfo, `p9-dual-mode-picked-${label}`), fullPage: true })
  })
}

// ---------------------------------------------------------------- 交互 1 续：并行出门 + 出发准备页换线
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P9 并行双线模式门与出发准备分屏换线在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'interaction', description: 'campaignOption' })
    const { hub } = await openDualDemo(page, 4)
    const panel = modePanel(page)
    await expect(panel).toBeVisible()
    const parallel = panel.getByRole('button', { name: '并行双线' })
    await expect(parallel).toBeEnabled()
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await parallel.click()
    const session = (await (await modeCommitted).json()).session
    // 模式已定：面板收起，页签出现；引擎默认 2+2 分线。
    await expect(panel).toHaveCount(0)
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    expect(session.state.campaign.mode).toBe('parallel')
    expect(session.state.campaign.seatParts).toEqual(['A', 'A', 'B', 'B'])
    // 出发准备页承担全部手动分线：每张人物卡一键换位置（房主可换 AI 座位）。
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '开始关卡', exact: true }).click()
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible()
    const laneA = departure.locator('.ah-departure-lane[data-lane="A"]')
    const laneB = departure.locator('.ah-departure-lane[data-lane="B"]')
    await expect(laneA.locator('.ah-departure-member')).toHaveCount(2)
    await expect(laneB.locator('.ah-departure-member')).toHaveCount(2)
    await page.screenshot({ path: shot(testInfo, `p9-dual-departure-switch-${label}`), fullPage: true })
    // 座位 4 从 B 线换到 A 线（真实提交）→ 人物卡换栏；再换回 B 线。
    const moved = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneB.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    const movedBody = await (await moved).json()
    expect(movedBody.ok, movedBody.error).toBe(true)
    await expect(laneA.locator('[data-seat="3"]')).toBeVisible()
    await expect(laneB.locator('[data-seat="3"]')).toHaveCount(0)
    const back = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneA.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    await back
    await expect(laneB.locator('[data-seat="3"]')).toBeVisible()
  })
}

// ---------------------------------------------------------------- 交互 2：按线选人 + 自动牌组
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P9 按线选人与自动牌组在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    testInfo.annotations.push({ type: 'interaction', description: 'laneSelection' })
    const { hub } = await openDualDemo(page, 4)
    const panel = modePanel(page)
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '并行双线' }).click()
    await modeCommitted
    // 进入准备页：走大厅工作流引导的「选择调查员」。
    const goSetup = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubGoSetup')
    await hub.locator('.ah-workflow-guide').getByRole('button', { name: '选择调查员' }).click()
    await goSetup
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '调查员与席位' }).click()
    // 按线名册：A/B 两线各自一组，提示每座位只建一套牌组。
    const laneA = hub.locator('.ah-lane-roster[data-lane="A"]')
    const laneB = hub.locator('.ah-lane-roster[data-lane="B"]')
    await expect(laneA).toBeVisible()
    await expect(laneB).toBeVisible()
    await expect(laneA.getByRole('heading', { name: 'A 线' })).toBeVisible()
    await expect(laneB.getByRole('heading', { name: 'B 线' })).toBeVisible()
    await expect(hub.locator('.ah-lane-roster-note')).toContainText('A 线')
    // 真人座位（A 线座位 1）按线点选候选人。
    const mine = laneA.locator('.ah-office-investigator[data-seat="0"]')
    const picked = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSelectInvestigator')
    await mine.locator('.ah-office-candidate').first().click()
    const pickedBody = await (await picked).json()
    expect(pickedBody.ok, pickedBody.error).toBe(true)
    await expect(mine.getByText('调查员已选择')).toBeVisible()
    // 自动构筑合法牌组，牌组摘要来自本线快照（不是另一条线）。
    const built = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubAutoDeck')
    await mine.getByRole('button', { name: '自动构筑合法牌组' }).click()
    const builtBody = await (await built).json()
    expect(builtBody.ok, builtBody.error).toBe(true)
    await expect(mine.getByText(/牌组 \d+ 张/)).toBeVisible()
    await expect(mine.getByText('牌组尚未保存')).toHaveCount(0)
    await page.screenshot({ path: shot(testInfo, `p9-dual-lane-deck-${label}`), fullPage: true })
  })
}

// ---------------------------------------------------------------- 局内单线渲染 + 他线隐私
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P9 并行开局后局内只显示本线、不分屏且他线不可见（${label}）`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const opened = await openDualDemo(page, 4)
    const hub = opened.hub
    let session = opened.session
    const panel = modePanel(page)
    const panelMode = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '并行双线' }).click()
    session = (await (await panelMode).json()).session
    // 准备阶段用真实 /api/move 推进（等价于点完四个座位的选人/自动牌组/确认），页面刷新取权威状态。
    const post = async (move, seat) => {
      const response = await request.post('/api/move', {
        data: {
          sessionId: session.sessionId,
          revision: session.state.revision,
          seat,
          move: { ...move, revision: session.state.revision },
        },
      })
      const body = await response.json()
      expect(body.ok, `${seat}:${move.action} -> ${body.error}`).toBe(true)
      session = body.session
    }
    await post({ action: 'hubGoSetup' }, 0)
    await post({ action: 'hubSelectInvestigator', code: '01001' }, 0)
    await post({ action: 'hubAutoDeck' }, 0)
    await post({ action: 'hubDoneSeat' }, 0)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible()
    const begin = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
    await departure.getByRole('button', { name: '开始当前关卡' }).click()
    const beginBody = await (await begin).json()
    // 并行启动：逐线混乱袋按本线 part 重建（P9 修复 initializeChaosBag 对 [] 的判空），
    // 服务端替 AI 行动不再报错，响应必须成功、界面不得留下错误条。
    expect(beginBody.ok, beginBody.error).toBe(true)
    await expect(page.locator('.bg-toast')).toHaveCount(0)
    // 局内：只渲染本线牌桌，不做左右分屏；出发页的双线分屏容器消失。
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
    await dismissPresentation(page)
    await expect(page.locator('.ah-departure-split')).toHaveCount(0)
    await expect(page.locator('.ah-departure-lane')).toHaveCount(0)
    await expect(page.locator('.ah-lane-roster')).toHaveCount(0)
    // 标题是 A 线关卡（真实 state.scenario.name，标题栏只显示末段，完整名在 title 属性里），
    // 另一线的关卡名/牌桌不进入界面。
    await expect(page.locator('.bg-game-title').first()).toHaveAttribute('title', /第一幕：集结/)
    await expect(page.locator('body')).not.toContainText('第二幕：午夜假面')
    // 隐私（状态层）：浏览器拿到的投影里，另一线只有公开摘要字段，没有手牌/牌堆/事件/日志。
    const current = await page.evaluate(async sessionId => {
      const response = await fetch('/api/session?sessionId=' + encodeURIComponent(sessionId))
      return (await response.json()).session?.state || null
    }, session.sessionId)
    expect(current?.parallel?.lane).toBe('A')
    const other = current?.parallel?.other || {}
    expect(other.lane).toBe('B')
    expect(other.scenarioId).toBe('demoB1')
    for (const forbidden of ['hand', 'deck', 'cards', 'tableState', 'events', 'log', 'investigators', 'story']) {
      expect(forbidden in other, `另一线投影不应包含 ${forbidden}`).toBe(false)
    }
    // 本线牌桌可行动：A 线真人座位从服务端投影拿到本线 legalMoves（不是空局），牌桌壳可见。
    // 不断言具体按钮文案：开局可能是起手换牌等待决选择、也可能轮到 AI 演出，界面阶段会变，
    // 但「本线合法动作非空 + 牌桌在本线渲染」是稳定事实。
    expect(Array.isArray(current?.legalMoves) && current.legalMoves.length > 0).toBe(true)
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', /\d+/)
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    await page.addStyleTag({ content: '.bg-chat-toasts { display: none !important; }' })
    await page.screenshot({ path: shot(testInfo, `p9-dual-in-game-${label}`), fullPage: true })
  })
}
