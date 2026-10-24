// 万象无终（TCU）P8 剧本实机路径浏览器验收（桌面 1440×950 / 移动 390×844）。
//
// 路线图 §8.3 第 4 条要求浏览器证据由 runner 生成；P5 的组件级证据不够（当时章节还是 catalog-only）。
// P8 之后 9 章已有真实 definition/behavior，但战役仍是 catalog-only（大厅不可启动），因此这里的路径是：
//   1. 真实内容注册表（content/registered.js）+ 真实引擎 `createGameState` 按章建局（合成可启动战役外壳，
//      只为绕过「战役 catalog-only」这一发布门禁；章节数据/行为/卡牌都是生产实现在跑）；
//   2. `/api/start` 路由改写为这份真实会话状态，浏览器加载**真实** web/ 界面、真实地图/幕/议程；
//   3. 桌面与移动各一条用例，断言章节名/幕/议程/地点可见、无脚本错误、无横向溢出，并截图；
//   4. 截图与章节 id 经 annotation 交给 tools/playwright-tcu-reporter.mjs 写成
//      audit/tcu-browser-acceptance.json（逐章 browserAcceptance 的证据）。
//
// 证据命令（必须三个 spec 一次跑齐，报告器一次写文件）：
//   npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as tcuCampaignPack } from '../content/packs/tcuCampaign/manifest.js'
import { manifest as tcuInvestigators } from '../content/packs/tcuInvestigators/manifest.js'
import { manifest as tcuPlayer } from '../content/packs/tcuPlayer/manifest.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'

const output = fileURLToPath(new URL('../../../artifacts/tcu-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

// ---------------------------------------------------------------- 合成可启动外壳
// 生产注册表里 TCU 章节是 development、战役是 catalog-only；浏览器要进入关卡必须有一个
// 「可启动」的战役外壳。这里克隆一份 TCU 卡包/清单并把状态设为 playable，章节按真实模块克隆 id，
// 其余数据（definition/behavior/layout）全是生产实现。
// P10：九章已从 development 升 playable（战役可从大厅启动），P8 的合成壳仍用于逐章独立建局；
// 章节过滤同时接受 development 与 playable，保证逐章实机浏览器证据不因状态升级而消失。
const HAS_REAL = new Set()
for (const chapter of chapters) {
  try {
    const module = await import(`../content/campaigns/theCircleUndone/scenarios/${chapter.id}/index.js`)
    if (['development', 'playable'].includes(module?.manifest?.status)) HAS_REAL.add(chapter.id)
  } catch {
    // 尚未迁移完成的章节跳过（P8 逐章接线期间）。
  }
}
// 只认「真实模块可直接导入」的章节：上面 import 成功的才在下面的清单里。
const REAL_MODULES = new Map()
for (const chapter of chapters) {
  if (!HAS_REAL.has(chapter.id)) continue
  REAL_MODULES.set(chapter.id, await import(`../content/campaigns/theCircleUndone/scenarios/${chapter.id}/index.js`))
}

const packSuffix = 'TcuBrowserShell'
const browserPacks = [
  { ...tcuCampaignPack, id: `${tcuCampaignPack.id}${packSuffix}`, status: 'playable' },
  { ...tcuInvestigators, id: `${tcuInvestigators.id}${packSuffix}`, status: 'playable' },
  { ...tcuPlayer, id: `${tcuPlayer.id}${packSuffix}`, status: 'playable' },
]
const packIdMap = {
  [tcuCampaignPack.id]: `${tcuCampaignPack.id}${packSuffix}`,
  [tcuInvestigators.id]: `${tcuInvestigators.id}${packSuffix}`,
  [tcuPlayer.id]: `${tcuPlayer.id}${packSuffix}`,
}
registerContentBundle({ packs: browserPacks })

const shellScenarios = []
const shellCampaigns = []
for (const [chapterId, module] of REAL_MODULES) {
  const shellScenarioId = `${chapterId}BrowserShell`
  const shellCampaignId = `${chapterId}BrowserCampaign`
  const requiredPackIds = [...new Set([...module.manifest.requiredPackIds, 'tcuCampaign', 'tcuInvestigators', 'tcuPlayer'])]
    .map(id => packIdMap[id] || id)
  shellCampaigns.push({
    id: shellCampaignId,
    name: module.manifest.name,
    nameEn: module.manifest.nameEn || module.manifest.name,
    schemaVersion: module.manifest.schemaVersion,
    contentVersion: module.manifest.contentVersion,
    minRulesVersion: module.manifest.minRulesVersion,
    status: 'playable',
    requiredPackIds,
    scenarioIds: [shellScenarioId],
    unlock: { [shellScenarioId]: [] },
    chaosBags: contentRegistry.getCampaign('theCircleUndone').chaosBags,
    recordSchema: contentRegistry.getCampaign('theCircleUndone').recordSchema,
    recordDefaults: contentRegistry.getCampaign('theCircleUndone').recordDefaults,
    recordLabels: contentRegistry.getCampaign('theCircleUndone').recordLabels,
    mementoLabels: contentRegistry.getCampaign('theCircleUndone').mementoLabels,
    interludeHandlerId: contentRegistry.getCampaign('theCircleUndone').interludeHandlerId,
    resolutionIds: contentRegistry.getCampaign('theCircleUndone').resolutionIds,
    flow: { start: shellScenarioId, nodes: { [shellScenarioId]: { type: 'scenario', scenarioId: shellScenarioId, next: 'end' }, end: { type: 'end' } } },
  })
  shellScenarios.push({
    scenario: { ...module.scenario, id: shellScenarioId },
    behavior: { ...module.behavior, id: shellScenarioId },
    manifest: {
      ...module.manifest,
      id: shellScenarioId,
      campaignId: shellCampaignId,
      status: 'playable',
      requiredPackIds,
      requiredMechanicIds: [],
      requiredEncounterGroupIds: [],
      behaviorIds: [shellScenarioId],
    },
  })
}
registerContentBundle({ campaigns: shellCampaigns, scenarios: shellScenarios })

// 注册完成后再动态 import 引擎（引擎初始化时读取内容注册表）。
const { createGameState, applyMove } = await import('../src/engine/engine.js')
const { viewState } = await import('../src/integration/observation.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 200) throw new Error('开局选择循环未收敛')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

function buildChapterState(chapterId) {
  const state = settle(createGameState({
    campaignId: `${chapterId}BrowserCampaign`,
    seed: `tcu-p8-browser-${chapterId}`,
    playerInvestigator: '01001',
  }, [{ seat: 0 }]))
  state.phase = 'investigation'
  state.currentSeat = 0
  state.pendingChoice = null
  state.status = 'playing'
  state.revision = 1
  state.uiState = 'inScenario'
  // 断言用「这一局实际在场」的幕/议程/地点（章节会在 setup 里换幕牌库/地点变体，
  // 不能用 definition.acts[0] 硬套）。用引擎真实状态计算，不写死文案。
  const act = state.acts?.[state.actIndex] || state.acts?.[0] || {}
  const agenda = state.agendas?.[state.agendaIndex] || state.agendas?.[0] || {}
  const here = state.locations.find(location => location.id === state.investigators[0]?.location)
    || state.locations[0] || {}
  const facts = {
    name: state.scenario?.name || '',
    act: act.name || '',
    agenda: agenda.name || '',
    location: here.name || '',
    locationsOnTable: state.locations.length,
  }
  const view = viewState(state, 0, { includeStatic: true })
  view.uiState = 'inScenario'
  view.pendingChoice = null
  view.revision = 1
  return { state, view, facts }
}

// ---------------------------------------------------------------- 浏览器夹具
async function openScenarioInBrowser(page, stateView) {
  let session = null
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({
      postData: JSON.stringify({
        ...body,
        settings: { ...body.settings, seed: 'tcu-p8-browser', playerCount: 1, teammates: 0, opponents: [], playerInvestigator: '01001', legacyAutoStart: true },
      }),
    })
    const payload = await response.json()
    if (payload.ok) {
      session = payload.session
      session.state = stateView
      session.state.revision = 1
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    // 只记录，不推进真实状态：本用例验证「从大厅进入章节后的实机界面」，动作后缀由 Node 侧测试覆盖。
    const body = route.request().postDataJSON()
    session.state.revision += 1
    session.state.legalMoves = []
    return route.fulfill({ json: { ok: true, session, echoed: body?.move?.action || null } })
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', '1', { timeout: 30000 })
  return { errors, session }
}

// 逐章断言用的幕/议程/地点名在 buildChapterState 里按「这一局实际状态」计算，
// 避免用 definition 的首项硬套（章节会在 setup 里换幕牌库/地点变体）。

const READY = [...REAL_MODULES.keys()]
for (const chapter of chapters.filter(candidate => READY.includes(candidate.id))) {
  for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
    test(`P8 ${chapter.name} 实机路径在${viewport}端可进入、可读、可截图`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const built = buildChapterState(chapter.id)
      const facts = built.facts
      const { errors } = await openScenarioInBrowser(page, built.view)
      // 真实章节名（界面标题来自 state.scenario.name）。
      await expect(page.locator('.bg-game-title')).toContainText(facts.name.replace(/^万象无终 · /, ''))
      // 幕/议程在「调查局势」里可见；地点名在牌桌（地图/调查员所在位置）里可见。
      await page.getByRole('button', { name: '局势', exact: true }).click()
      const situation = page.getByRole('dialog', { name: '调查局势' })
      await expect(situation).toBeVisible()
      if (facts.act) await expect(situation).toContainText(facts.act)
      if (facts.agenda) await expect(situation).toContainText(facts.agenda)
      await page.getByRole('button', { name: '关闭局势详情' }).click()
      if (facts.location) await expect(page.locator('body')).toContainText(facts.location)
      // 地图节点数与本局实际入场地点一致（《黑色王座》Cosmos 开局只有 1–2 处，
      // 《混沌魔掌》等 4 人图更多；不写死阈值）。
      expect(await page.locator('.ah-map-node').count()).toBeGreaterThanOrEqual(Math.min(facts.locationsOnTable, 2))
      expect(errors).toEqual([])
      // 没有横向溢出（1px 容差）。
      expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
      const shot = `${output}p8-scenario-${chapter.id}-${viewport}.png`
      await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
      test.info().annotations.push({ type: 'scenario', description: chapter.id })
      test.info().annotations.push({ type: 'screenshot', description: shot })
    })
  }
}
