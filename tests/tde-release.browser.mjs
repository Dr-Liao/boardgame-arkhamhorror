// 《食梦者》（TDE）P10 发布门禁浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// P10（2026-11-01）起三包 + 战役 + 8 章已注册进生产 `content/registered.js`：战役/章节/包
// status 全 playable、`dualLineGate:'open'`、`contentRegistry.assertLaunchable('theDreamEaters')`
// 通过、真实大厅 `campaignListForUi` 可见。本 spec 是**发布门禁**而不是 P9 的载体门禁：
//
//   · 真实大厅可见《食梦者》：启动页 → 调查准备设置 → 「战役」下拉含 theDreamEaters（文案「食梦者」）；
//   · 真实大厅启动单线 A：选 4 席位 → 开始新游戏（真实 /api/start）→ 开局模式门 → 单线 A →
//     「选择调查员」候选池含食梦者 5 人（06001–06005）→ 真人选 06001 → 自动牌组/确认 → 出发准备
//     （真实章名《梦境门外》）→ 开始当前关卡（真实 /api/move）→ 局内牌桌；
//   · 8 章列表：关卡选择页列出 8 个真实章节名（A/B 各 4 章）；
//   · 包状态与版本：战役总览「内容包与规则范围」含 tde* 三包与真实状态；catalog 版本 = package.json；
//   · 规则书入口：F1 打开规则书，17 条 tde 条目齐全，战役总览条目含真实章节名。
//
// 与 tests/tde-browser-shell.mjs 的区别：本 spec **不注册任何内容、不注入状态**，全部走真实
// server 进程（生产组合根）与真实 web/；8 章逐章实机证据在 tests/tde-scenarios.browser.mjs。
//
// 证据命令：node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tde.config.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { manifest as tdeCampaign } from '../content/campaigns/theDreamEaters/manifest.js'

const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const RELEASE_TIMEOUT = 180_000
const TDE_CAMPAIGN = 'theDreamEaters'
const TDE_INVESTIGATOR_CODES = Object.freeze(['06001', '06002', '06003', '06004', '06005'])
const TDE_PACK_IDS = Object.freeze(['tdeCampaign', 'tdeInvestigators', 'tdePlayer'])
// package.json 是「版本显示」的事实源；大厅 catalog 下发的 game.version 必须与它一致。
const MOD_PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const MOD_VERSION = String(MOD_PACKAGE.version || '')
// 8 章真实章名（生产注册表；不手写文案）。
const TDE_CHAPTER_NAMES = tdeCampaign.scenarioIds.map(id => contentRegistry.getScenario(id).name)
// 单线 A 的第一章：出发准备页与局内标题都应显示它。
const FIRST_A_CHAPTER = contentRegistry.getScenario(tdeCampaign.parts.A.chapters[0].scenarioId)

function shotPath(name) {
  return `${output}${name}.png`
}

// 开局/演出层会遮住牌桌：把排队中的故事/地点演出走完，再断言与截图真实牌桌。
async function dismissPresentation(page) {
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

// 局内真实待决选择（故事/起手换牌等）：真实大厅里由真人点选，这里点第一个可用选项，
// 直到队列清空；演出层（故事导入）先走完。P9 的注入 spec 是在 spec 进程结算选择，
// P10 门禁走真实界面，所以必须按真实玩家的操作顺序点掉。
// 注意：演出/选择是异步队列（presentation.sync 可能晚一帧挂上），必须等「连续两次都没有」。
async function settleTableToPlayable(page) {
  // 演出是异步队列（presentation.sync 在 applyMove 响应后排队播放），开始前先给队列一个挂载窗口，
  // 否则可能把「还没挂上演出」误判成已清空。
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

// 真实牌桌可能连续排好几段演出（故事导入 → 换牌 → 阶段演出），而 presentation 队列在页面
// 加载较重时会出现 >1s 的间隔。外层循环反复进入结算，直到「连续 1.2s 无演出、无待决选择」，
// 避免在全量跑（同 worker 多 spec）时把队列间隙误判成已完成。
async function waitForPlayableTable(page, timeout = 120_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    await settleTableToPlayable(page)
    await page.waitForTimeout(1200)
    if (await page.locator('.ah-cinematic').count() === 0 && await page.locator('.ah-choice').count() === 0) return
  }
  throw new Error(`牌桌演出/待决选择未清空（cinematic=${await page.locator('.ah-cinematic').count()} choice=${await page.locator('.ah-choice').count()}）`)
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P10 发布门禁：真实大厅可见并启动《食梦者》单线 A（${label} ${width}×${height}）`, async ({ page, request }, testInfo) => {
    test.setTimeout(RELEASE_TIMEOUT)
    await page.setViewportSize({ width, height })
    const shots = []
    const screenshot = async (name, fullPage = true) => {
      const path = shotPath(name)
      shots.push(path)
      testInfo.annotations.push({ type: 'screenshot', description: path })
      await page.screenshot({ path, fullPage, animations: 'disabled' })
    }
    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    // a. 真实大厅：启动页 → 调查准备设置 →「战役」下拉含 theDreamEaters（P10 注册后才出现）。
    await page.goto('/index.html')
    await expect(page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })).toBeVisible()
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    const setup = page.getByRole('dialog', { name: '调查准备设置' })
    await expect(setup).toBeVisible()
    const campaignSelect = setup.getByRole('combobox', { name: '战役', exact: true })
    const campaignOptions = await campaignSelect.locator('option').evaluateAll(options =>
      options.map(option => ({ value: option.value, label: option.textContent })))
    expect(campaignOptions.map(option => option.value)).toContain(TDE_CAMPAIGN)
    expect(campaignOptions.find(option => option.value === TDE_CAMPAIGN)?.label).toContain('食梦者')
    await campaignSelect.selectOption(TDE_CAMPAIGN)
    await setup.getByRole('combobox', { name: '席位数量' }).selectOption('4')
    await screenshot(`p10-release-lobby-${label}`)

    // b. 开始新游戏（真实 /api/start → 真实 TDE 战役台面）→ 开局模式门四选项。
    const started = page.waitForResponse('**/api/start')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    let session = (await (await started).json()).session
    expect(session.state.campaign.id).toBe(TDE_CAMPAIGN)
    expect(session.state.campaign.name).toBe('食梦者')
    const hub = page.locator('.ah-hub')
    await expect(hub).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText('食梦者')
    const panel = hub.getByRole('region', { name: '开局模式', exact: true })
    await expect(panel).toBeVisible()
    await expect(page.locator('.ah-hub[data-mode-gate="true"]')).toHaveCount(1)
    await expect(panel.getByRole('button', { name: /^单线 A/ })).toBeEnabled()
    await expect(panel.getByRole('button', { name: /^单线 B/ })).toBeEnabled()
    await expect(panel.getByRole('button', { name: /^分选双线$/ })).toBeEnabled()
    await expect(panel.getByRole('button', { name: /^并行双线$/ })).toBeEnabled()
    await screenshot(`p10-release-mode-gate-${label}`)

    // c. 单线 A：真实 /api/move 提交 → 4 个座位全在 A 线。
    const modeCommitted = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubSetMode')
    await panel.getByRole('button', { name: /^单线 A/ }).click()
    session = (await (await modeCommitted).json()).session
    expect(session.state.campaign.mode).toBe('singleA')
    expect(session.state.campaign.seatParts).toEqual(['A', 'A', 'A', 'A'])

    // d. 8 章列表：关卡选择页列出 8 个真实章节名（含 A/B 两线）。
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '关卡选择' }).click()
    const cases = hub.locator('.ah-office-case')
    await expect(cases).toHaveCount(TDE_CHAPTER_NAMES.length)
    for (const name of TDE_CHAPTER_NAMES) {
      await expect(hub.locator('.ah-office-cases')).toContainText(name.split(' · ')[0])
    }
    await screenshot(`p10-release-cases-${label}`)

    // e. 包状态与版本：战役总览的内容包面板含 tde* 三包（真实 status 文案）；catalog 版本取真实
    //    package.json，clientData.campaigns 含 theDreamEaters 与 8 章。
    await hub.locator('nav.ah-hub-tabs').getByRole('button', { name: '战役总览' }).click()
    const packsPanel = hub.locator('.ah-content-packs')
    await expect(packsPanel).toBeVisible()
    await packsPanel.locator('summary').click()
    const packRows = packsPanel.locator('.ah-content-pack')
    expect(await packRows.count()).toBeGreaterThan(0)
    const packIds = await packRows.evaluateAll(nodes => nodes.map(node => node.dataset.packId))
    for (const packId of TDE_PACK_IDS) expect(packIds).toContain(packId)
    const statuses = await packsPanel.locator('.ah-content-status').allTextContents()
    expect(statuses.length).toBe(packIds.length)
    for (const status of statuses) expect(status.trim().length).toBeGreaterThan(0)
    const catalog = await page.evaluate(async () => {
      const response = await fetch('/api/catalog')
      const payload = await response.json()
      const game = (payload.games || []).find(item => item.id === 'arkhamhorror')
      const campaign = (game?.clientData?.campaigns || []).find(item => item.id === 'theDreamEaters')
      return {
        version: game?.version || null,
        campaignIds: (game?.clientData?.campaigns || []).map(item => item.id),
        scenarios: (campaign?.scenarios || []).map(item => item.name),
        status: campaign?.status || null,
      }
    })
    expect(catalog.version).toBe(MOD_VERSION)
    expect(catalog.campaignIds).toContain(TDE_CAMPAIGN)
    expect(catalog.status).toBe('playable')
    expect(catalog.scenarios).toEqual(TDE_CHAPTER_NAMES)
    await screenshot(`p10-release-packs-${label}`)

    // f. 真人准备：真实 API 推进 seat 0（选择食梦者调查员 06001 → 自动牌组 → 确认），
    //    其余 AI 席位由真实 server 在 /api/move 内自动准备（与大厅同一 autoHubMove 路径）。
    const post = async (move, seat = 0) => {
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
      return body.session
    }
    await post({ action: 'hubGoSetup' })
    // 候选池证据：P10 修复后真实 hub 的「选择调查员」含食梦者 5 人（AI 池仍保持 27 人）。
    const candidateCodes = await page.evaluate(async sessionId => {
      const response = await fetch('/api/session?sessionId=' + encodeURIComponent(sessionId))
      const payload = await response.json()
      return (payload.session?.state?.legalMoves || [])
        .filter(move => move.action === 'hubSelectInvestigator').map(move => move.code)
    }, session.sessionId)
    for (const code of TDE_INVESTIGATOR_CODES) expect(candidateCodes).toContain(code)
    await post({ action: 'hubSelectInvestigator', code: '06001' })
    expect(session.state.investigators[0].code).toBe('06001')
    await post({ action: 'hubAutoDeck' })
    // 确认席位后 server 会替 3 个 AI 队友准备（同一 /api/move 内），返回时全桌应已就绪。
    await post({ action: 'hubDoneSeat' })
    expect(session.state.hubReady).toBe(true)
    await page.getByRole('button', { name: '刷新', exact: true }).click()
    const departure = hub.locator('.ah-hub-pane.ah-office-departure')
    await expect(departure).toBeVisible({ timeout: 30_000 })
    await expect(departure.locator('h2')).toContainText(FIRST_A_CHAPTER.name.split(' · ')[0])
    await screenshot(`p10-release-departure-${label}`)

    // g. 开始当前关卡（真实 /api/move）→ 局内牌桌（真实 A1 章节）。
    const begin = page.waitForResponse(response =>
      response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
    await departure.getByRole('button', { name: '开始当前关卡' }).click()
    const beginBody = await (await begin).json()
    expect(beginBody.ok, beginBody.error).toBe(true)
    await expect(page.locator('.ah-table')).toBeVisible({ timeout: 60_000 })
    // 真实 A1 开局故事/换牌选择：按真实玩家路径点掉，直到牌桌进入调查阶段。
    await waitForPlayableTable(page)
    await expect(page.locator('.bg-toast')).toHaveCount(0)
    await expect(page.locator('.bg-game-title').first()).toHaveAttribute('title', new RegExp(FIRST_A_CHAPTER.name.split(' · ')[0]))
    // 真实局内事实（从浏览器拿到的服务端投影读，不写死地点名）。
    const tableFacts = await page.evaluate(async sessionId => {
      const response = await fetch('/api/session?sessionId=' + encodeURIComponent(sessionId))
      const payload = await response.json()
      const state = payload.session?.state || {}
      return {
        scenarioId: state.scenario?.id || null,
        locationNames: (state.locations || []).map(location => location.name),
        pendingChoice: state.pendingChoice?.kind || null,
        investigatorCodes: (state.investigators || []).map(inv => inv.code),
        handSize: state.investigators?.[0]?.hand?.length ?? 0,
      }
    }, session.sessionId)
    expect(tableFacts.scenarioId).toBe(FIRST_A_CHAPTER.id)
    expect(tableFacts.investigatorCodes[0]).toBe('06001')
    expect(tableFacts.handSize).toBeGreaterThan(0)
    expect(tableFacts.locationNames.length).toBeGreaterThan(0)
    // 全量跑时演出队列可能还有迟到的段落：断言与截图前再压一次。
    await waitForPlayableTable(page)
    await expect(page.locator('body')).toContainText(tableFacts.locationNames[0])
    await expect(page.locator('.ah-departure-split')).toHaveCount(0)
    await screenshot(`p10-release-table-${label}`)

    // h. 规则书入口：F1 打开规则书，17 条 TDE 条目齐全；战役总览条目写真实章节名。
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    await expect(book).toBeVisible()
    const nav = book.getByRole('navigation', { name: '规则目录' })
    await expect(nav.locator('[data-rule-id^="tde"]')).toHaveCount(17)
    await nav.locator('[data-rule-id="tdeCampaign"]').click()
    const article = book.locator('[data-rule-topic]')
    await expect(article).toHaveAttribute('data-rule-topic', 'tdeCampaign')
    await expect(article).toContainText(FIRST_A_CHAPTER.name.split(' · ')[0])
    await screenshot(`p10-release-rulebook-${label}`)
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)

    // i. 无脚本错误、无控制台错误、无横向溢出（1px 容差）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `console error: ${consoleErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
    expect(shots.length).toBe(7)
  })
}
