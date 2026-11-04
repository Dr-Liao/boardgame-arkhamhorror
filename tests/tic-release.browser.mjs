// 《印斯茅斯暗潮》（TIC）P8 发布门禁浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// 与 P7 的 tests/tic-chapters-acceptance.browser.mjs（注入真实章节 state、绕开尚未注册的战役门禁）
// 不同，本 spec 是**发布门禁**：TIC 必须已在生产组合根 content/registered.js 中注册为可启动
// （战役/8 章/三个包 playable）。全程只走真实大厅与真实 HTTP：
//
//   · 真实大厅：启动页 → 调查准备设置 →「战役」下拉含 theInnsmouthConspiracy（印斯茅斯暗潮）→
//     选 4 席 → 开始新游戏（真实 POST /api/start）→ 真实局外页 campaignHub；
//   · catalog 事实：GET /api/catalog 的 clientData.campaigns 含 TIC、status=playable、8 个真实章名；
//   · 真人准备（真实 UI → 真实 /api/move）：工作流「选择调查员」= hubGoSetup → 选 07001 玛丽修女 →
//     自动构筑合法牌组（hubAutoDeck）→ 确认准备（hubDoneSeat；真实 server 在同一请求内按
//     大厅同一条 autoHubMove 路径准备完 3 个 AI 席位）→ 出发准备页显示第一章「绝望深坑」；
//   · 开始当前关卡（真实 hubBeginScenario）→ 局内牌桌：scenario.id=thePitOfDespair、手牌 > 0、
//     地点名来自真实状态；按真实合法动作跑一条 /api/move（不伪造状态）；
//   · F1 规则书：TIC 规则条目数 = web/tic-rules.js#TIC_RULE_IDS（真实数据），ticCampaign 正文可读；
//   · 无 pageerror、无控制台 error、无横向溢出；截图交给 tools/playwright-tic-release-reporter.mjs
//     汇总成 audit/tic-release-browser.json。
//
// 未注册时显式跳过（只影响本地调试；证据命令必须在 reg 落地后一次跑齐，跳过会让账本 status=failed）。
import { test, expect } from '@playwright/test'
import { contentRegistry } from '../content/registered.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { TIC_RULE_IDS } from '../web/tic-rules.js'
import {
  TIC_CAMPAIGN, openTicLobby, startTicGame, prepareSeatThroughUi, beginCurrentChapter,
  waitForPlayableTable, fetchSession, submitMove, shot, annotate,
} from './tic-browser-helpers.mjs'

const RELEASE_TIMEOUT = 240_000
const FIRST_CHAPTER = chapters[0]
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
  test(`P8 发布门禁：真实大厅可见并启动《印斯茅斯暗潮》第一章（${label} ${width}×${height}）`, async ({ page }, testInfo) => {
    test.skip(!ticLaunchable(), 'TIC 尚未在 content/registered.js 注册为可启动战役（等待 P8 生产注册）')
    testInfo.setTimeout(RELEASE_TIMEOUT)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', label)
    annotate(testInfo, 'phase', 'release')
    annotate(testInfo, 'scenario', FIRST_CHAPTER.id)

    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    // a. 真实大厅：启动页 → 调查准备设置 → 战役下拉含 TIC（P8 注册后才出现）。
    const setup = await openTicLobby(page)
    await shot(page, testInfo, `p8-release-lobby-${label}`)
    const { session, hub } = await startTicGame(page, setup, { seats: 4 })
    const sessionId = session.sessionId

    // b. 真实局外页：campaignHub；catalog 的 campaigns/status/scenarios 来自真实注册表。
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
    const nav = hub.getByRole('navigation', { name: '战役局外页面' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('button', { name: '关卡选择', exact: true })).toBeVisible()
    const catalog = await page.evaluate(async () => {
      const response = await fetch('/api/catalog')
      const payload = await response.json()
      const game = (payload.games || []).find(item => item.id === 'arkhamhorror')
      const campaign = (game?.clientData?.campaigns || []).find(item => item.id === 'theInnsmouthConspiracy')
      return {
        version: game?.version || null,
        campaignIds: (game?.clientData?.campaigns || []).map(item => item.id),
        status: campaign?.status || null,
        earlyAccess: campaign?.earlyAccess ?? null,
        scenarios: (campaign?.scenarios || []).map(item => ({ id: item.id, name: item.name })),
      }
    })
    expect(catalog.campaignIds).toContain(TIC_CAMPAIGN)
    expect(catalog.status).toBe('playable')
    expect(catalog.scenarios.map(item => item.id)).toEqual(chapters.map(chapter => chapter.id))
    expect(catalog.scenarios.map(item => item.name)).toEqual(chapters.map(chapter => chapter.name))
    await shot(page, testInfo, `p8-release-hub-${label}`)

    // c. 真人准备（真实 UI + 真实 /api/move）→ 确认后全桌就绪 → 出发准备显示第一章。
    const prepared = await prepareSeatThroughUi(page, hub, { investigatorName: INVESTIGATOR.name, code: INVESTIGATOR.code })
    expect(prepared.state.investigators[0].code).toBe(INVESTIGATOR.code)
    expect(prepared.state.investigators.length).toBe(4)
    expect(prepared.state.hubReady).toBe(true)

    const { session: playing } = await beginCurrentChapter(page, hub, {
      chapterName: FIRST_CHAPTER.name,
      beforeBegin: async departure => {
        expect(await departure.locator('.ah-departure-member').count()).toBe(4)
        await shot(page, testInfo, `p8-release-departure-${label}`)
      },
    })
    expect(playing.state.scenario.id).toBe(FIRST_CHAPTER.id)

    // d. 局内牌桌：清空真实演出/待决选择后断言真实状态与渲染。
    await waitForPlayableTable(page)
    const facts = await fetchSession(page, sessionId)
    expect(facts.state.uiState).toBe('inScenario')
    expect(facts.state.scenario.id).toBe(FIRST_CHAPTER.id)
    expect(facts.state.investigators[0].code).toBe(INVESTIGATOR.code)
    expect(facts.state.investigators[0].hand.length).toBeGreaterThan(0)
    const locationNames = (facts.state.locations || []).map(location => location.name).filter(Boolean)
    expect(locationNames.length).toBeGreaterThan(0)
    await expect(page.locator('.ah-table')).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name)
    await expect(page.locator('.ah-departure-split')).toHaveCount(0)

    // e. 一条真实可玩动作（不伪造状态）：优先获得资源/抽牌这类不打开选择窗口的标准动作。
    const playable = (facts.state.legalMoves || []).find(move => move.action === 'resource' || move.action === 'draw')
    expect(playable, '局内应有可提交的真实标准动作').toBeTruthy()
    const acted = await submitMove(page, sessionId, facts.state.revision, playable)
    expect(acted.payload.ok, acted.payload.error).toBe(true)
    expect(acted.payload.session.state.revision).toBe(facts.state.revision + 1)
    await waitForPlayableTable(page)
    const afterMove = await fetchSession(page, sessionId)
    expect(afterMove.state.revision).toBeGreaterThan(facts.state.revision)
    await expect(page.locator('body')).toContainText(locationNames[0])
    await shot(page, testInfo, `p8-release-table-${label}`)

    // f. F1 规则书：TIC 规则条目数与真实 TIC_RULE_IDS 一致，战役总览正文可读。
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    await expect(book).toBeVisible()
    const ruleNav = book.getByRole('navigation', { name: '规则目录' })
    await expect(ruleNav.locator('[data-rule-id^="tic"]')).toHaveCount(TIC_RULE_IDS.length)
    await ruleNav.locator('[data-rule-id="ticCampaign"]').click()
    const article = book.locator('[data-rule-topic]')
    await expect(article).toHaveAttribute('data-rule-topic', 'ticCampaign')
    await expect(article).toContainText('印斯茅斯')
    await shot(page, testInfo, `p8-release-rulebook-${label}`)
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)

    // g. 无脚本错误、无控制台错误、无横向溢出（1px 容差）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `console error: ${consoleErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
  })
}
