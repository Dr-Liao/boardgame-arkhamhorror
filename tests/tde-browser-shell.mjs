// 《食梦者》（TDE）浏览器验收共享夹具：可启动外壳 + 真实章节建局 + /api 注入。
//
// P10（2026-11-01）起 TDE 三包 + 战役 + 8 章已注册进生产 `content/registered.js`：
//   · 生产 registry 已含 theDreamEaters 时，**不再**在 spec 进程注册外壳（同 id 重复注册会触发
//     「重复关卡/包 id」校验），直接复用生产 contentRegistry 的战役/章节数据（真实 id），
//     建局走「真实大厅同款 setup（createGameState 非 hub）+ 单线 part + debug 跳章 startScenario」；
//   · 未注册时（P9 口径 / 回滚）保留原外壳：克隆三包为 playable 的 `*TdeBrowserShell`，每章克隆
//     一份「外壳战役 + 外壳关卡」（id 加 `TdeBrowserShell`/`TdeBrowserCampaign` 后缀），scenario /
//     behavior / layout 全部来自真实章节模块。
// 两种口径都只做「注册（或复用）+ 建局 + 浏览器注入」，不修补任何内容行为。
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import { manifest as tdeCampaign } from '../content/campaigns/theDreamEaters/manifest.js'
import { manifest as tdeCampaignPack } from '../content/packs/tdeCampaign/manifest.js'
import { manifest as tdeInvestigators } from '../content/packs/tdeInvestigators/manifest.js'
import { manifest as tdePlayer } from '../content/packs/tdePlayer/manifest.js'
import { setPart } from '../src/campaign/campaign-parts.js'

export const SHELL_SUFFIX = 'TdeBrowserShell'
export const SHELL_PACK_IDS = [tdeCampaignPack, tdeInvestigators, tdePlayer].map(pack => pack.id)
export const TDE_CAMPAIGN_MANIFEST = tdeCampaign
export const TDE_CHAPTERS = chapters
export const TDE_CAMPAIGN_ID = 'theDreamEaters'

const PACK_ID_MAP = Object.fromEntries(SHELL_PACK_IDS.map(id => [id, `${id}${SHELL_SUFFIX}`]))

// ---------------------------------------------------------------------------
// 外壳注册：必须在动态 import 引擎之前调用（引擎初始化时读内容注册表）。
//
// P10：生产组合根已注册 theDreamEaters 时直接复用（production=true 的章节条目使用真实 id），
// 不调用 registerContentBundle；未注册时才走 P9 的克隆外壳。两种口径都按 spec 进程缓存。
// ---------------------------------------------------------------------------
let shellPromise = null
export function installTdeBrowserShell() {
  shellPromise ||= installTdeBrowserShellOnce()
  return shellPromise
}

async function installTdeBrowserShellOnce() {
  const production = contentRegistry.getCampaign(TDE_CAMPAIGN_ID)
  if (production) {
    const chapterEntries = chapters.map(chapter => ({
      ...chapter,
      module: null, // 生产注册下章节模块已由 contentRegistry 持有，不需要壳里的 module 快照
      scenarioId: chapter.id,
      campaignId: TDE_CAMPAIGN_ID,
      scenarioName: contentRegistry.getScenario(chapter.id).name,
      epilogueMatrix: production.epilogueMatrix,
      production: true,
    }))
    return { chapters: chapterEntries, campaignManifest: production, production: true }
  }
  return installShellClones()
}

async function installShellClones() {
  const shellCampaigns = []
  const shellScenarios = []
  const chapterEntries = []
  for (const chapter of chapters) {
    const module = await import(`../content/campaigns/theDreamEaters/scenarios/${chapter.id}/index.js`)
    const shellScenarioId = `${chapter.id}${SHELL_SUFFIX}`
    const shellCampaignId = `${chapter.id}${SHELL_SUFFIX}Campaign`
    const requiredPackIds = [...new Set([...module.manifest.requiredPackIds, ...SHELL_PACK_IDS])]
      .map(id => PACK_ID_MAP[id] || id)
    shellCampaigns.push({
      id: shellCampaignId,
      name: module.manifest.name,
      nameEn: module.manifest.nameEn || module.manifest.name,
      schemaVersion: tdeCampaign.schemaVersion,
      contentVersion: tdeCampaign.contentVersion,
      minRulesVersion: tdeCampaign.minRulesVersion,
      status: 'playable',
      requiredPackIds,
      scenarioIds: [shellScenarioId],
      unlock: { [shellScenarioId]: [] },
      chaosBags: tdeCampaign.chaosBags,
      partChaosBags: tdeCampaign.partChaosBags,
      recordSchema: tdeCampaign.recordSchema,
      recordDefaults: tdeCampaign.recordDefaults,
      recordLabels: tdeCampaign.recordLabels,
      mementoLabels: tdeCampaign.mementoLabels,
      interludeHandlerId: tdeCampaign.interludeHandlerId,
      resolutionIds: tdeCampaign.resolutionIds,
      endings: tdeCampaign.endings,
      epilogueMatrix: tdeCampaign.epilogueMatrix,
      flow: {
        start: shellScenarioId,
        nodes: {
          [shellScenarioId]: { type: 'scenario', scenarioId: shellScenarioId, next: 'end' },
          end: { type: 'end' },
        },
      },
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
    chapterEntries.push({
      ...chapter,
      module,
      scenarioId: shellScenarioId,
      campaignId: shellCampaignId,
      scenarioName: module.manifest.name,
      epilogueMatrix: tdeCampaign.epilogueMatrix,
    })
  }
  const browserPacks = [tdeCampaignPack, tdeInvestigators, tdePlayer].map(pack => ({
    ...pack,
    id: PACK_ID_MAP[pack.id],
    status: 'playable',
    ...(pack.dependencies ? { dependencies: pack.dependencies.map(id => PACK_ID_MAP[id] || id) } : {}),
  }))
  registerContentBundle({ packs: browserPacks })
  registerContentBundle({ campaigns: shellCampaigns, scenarios: shellScenarios })
  return { chapters: chapterEntries, campaignManifest: tdeCampaign }
}

// ---------------------------------------------------------------------------
// 引擎运行时：注册完成后再 import（见文件头第 2 步）；同样按 spec 进程缓存。
// ---------------------------------------------------------------------------
let runtimePromise = null
export function loadTdeBrowserRuntime() {
  runtimePromise ||= loadTdeBrowserRuntimeOnce()
  return runtimePromise
}

async function loadTdeBrowserRuntimeOnce() {
  const engine = await import('../src/engine/engine.js')
  const observation = await import('../src/integration/observation.js')
  const dreamGate = await import('../src/engine/dream-gate.js')
  const tokenBag = await import('../src/engine/token-bag.js')
  const markers = await import('../src/engine/marker-count.js')
  const verticalChain = await import('../src/engine/vertical-chain.js')
  const counters = await import('../src/engine/counters.js')
  const swarm = await import('../src/engine/swarm.js')
  return {
    createGameState: engine.createGameState,
    applyMove: engine.applyMove,
    legalMoves: engine.legalMoves,
    spawnEnemy: engine.spawnEnemy,
    placeLocation: engine.placeLocation,
    placeHiddenCard: engine.placeHiddenCard,
    viewState: observation.viewState,
    placeDreamGate: dreamGate.placeDreamGate,
    createTokenBag: tokenBag.createTokenBag,
    revealTokenFromBag: tokenBag.revealTokenFromBag,
    markInfested: tokenBag.markInfested,
    addMarker: markers.addMarker,
    linkVerticalChain: verticalChain.linkVerticalChain,
    setCounter: counters.setCounter,
    addCounter: counters.addCounter,
    placeSwarmCards: swarm.placeSwarmCards,
  }
}

// ---------------------------------------------------------------------------
// 建局 / 投影
// ---------------------------------------------------------------------------
function settlePendingChoices(runtime, state) {
  for (let guard = 0; state.pendingChoice; guard += 1) {
    if (guard > 500) throw new Error(`开局选择循环未收敛：${state.pendingChoice?.kind || 'unknown'}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    runtime.applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

/**
 * 用真实引擎按章建局。`seats` 只会增加 AI 席位（座位 0 永远是真人调查员）。
 * 建局后把状态固定到「调查阶段、座位 0 行动」的稳定展示点，并允许调用方继续 seed。
 *
 * P10：生产已注册 theDreamEaters（chapter.production）时：
 *   1. `createGameState`（非 hub，走生产 setup：真实初始手牌/牌组/战役记录）先落到章对门选择；
 *   2. 结算选择后把战役切到本章单线（A/B）的 part 数据作用域；
 *   3. 用生产调试原语 `debug kind:'scenario'` 跳到目标章节（内部就是大厅开始关卡用的
 *      `startScenario`，不伪造章节数据）——比 P9 的「每章一个克隆外壳战役」更接近生产。
 */
export function buildChapterState(runtime, chapter, options = {}) {
  if (chapter.production) return buildProductionChapterState(runtime, chapter, options)
  const { seats = 1, playerInvestigator = '01001' } = options
  const players = Array.from({ length: seats }, (_, seat) => ({ seat }))
  const state = runtime.createGameState({
    campaignId: chapter.campaignId,
    seed: `tde-p9-browser-${chapter.id}`,
    playerInvestigator,
  }, players)
  settlePendingChoices(runtime, state)
  return stabilizeState(state)
}

function buildProductionChapterState(runtime, chapter, { seats = 1, playerInvestigator = '01001' } = {}) {
  const players = Array.from({ length: seats }, (_, seat) => ({ seat, role: seat === 0 ? 'human' : undefined }))
  const state = runtime.createGameState({
    campaignId: TDE_CAMPAIGN_ID,
    seed: `tde-p10-browser-${chapter.id}`,
    playerInvestigator,
  }, players)
  settlePendingChoices(runtime, state)
  // 本章属于 A/B 哪条线：切到该线的数据作用域（战役记录/袋），再按单线模式跳章。
  setPart(state, chapter.part)
  state.campaign.mode = chapter.part === 'B' ? 'singleB' : 'singleA'
  runtime.applyMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId: chapter.id })
  settlePendingChoices(runtime, state)
  return stabilizeState(state)
}

/** 把状态固定到「调查阶段、座位 0 行动」的稳定展示点（P9 起浏览器规格断言的基准点）。 */
function stabilizeState(state) {
  state.status = 'playing'
  state.hubFlow = false
  state.uiState = 'inScenario'
  state.phase = 'investigation'
  state.currentSeat = 0
  state.pendingChoice = null
  state.campaign.phase = 'scenario'
  return state
}

/** 把引擎状态投影成浏览器会话状态（与 /api/session 下发的 viewState 形状一致）。 */
export function projectView(runtime, state) {
  state.legalMoves = runtime.legalMoves(state)
  const view = runtime.viewState(state, 0, { includeStatic: true })
  view.uiState = 'inScenario'
  view.pendingChoice = null
  view.revision = 1
  state.uiState = 'inScenario'
  state.pendingChoice = null
  state.revision = 1
  if (!view.log) view.log = []
  return view
}

/** 逐章断言用的「这一局实际在场」事实（幕/议程/地点都可能被 setup 换掉，不写死 definition 首项）。 */
export function scenarioFacts(state) {
  const act = state.acts?.[state.actIndex] || state.acts?.[0] || {}
  const agenda = state.agendas?.[state.agendaIndex] || state.agendas?.[0] || {}
  const here = state.locations.find(location => location.id === state.investigators[0]?.location)
    || state.locations[0] || {}
  return {
    name: state.scenario?.name || '',
    act: act.name || '',
    agenda: agenda.name || '',
    location: here.name || '',
    locationsOnTable: state.locations.length,
    scenarioId: state.scenario?.id || '',
  }
}

export const VIEWPORTS = [['desktop', 1440, 950], ['mobile', 390, 844]]

// ---------------------------------------------------------------------------
// 浏览器注入：/api/start 用真实会话替换状态；/api/session 回放当前会话；
// /api/move 在 spec 进程里用真实引擎结算（真实 legalMoves → 真实状态推进）。
// ---------------------------------------------------------------------------
export async function openInjectedTdeTable(page, runtime, state, options = {}) {
  const { seats = 1 } = options
  let session = null
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // 控制台 error 也计入（HTTP 404 的图片不会走这里；面板/脚本异常会）。
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({
      postData: JSON.stringify({
        ...body,
        settings: {
          ...body.settings,
          seed: 'tde-p9-browser',
          playerCount: seats,
          teammates: Math.max(0, seats - 1),
          opponents: [],
          playerInvestigator: '01001',
          legacyAutoStart: true,
        },
      }),
    })
    const payload = await response.json()
    if (payload.ok) {
      session = payload.session
      session.state = projectView(runtime, state)
      session.events = []
      session.busy = false
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session, busy: false } }))
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    try {
      runtime.applyMove(state, 0, body.move)
      session.state = projectView(runtime, state)
      session.events = []
      session.busy = false
      return route.fulfill({ json: { ok: true, session, revision: session.state.revision, events: [] } })
    } catch (error) {
      return route.fulfill({ json: { ok: false, error: error.message, session, revision: session.state?.revision } })
    }
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.locator('.ah-table').first().waitFor({ state: 'attached', timeout: 30_000 })
  return { errors, session: () => session }
}

/** 截图并登记 annotation（截图绝对路径；报告器按仓库根换算相对路径）。 */
export async function captureEvidence(testInfo, page, absolutePath) {
  await page.screenshot({ path: absolutePath, fullPage: true, animations: 'disabled' })
  testInfo.annotations.push({ type: 'screenshot', description: absolutePath })
}

/** 横向溢出检查（1px 容差）。 */
export function assertNoHorizontalOverflow(page) {
  return page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)
}
