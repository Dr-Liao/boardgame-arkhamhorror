// 《地球边缘》（EotE）P8 发布门禁浏览器证据（桌面 1440×950 / 移动 390×844）。
//
// 与 P7 的 tests/eote-scenarios.browser.mjs（逐章指南验收）不同，本 spec 是**发布门禁**：
// EotE 已在生产组合根 content/registered.js 中注册为可启动（战役/8 章 playable）。
// 全程只走真实大厅与真实 HTTP，零状态注入、零 page.route 改写：
//
//   · 真实大厅：启动页 → 调查准备设置 →「战役」下拉含 edgeOfTheEarth（地球边缘）→
//     选 2 席 → 开始新游戏（真实 POST /api/start）→ 真实局外页 campaignHub；
//   · catalog 事实：GET /api/catalog 的 clientData.campaigns 含 EotE、status=playable、
//     8 个真实章名与 content/campaigns/edgeOfTheEarth/shared.js#chapters 一致；
//   · 真实局外页 UI：关卡选择页 8 章卡片 → 选择第一章 → 配置调查员（hubGoSetup）→
//     选择 08001 丹妮拉·雷耶丝 → 自动构筑（hubAutoDeck）→ 确认准备（hubDoneSeat，
//     真实 server 在同一请求内 autoHubMove 准备完 AI 席位）→ 出发准备页（第一章名）；
//   · 开始当前关卡（真实 hubBeginScenario）→ 序幕/战役选择真实待决面板（DOM 点击相信戴尔、
//     阅读队员介绍）→ 真实牌桌：scenario.id=iceAndDeathPart1、手牌 > 0、地点来自真实状态；
//   · 一条真实合法 /api/move（资源/抽牌，不伪造状态）→ revision 前进、牌桌仍可操作；
//   · 关卡设置指南面板（开场/设置/特别规则 + 折叠剧透 + 中文正文）；
//   · 无 pageerror、无 console error、无横向溢出（1px 容差）；
//   · 截图 annotation 交给 tools/playwright-eote-release-reporter.mjs → audit/eote-release-browser.json。
import { test, expect } from '@playwright/test'
import { contentRegistry } from '../content/registered.js'
import { EOTE_CHAPTERS, FIRST_CHAPTER, EOTE_CAMPAIGN, EOTE_NAME, openEoteLobby, startEoteGame,
  chooseScenarioThroughUi, prepareSeatThroughUi, beginCurrentChapter, waitForPlayableTable,
  fetchSession, submitMove, assertChapterGuide, shot, annotate } from './eote-browser-helpers.mjs'

const RELEASE_TIMEOUT = 240_000
const INVESTIGATOR = '08001'

function eoteLaunchable() {
  try {
    contentRegistry.assertLaunchable(EOTE_CAMPAIGN)
    return true
  } catch {
    return false
  }
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P8 发布门禁：真实大厅可见并启动《地球边缘》第一章（${label} ${width}×${height}）`, async ({ page }, testInfo) => {
    test.skip(!eoteLaunchable(), 'EotE 尚未在 content/registered.js 注册为可启动战役（等待 P8 生产注册）')
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

    // a. 真实大厅：启动页 → 调查准备设置 → 战役下拉含 EotE。
    const setup = await openEoteLobby(page)
    await shot(page, testInfo, `p8-release-lobby-${label}`)

    // b. 真实 POST /api/start（战役=地球边缘、2 席）→ 真实局外页 campaignHub。
    const { session, hub } = await startEoteGame(page, setup, { seats: 2 })
    const sessionId = session.sessionId

    // c. catalog 事实：campaigns / status / 8 个真实章名全部来自真实注册表。
    const catalog = await page.evaluate(async () => {
      const response = await fetch('/api/catalog')
      const payload = await response.json()
      const game = (payload.games || []).find(item => item.id === 'arkhamhorror')
      const campaign = (game?.clientData?.campaigns || []).find(item => item.id === 'edgeOfTheEarth')
      return {
        campaignIds: (game?.clientData?.campaigns || []).map(item => item.id),
        status: campaign?.status || null,
        scenarios: (campaign?.scenarios || []).map(item => ({ id: item.id, name: item.name })),
      }
    })
    expect(catalog.campaignIds).toContain(EOTE_CAMPAIGN)
    expect(catalog.status).toBe('playable')
    expect(catalog.scenarios.map(item => item.id)).toEqual(EOTE_CHAPTERS.map(chapter => chapter.id))
    // 真实章名（catalog 会把中文标题与英文原名并列展示；中文标题必须逐章出现）。
    for (const [index, chapter] of EOTE_CHAPTERS.entries()) {
      expect(catalog.scenarios[index].name, `${chapter.id} 的真实章名`).toContain(chapter.name)
    }

    // d. 真实局外页：8 章关卡选择卡片（真实 hubSelectScenario）→ 选择第一章。
    const nav = hub.getByRole('navigation', { name: '战役局外页面' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('button', { name: '关卡选择', exact: true })).toBeVisible()
    await chooseScenarioThroughUi(page, hub, { chapter: FIRST_CHAPTER, index: 0 })
    const cases = hub.locator('.ah-office-case')
    await expect(cases).toHaveCount(EOTE_CHAPTERS.length)
    for (const chapter of EOTE_CHAPTERS) await expect(hub.locator('.ah-office-cases')).toContainText(chapter.name.split(' ')[0])
    await shot(page, testInfo, `p8-release-hub-${label}`)

    // e. 真人准备（真实 UI + 真实 /api/move）→ 确认后全桌就绪（AI 席位同请求 autoHubMove）。
    const prepared = await prepareSeatThroughUi(page, hub, { code: INVESTIGATOR })
    expect(prepared.state.investigators[0].code).toBe(INVESTIGATOR)
    expect(prepared.state.investigators.length).toBe(2)
    expect(prepared.state.hubReady).toBe(true)

    // f. 出发准备页：第一章名 + 2 名队员 → 开始当前关卡（真实 hubBeginScenario）→ 牌桌。
    const { session: playing } = await beginCurrentChapter(page, hub, {
      chapterName: FIRST_CHAPTER.name,
      beforeBegin: async departure => {
        expect(await departure.locator('.ah-departure-member').count()).toBe(2)
        await shot(page, testInfo, `p8-release-departure-${label}`)
      },
    })
    expect(playing.state.scenario.id).toBe(FIRST_CHAPTER.id)

    // g. 局内牌桌：真实状态与渲染（手牌、地点、章节标题、无出发分屏残留）。
    await waitForPlayableTable(page)
    const facts = await fetchSession(page, sessionId)
    expect(facts.state.uiState).toBe('inScenario')
    expect(facts.state.scenario.id).toBe(FIRST_CHAPTER.id)
    expect(facts.state.investigators[0].code).toBe(INVESTIGATOR)
    expect(facts.state.investigators[0].hand.length).toBeGreaterThan(0)
    const locationNames = (facts.state.locations || []).map(location => location.name).filter(Boolean)
    expect(locationNames.length).toBeGreaterThan(0)
    await expect(page.locator('.ah-table')).toBeVisible()
    await expect(page.locator('.bg-game-title').first()).toContainText(FIRST_CHAPTER.name.split(' ')[0])
    await expect(page.locator('.ah-departure-split')).toHaveCount(0)
    await shot(page, testInfo, `p8-release-table-${label}`)

    // h. 一条真实合法动作（资源/抽牌这类不打开选择窗口的标准动作）→ revision 前进。
    const playable = (facts.state.legalMoves || []).find(move => move.action === 'resource' || move.action === 'draw')
    expect(playable, '局内应有可提交的真实标准动作').toBeTruthy()
    const acted = await submitMove(page, sessionId, facts.state.revision, playable)
    expect(acted.payload.ok, acted.payload.error).toBe(true)
    expect(acted.payload.session.state.revision).toBe(facts.state.revision + 1)
    await waitForPlayableTable(page)
    const afterMove = await fetchSession(page, sessionId)
    expect(afterMove.state.revision).toBeGreaterThan(facts.state.revision)
    await expect(page.locator('body')).toContainText(locationNames[0])
    await shot(page, testInfo, `p8-release-table-after-move-${label}`)

    // i. 关卡设置指南面板：开场/设置/特别规则 + 折叠剧透 + 中文正文（真实 UI + 焦点恢复）。
    await assertChapterGuide(page, testInfo, label, FIRST_CHAPTER, { annotateScenario: false })
    await shot(page, testInfo, `p8-release-guide-${label}`)

    // j. 无脚本错误、无控制台错误、无横向溢出（1px 容差）。
    expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `console error: ${consoleErrors.join(' | ')}`).toEqual([])
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)

    // k. 战役真实记录投影：序幕已初始化伙伴/物资/封印镜像（真实 campaign 数据，不是注入）。
    expect(facts.state.campaign.id).toBe(EOTE_CAMPAIGN)
    expect(facts.state.campaign.eote?.partners?.length ?? facts.state.campaign.records?.eotePartnerStatuses?.length ?? 0)
      .toBeGreaterThan(0)
    annotate(testInfo, 'evidence', `catalog status=${catalog.status}；首章 ${facts.state.scenario.id} 手牌 ${facts.state.investigators[0].hand.length}；地点 ${locationNames.length} 个`)
  })
}
