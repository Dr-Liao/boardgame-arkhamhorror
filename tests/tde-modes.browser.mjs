// 食梦者（TDE）P5 浏览器验收：开局模式门（交互 1）、按线选人/牌组（交互 2）与并行出发准备分屏（W2）。
//
// 2026-11-02 UI 调整（用户口径）：「开局模式」面板只在首屏模式门出现；选完模式后「战役总览」页
// 不再保留「当前模式 / 逐座位换线」面板（原红色圈出的切线 UI 已删除）。手动分线改在「出发准备」
// 页每张人物卡的「换位置」上完成，因此本 spec 额外断言：
//   · 选定模式后模式门与面板一起消失，总览页没有「开局模式」region；
//   · 出发准备分屏里每张人物卡都能一键换线，人数不等时「开始」置灰并给出引擎原因；
//   · 本线插图铺满栏宽置于栏顶（两线同尺寸），四张人物卡固定尺寸、底边对齐。
//
// 路线图 §7 / §11.2：交互第 1–2 条要有桌面 1440 与移动 390 的真实操作路径 + 截图；
// 面板只在声明 parts 的战役里出现，所以本 spec 用 webServer 注册的「双线演示」战役
// （ARKHAM_BROWSER_DEMO=dualHub）作为入口；结果由 tools/playwright-tde-ui-reporter.mjs
// 写成 audit/tde-ui-browser.json（runner 生成，不手写）。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

async function startDualDemo(page, playerCount = '3') {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('dualHubDemo')
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption(playerCount)
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const session = (await (await started).json()).session
  return { hub: page.locator('.ah-hub'), session }
}

const modePanel = page => page.locator('.ah-hub').getByRole('region', { name: '开局模式', exact: true })

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M5 食梦者开局模式门与四模式在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const { hub } = await startDualDemo(page, '3')
    const panel = modePanel(page)
    await expect(panel).toBeVisible()
    // 模式先于一切：首屏没有页签栏，也没有关卡/调查员入口。
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(0)
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(1)
    // 四种模式都在，且标题说明为什么需要先选模式。
    await expect(panel.getByRole('button', { name: '单线 A' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: '单线 B' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: '分选' })).toBeEnabled()
    // 3 人时并行置灰，并直接显示引擎给出的原因（不是前端另写一套判断）。
    const parallel = panel.getByRole('button', { name: '并行双线' })
    await expect(parallel).toBeDisabled()
    await expect(parallel).toHaveAttribute('title', /奇数/)
    // 初始四模式面板（含置灰的并行与原因）先截一张，再进分选看模式门收起。
    const shotGate = `${output}mode-gate-${label}.png`
    await page.screenshot({ path: shotGate, fullPage: true })
    testInfo.annotations.push({ type: 'screenshot', description: shotGate })
    const shotModes = `${output}modes-${label}.png`
    await panel.screenshot({ path: shotModes })
    testInfo.annotations.push({ type: 'screenshot', description: shotModes })
    // 选分选 → 模式门与面板一起消失，页签出现；总览页不再保留「开局模式 / 换线」面板。
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '分选' }).click()
    await modeCommitted
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(0)
    await expect(hub.getByRole('region', { name: '开局模式', exact: true })).toHaveCount(0)
    await expect(hub.getByText('开局模式', { exact: true })).toHaveCount(0)
    // 逐座位换线按钮随面板一起移除，总览页只保留战役信息与难度。
    await expect(hub.getByRole('group', { name: '座位分线' })).toHaveCount(0)
    await expect(hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '战役总览' })).toHaveAttribute('aria-current', 'page')
    const shotPicked = `${output}modes-picked-${label}.png`
    await page.screenshot({ path: shotPicked, fullPage: true })
    testInfo.annotations.push({ type: 'screenshot', description: shotPicked })
  })
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M5 并行双线选完模式后从出发准备分屏一键换线在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const { hub } = await startDualDemo(page, '4')
    const panel = modePanel(page)
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: '并行双线' })).toBeEnabled()
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '并行双线' }).click()
    const session = (await (await modeCommitted).json()).session
    // 模式已定：整块开局模式面板消失，页签出现；引擎仍按默认 2+2 分线。
    await expect(hub.locator('nav.ah-hub-tabs')).toHaveCount(1)
    await expect(hub.getByRole('region', { name: '开局模式', exact: true })).toHaveCount(0)
    expect(session.state.campaign.mode).toBe('parallel')
    expect(session.state.campaign.seatParts).toEqual(['A', 'A', 'B', 'B'])
    // 出发准备页（还没准备调查员）就能看到左右分屏与每张人物卡的「换位置」。
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '开始关卡', exact: true }).click()
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible()
    const laneA = departure.locator('.ah-departure-lane[data-lane="A"]')
    const laneB = departure.locator('.ah-departure-lane[data-lane="B"]')
    await expect(laneA).toBeVisible()
    await expect(laneB).toBeVisible()
    await expect(laneA.locator('.ah-departure-member')).toHaveCount(2)
    await expect(laneB.locator('.ah-departure-member')).toHaveCount(2)
    // 座位 4 从 B 线一键换到 A 线（真实 /api/move 提交）→ 人物卡换栏；再换回 B 线。
    const moved = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneB.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    const movedBody = await (await moved).json()
    expect(movedBody.ok, movedBody.error).toBe(true)
    await expect(laneA.locator('[data-seat="3"]')).toBeVisible()
    await expect(laneB.locator('[data-seat="3"]')).toHaveCount(0)
    const movedBack = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneA.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    await movedBack
    await expect(laneB.locator('[data-seat="3"]')).toBeVisible()
  })
}

test('M5 非双线战役不出现开局模式门，页签照常可用', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('nightOfTheZealot')
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('2')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  // 模式门只属于声明 parts 的战役：核心循环照旧直接进战役台面。
  await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(0)
  await expect(hub.getByRole('region', { name: '开局模式', exact: true })).toHaveCount(0)
  await expect(hub.locator('nav.ah-hub-tabs')).toBeVisible()
})

// 出发准备页的并行分屏（W2 参考界面 + 2026-11-02 版式调整）：左 A / 右 B，两线各自选队长，
// 插图置顶铺满栏宽，四张人物卡固定尺寸。
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M5 并行出发准备左右分屏、插图置顶与固定卡尺寸在${label}端可用`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('dualHubDemo')
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('4')
    const started = page.waitForResponse('**/api/start')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    let session = (await (await started).json()).session
    const hub = page.locator('.ah-hub')
    const panel = hub.getByRole('region', { name: '开局模式', exact: true })
    const modeCommitted = page.waitForResponse(r => r.url().endsWith('/api/move'))
    await panel.getByRole('button', { name: '并行双线' }).click()
    session = (await (await modeCommitted).json()).session
    // 准备阶段用接口推进（等价于点完四个座位的选人/自动牌组/确认），页面随后刷新取权威状态。
    const post = async (move, seat) => {
      const res = await request.post('/api/move', {
        data: { sessionId: session.sessionId, revision: session.state.revision, seat, move: { ...move, revision: session.state.revision } },
      })
      const body = await res.json()
      expect(body.ok, `${seat}:${move.action} -> ${body.error}`).toBe(true)
      session = body.session
    }
    await post({ action: 'hubGoSetup' }, 0)
    // 只有座位 1 是真人，其余座位由大厅按 AI 自动准备；真人座位选人 + 自动牌组 + 确认即可。
    await post({ action: 'hubSelectInvestigator', code: '01001' }, 0)
    await post({ action: 'hubAutoDeck' }, 0)
    await post({ action: 'hubDoneSeat' }, 0)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    const departure = hub.locator('[data-parallel="true"]')
    await expect(departure).toBeVisible()
    const laneA = departure.locator('.ah-departure-lane[data-lane="A"]')
    const laneB = departure.locator('.ah-departure-lane[data-lane="B"]')
    await expect(laneA).toBeVisible()
    await expect(laneB).toBeVisible()
    await expect(laneA.getByText('A 线')).toBeVisible()
    await expect(laneB.getByText('B 线')).toBeVisible()
    // 每线显示自己的关卡名与插图（演示战役 A=第一幕、B=第二幕）。
    await expect(laneA.getByText('第一幕：集结')).toBeVisible()
    await expect(laneB.getByText('第二幕：午夜假面')).toBeVisible()
    await expect(laneA.locator('.ah-departure-lane-art > *')).toHaveCount(1)
    await expect(laneB.locator('.ah-departure-lane-art > *')).toHaveCount(1)
    // 插图放大并置于每栏顶部：两线同尺寸、同 y，且位于栏标题上方。
    const artA = await laneA.locator('.ah-departure-lane-art').boundingBox()
    const artB = await laneB.locator('.ah-departure-lane-art').boundingBox()
    const headA = await laneA.locator('.ah-departure-lane-head').boundingBox()
    const headB = await laneB.locator('.ah-departure-lane-head').boundingBox()
    expect(artA.width).toBeGreaterThan(0)
    expect(Math.abs(artA.width - artB.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(artA.height - artB.height)).toBeLessThanOrEqual(1)
    if (label === 'desktop') expect(Math.abs(artA.y - artB.y)).toBeLessThanOrEqual(1)
    expect(Math.round(artA.width)).toBeGreaterThan(260)
    expect(artB.y).toBeLessThan(headB.y)
    expect(artA.y).toBeLessThan(headA.y)
    // 插图上下左右都有渐变虚化：容器与子图各一层线性遮罩（上下 + 左右相乘），
    // ::before/::after 再叠两层 backdrop-blur 让四边/四角真正糊开。
    const artFade = await laneA.locator('.ah-departure-lane-art').evaluate(node => {
      const cs = getComputedStyle(node), child = getComputedStyle(node.firstElementChild)
      const before = getComputedStyle(node, '::before'), after = getComputedStyle(node, '::after')
      return {
        maskTopBottom: cs.maskImage || cs.webkitMaskImage || '',
        maskLeftRight: child.maskImage || child.webkitMaskImage || '',
        blurBefore: before.backdropFilter || before.webkitBackdropFilter || '',
        blurAfter: after.backdropFilter || after.webkitBackdropFilter || '',
      }
    })
    expect(artFade.maskTopBottom).toContain('gradient')
    expect(artFade.maskLeftRight).toContain('gradient')
    expect(artFade.blurBefore).toContain('blur')
    expect(artFade.blurAfter).toContain('blur')
    // 人物卡固定尺寸：四张同宽同高；桌面同一排且底边对齐（有「查看准备」按钮也不拉高卡片）。
    const memberBoxes = await departure.locator('.ah-departure-member').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect()
      return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), bottom: Math.round(rect.bottom) }
    }))
    expect(memberBoxes).toHaveLength(4)
    expect(new Set(memberBoxes.map(item => item.w)).size).toBe(1)
    expect(new Set(memberBoxes.map(item => item.h)).size).toBe(1)
    if (label === 'desktop') {
      expect(new Set(memberBoxes.map(item => item.y)).size).toBe(1)
      expect(new Set(memberBoxes.map(item => item.bottom)).size).toBe(1)
    }
    // 人物卡两列横排：桌面 2+2 时两线各一排；移动端窄屏单列。
    const tops = await laneA.locator('.ah-departure-member').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(label === 'desktop' ? 1 : 2)
    // 队长与换位置都是人物卡里的文字动作；AI 的换位置由房主操作，一键换线。
    const bSeat = laneB.locator('[data-seat="3"]')
    await expect(bSeat.getByRole('button', { name: '设为队长' })).toBeVisible()
    await bSeat.getByRole('button', { name: '设为队长' }).click()
    await expect(laneB.locator('[data-seat="3"]').getByText('队长', { exact: true })).toBeVisible()
    // 一键换线：点 B 线座位 4 的「换位置」→ 直接到 A 线；人数变 3:1 后开始按钮置灰并带引擎原因。
    const moved = page.waitForResponse(r => r.url().endsWith('/api/move') && r.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneB.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    await moved
    await expect(laneA.locator('[data-seat="3"]')).toBeVisible()
    await expect(laneB.locator('[data-seat="3"]')).toHaveCount(0)
    const startButton = departure.getByRole('button', { name: '开始当前关卡' })
    await expect(startButton).toBeDisabled()
    await expect(startButton).toHaveAttribute('title', /两线人数必须相等/)
    const back = page.waitForResponse(r => r.url().endsWith('/api/move') && r.request().postDataJSON()?.move?.action === 'hubSetSeatPart')
    await laneA.locator('[data-seat="3"]').getByRole('button', { name: '换位置' }).click()
    await back
    await expect(laneB.locator('[data-seat="3"]')).toBeVisible()
    await expect(startButton).toBeEnabled()
    // 截图前回到页面/滚动容器顶部（移动端尤其重要，否则只截到 B 线中段）。
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      for (const el of document.querySelectorAll('.ah-hub, .bg-game, .ah-hub-pane, .ah-departure-split')) {
        if (el && typeof el.scrollTop === 'number') el.scrollTop = 0
      }
    })
    // 等 AI 准备提示横幅自动消失，避免截图被通知遮住左侧队伍。
    await page.waitForTimeout(5000)
    // 大厅的 AI 准备提示是瞬时聊天横幅；截图前隐藏，避免遮住左侧队伍（不影响被测界面）。
    await page.addStyleTag({ content: '.bg-chat-toasts { display: none !important; }' })
    const shot = `${output}departure-parallel-${label}.png`
    await page.screenshot({ path: shot, fullPage: true })
    testInfo.annotations.push({ type: 'screenshot', description: shot })
    const split = departure.locator('.ah-departure-split')
    expect(await split.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    if (label === 'mobile') {
      // 移动端再截一张滚到双线卡片区的图，证明 A/B 两段都能看到人物卡。
      await split.scrollIntoViewIfNeeded()
      const shotLanes = `${output}departure-parallel-${label}-lanes.png`
      await page.screenshot({ path: shotLanes })
      testInfo.annotations.push({ type: 'screenshot', description: shotLanes })
    }
  })
}

test('M5 并行开局后局内不做分屏：两条线在后台同时运行，画面只显示本线', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('dualHubDemo')
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('4')
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  let session = (await (await started).json()).session
  const hub = page.locator('.ah-hub')
  const panel = hub.getByRole('region', { name: '开局模式', exact: true })
  const modeCommitted = page.waitForResponse(r => r.url().endsWith('/api/move'))
  await panel.getByRole('button', { name: '并行双线' }).click()
  session = (await (await modeCommitted).json()).session
  const post = async (move, seat) => {
    const res = await request.post('/api/move', {
      data: { sessionId: session.sessionId, revision: session.state.revision, seat, move: { ...move, revision: session.state.revision } },
    })
    const body = await res.json()
    expect(body.ok, body.error).toBe(true)
    session = body.session
  }
  await post({ action: 'hubGoSetup' }, 0)
  await post({ action: 'hubSelectInvestigator', code: '01001' }, 0)
  await post({ action: 'hubAutoDeck' }, 0)
  await post({ action: 'hubDoneSeat' }, 0)
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const departure = hub.locator('[data-parallel="true"]')
  await expect(departure).toBeVisible()
  const begin = page.waitForResponse(r => r.url().endsWith('/api/move') && r.request().postDataJSON()?.move?.action === 'hubBeginScenario')
  await departure.getByRole('button', { name: '开始当前关卡' }).click()
  await begin
  // 局内：只渲染本线牌桌，不做左右分屏（另一条线在后台跑）。
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.ah-departure-split')).toHaveCount(0)
  await page.addStyleTag({ content: '.bg-chat-toasts { display: none !important; }' })
  const shot = `${output}parallel-in-game-desktop.png`
  await page.screenshot({ path: shot, fullPage: true })
  testInfo.annotations.push({ type: 'screenshot', description: shot })
})

// 交互 2：真人座位在调查员页按线点选候选人并自动构筑，牌组摘要来自本线快照。
for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M5 并行按线选人与自动牌组在${label}端可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('dualHubDemo')
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('4')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    const hub = page.locator('.ah-hub')
    const panel = hub.getByRole('region', { name: '开局模式', exact: true })
    const modeCommitted = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '并行双线' }).click()
    await modeCommitted
    await page.addStyleTag({ content: '.bg-chat-toasts { display: none !important; }' })
    const guide = hub.locator('.ah-workflow-guide')
    const goSetup = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubGoSetup')
    await guide.getByRole('button', { name: '选择调查员' }).click()
    await goSetup
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '调查员与席位' }).click()
    const laneA = hub.locator('.ah-lane-roster[data-lane="A"]')
    await expect(laneA).toBeVisible()
    await expect(laneA.getByRole('heading', { name: 'A 线' })).toBeVisible()
    await expect(hub.locator('.ah-lane-roster[data-lane="B"]')).toBeVisible()
    await expect(hub.locator('.ah-lane-roster-note')).toContainText('A 线')
    const mine = laneA.locator('.ah-office-investigator[data-seat="0"]')
    const picked = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSelectInvestigator')
    await mine.locator('.ah-office-candidate').first().click()
    const pickedBody = await (await picked).json()
    expect(pickedBody.ok, pickedBody.error).toBe(true)
    await expect(mine.getByText('调查员已选择')).toBeVisible()
    const built = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubAutoDeck')
    await mine.getByRole('button', { name: '自动构筑合法牌组' }).click()
    const builtBody = await (await built).json()
    expect(builtBody.ok, builtBody.error).toBe(true)
    await expect(mine.getByText(/牌组 \d+ 张/)).toBeVisible()
    await expect(mine.getByText('牌组尚未保存')).toHaveCount(0)
    const shot = `${output}lane-deck-${label}.png`
    await page.screenshot({ path: shot, fullPage: true })
    testInfo.annotations.push({ type: 'screenshot', description: shot })
  })
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M5 场景交互面板在${label}端可翻开掩藏地点`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('dualHubDemo')
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
    const started = page.waitForResponse('**/api/start')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    let session = (await (await started).json()).session
    const hub = page.locator('.ah-hub')
    const panel = hub.getByRole('region', { name: '开局模式', exact: true })
    const modeCommitted = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: '单线 A' }).click()
    session = (await (await modeCommitted).json()).session
    const post = async (move, seat) => {
      const res = await request.post('/api/move', {
        data: { sessionId: session.sessionId, revision: session.state.revision, seat, move: { ...move, revision: session.state.revision } },
      })
      const body = await res.json()
      expect(body.ok, body.error).toBe(true)
      session = body.session
    }
    await post({ action: 'hubGoSetup' }, 0)
    await post({ action: 'hubSelectInvestigator', code: '01001' }, 0)
    await post({ action: 'hubAutoDeck' }, 0)
    await post({ action: 'hubDoneSeat' }, 0)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    const begin = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
    await hub.getByRole('button', { name: '开始当前关卡' }).click()
    await begin
    const bar = page.getByRole('region', { name: '场景交互' })
    await expect(bar).toBeVisible({ timeout: 30000 })
    // 「隐藏手牌」区块依赖 legalMoves（只有可攻击/躲避入口才渲染），开场演出期间还没有合法行动，
    // 因此放在下面的演出跳过循环之后断言；其余 7 个面板来自状态投影，开场即可读。
    for (const title of ['蜂拥', '滋生袋', '警报等级', '掩藏地点', '参考计数', '纵向堆叠', '梦境之门与结局']) {
      await expect(bar.getByRole('heading', { name: title })).toBeVisible()
    }
    await expect(bar).not.toContainText('secret-ending')
    await expect(bar).not.toContainText('secret-a')
    await expect(bar.getByText('已到达的结局')).toBeVisible()
    const flip = bar.getByRole('button', { name: /翻开掩藏地点/ })
    for (let guard = 0; guard < 20 && await flip.count() === 0; guard += 1) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) { await skip.first().click(); continue }
      const cont = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
      if (await cont.count()) { await cont.first().click(); continue }
      const done = page.locator('[data-option-id="done"]:not([disabled])').first()
      if (await done.count()) { await done.click(); continue }
      await page.waitForTimeout(200)
    }
    await expect(flip).toBeVisible()
    // 演出结束、legalMoves 可用：demo seed 的 06017（引擎 hiddenEnemyInHand）应给出隐藏手牌区块与攻击/躲避按钮。
    const hiddenSection = bar.locator('[data-interaction="hidden"]')
    await expect(hiddenSection.getByRole('heading', { name: '隐藏手牌' })).toBeVisible()
    await expect(hiddenSection.getByRole('button', { name: /攻击手牌中的/ })).toBeVisible()
    await expect(hiddenSection.getByRole('button', { name: /躲避手牌中的/ })).toBeVisible()
    const flipped = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'flipVeiled')
    await flip.click()
    const flippedBody = await (await flipped).json()
    expect(flippedBody.ok, flippedBody.error).toBe(true)
    await expect(bar.getByText('背面 demo-story')).toBeVisible()
    await page.addStyleTag({ content: '.bg-chat-toasts { display: none !important; }' })
    const shot = `${output}scenario-interactions-${label}.png`
    await page.screenshot({ path: shot, fullPage: true })
    testInfo.annotations.push({ type: 'screenshot', description: shot })
  })
}
