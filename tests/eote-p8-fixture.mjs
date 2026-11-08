// EotE P8 节点验收共享夹具：在**生产组合根**（content/registered.js）上驾驶真实大厅（hub）流程。
//
// 口径（与 Lead / 任务约定一致）：
//   · 不注册、不伪造任何内容：`content/registered.js` 必须已把 edgeOfTheEarth 注册为
//     playable（reg-p8 任务）。未就绪时给出可读的失败信息，而不是用 stub 让用例假绿。
//   · 所有驱动都走真实引擎入口：createGameState / legalMoves / applyMove / decisionSeat /
//     autoHubMove / resolveTransaction / scenarioRuntime / viewState / migrateState；
//     「结束关卡」用引擎调试指令（action:'debug', kind:'endScenario', resolutionKey），这是
//     CONTRACT §3 的合法引擎动作，走与普通行动同一事务 / ScenarioEnded 边界。
//   · 确定性：固定 seed；不使用 Math.random / 时钟；用例之间各自建局、互不共享可变状态。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const CAMPAIGN_ID = 'edgeOfTheEarth'
export const SCENARIO_IDS = Object.freeze([
  'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
])
// 章节参考卡（场景清单 referenceCode）：07041 / 07056 / 07123 / 07163 / 07198 / 07231 / 07274 / 07311
export const CHAPTER_REFERENCE_CODES = Object.freeze(['08501', '08501', '08501', '08549', '08596', '08621', '08648', '08648'])
export const INVESTIGATOR_CODES = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
// 流程图里的幕间节点顺序（thePitOfDespair→…→intoTheMaelstrom 之间的全部 interlude 节点）。
export const INTERLUDE_NODES = Object.freeze(['interlude1', 'interlude2', 'interlude3', 'epilogue'])

let worldPromise = null

/**
 * 加载 EotE 生产内容 + 引擎/观察/存档句柄（进程内只注册/导入一次）。
 * 失败信息必须能直接指向「reg-p8 注册未完成」，不要用开发态内容兜底。
 */
export function loadEoteWorld() {
  worldPromise ||= (async () => {
    const content = await import('../content/registered.js')
    const { contentRegistry } = content
    const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
    assert.ok(campaign,
      `EotE 未注册到生产组合根：contentRegistry.getCampaign('${CAMPAIGN_ID}') === null。`
      + 'P8 用例要求 reg-p8 任务已把 EotE 静态登记进 content/registered.js（status: playable）。')
    let launchable
    try {
      launchable = contentRegistry.assertLaunchable(CAMPAIGN_ID)
    } catch (error) {
      throw new Error(`EotE 尚不可从大厅启动（reg-p8 未完成或注册数据不完整）：${error.message}`)
    }
    const engine = await import('../src/engine/engine.js')
    const resolution = await import('../src/engine/resolution.js')
    const observation = await import('../src/integration/observation.js')
    const saveMigration = await import('../src/engine/save-migration.js')
    const mechanics = await import('../src/engine/api-mechanics.js')
    const ability = await import('../src/engine/ability.js')
    const cardPool = await import('../src/deck/card-pool.js')
    const roles = await import('../src/cards/encounter-entries/_shared.js')
    const { campaignListForUi } = await import('../content/registry.js')
    return {
      content, contentRegistry, campaign: launchable, campaignListForUi,
      engine, resolution, observation, saveMigration, mechanics, ability, cardPool, roles,
      registeredEntry: ability.registeredEntry,
      scenarioRuntime: engine.scenarioRuntime,
      chaosBags: (await import('../content/campaigns/edgeOfTheEarth/shared.js')).CHAOS_BAGS,
    }
  })()
  return worldPromise
}

// ---------------------------------------------------------------------------
// 引擎薄封装（全部返回真实引擎对象）
// ---------------------------------------------------------------------------

export const codeOf = value => (typeof value === 'string' ? value : value?.originalCode || value?.code || null)
export const codesOf = list => (list || []).map(codeOf).filter(Boolean)
export const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

export function legalFor(world, state, seat = null) {
  return world.engine.legalMoves(state, seat ?? world.engine.decisionSeat(state))
}

export function decisionSeat(world, state) {
  return world.engine.decisionSeat(state)
}

export function actingSeats(world, state) {
  return world.engine.actingSeats(state)
}

/** 提交一个合法动作（自动剥离 UI 字段），返回提交后的 state。 */
export function playMove(world, state, move, seat = null) {
  assert.ok(move, '缺少合法动作')
  world.engine.applyMove(state, seat ?? world.engine.decisionSeat(state), plainMove(move))
  return state
}

export function transact(world, state, execute, select = () => null, seat = 0) {
  const run = draft => {
    try { return execute(draft) } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
      return undefined
    }
  }
  world.resolution.resolveTransaction(state, seat, { action: 'p8FixtureTransaction' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 300, `事务内待决选择未收敛：${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const optionId = select(choice, state)
      ?? ['done', 'skip', 'self', 'keep'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    world.resolution.resolveTransaction(state, choice.seat,
      { action: 'choose', choiceId: choice.id, optionId }, run)
  }
  // 事务直接结束（非 applyMove）不会重算派生缓存；补算一次，与 applyMove 收尾一致。
  state.legalMoves = world.engine.legalMoves(state)
  return state
}

/** 逐条回答待决选择，直到没有待决选择（默认优先 done/skip/self/keep）。 */
export function settleChoices(world, state, select = () => null) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 300, `待决选择未收敛：${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const optionId = select(choice, state)
      ?? ['done', 'skip', 'self', 'keep'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    world.engine.applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId })
  }
  return state
}

// ---------------------------------------------------------------------------
// 大厅建局 / 逐章推进
// ---------------------------------------------------------------------------

/** 建一个 EotE 大厅局（campaignHub）。humans 为真人座位数组，其余座位是 AI 队友。 */
export function createHubGame(world, {
  seats = 2, humans = null, difficulty = 'standard', seed = 'tic-p8',
  investigatorCodes = [], rulesMode = 'simplified',
} = {}) {
  const humanSeats = humans ?? Array.from({ length: seats }, (_, seat) => seat)
  assert.ok(humanSeats.length >= 1 && humanSeats.length <= seats, '至少需要一名真人玩家')
  return world.engine.createGameState({
    campaignId: CAMPAIGN_ID, campaignHub: true, seed, difficulty, rulesMode,
  }, Array.from({ length: seats }, (_, seat) => ({ seat, role: humanSeats.includes(seat) ? 'human' : 'ai' })))
}

function prepareHumanSeat(world, state, seat, code) {
  settleChoices(world, state)
  const choices = legalFor(world, state, seat).filter(move => move.action === 'hubSelectInvestigator')
  assert.ok(choices.length, `座位 ${seat} 没有可选调查员`)
  const pick = code ? choices.find(move => move.code === code) : null
  assert.ok(!code || pick, `座位 ${seat} 不能选择调查员 ${code}`)
  playMove(world, state, pick || choices[0], seat)
  settleChoices(world, state)
  playMove(world, state, legalFor(world, state, seat).find(move => move.action === 'hubAutoDeck'), seat)
  settleChoices(world, state)
  playMove(world, state, legalFor(world, state, seat).find(move => move.action === 'hubDoneSeat'), seat)
  settleChoices(world, state)
}

/** 用大厅 AI 的既有 autoHubMove 路径准备一个 AI 座位（选人 → 自动牌组 → 确认）。 */
export function autoPrepareSeat(world, state, seat) {
  for (let guard = 0; guard < 80; guard++) {
    settleChoices(world, state)
    const move = world.engine.autoHubMove(state, seat)
    if (!move) break
    playMove(world, state, move, seat)
  }
  return state
}

/**
 * 从 campaignHub 一路开到第一章 inScenario：
 *   队长 → 选关（若有）→ hubGoSetup → 各座位选人/自动牌组/确认 → hubBeginScenario。
 * 返回 state（uiState === 'inScenario'）。
 */
export function hubSetup(world, state, {
  investigatorCodes = [], seats = null,
} = {}) {
  const count = seats ?? state.numInvestigators
  const humans = state.humanSeats || [0]
  settleChoices(world, state)
  const leader = legalFor(world, state, 0).find(move => move.action === 'hubSetLeader')
  if (leader) playMove(world, state, leader, 0)
  settleChoices(world, state)
  const select = legalFor(world, state, 0).find(move => move.action === 'hubSelectScenario')
  if (select) playMove(world, state, select, 0)
  settleChoices(world, state)
  playMove(world, state, { action: 'hubGoSetup' }, 0)
  settleChoices(world, state)
  for (const seat of humans) prepareHumanSeat(world, state, seat, investigatorCodes[seat])
  for (let seat = 0; seat < count; seat++) if (!humans.includes(seat)) autoPrepareSeat(world, state, seat)
  settleChoices(world, state)
  assert.equal(state.hubReady, true, '全部座位确认后 hubReady 应为 true')
  if (!state.campaign.leadConfirmed) {
    const confirm = legalFor(world, state, 0).find(move => move.action === 'hubSetLeader')
    assert.ok(confirm, '缺少队长确认动作')
    playMove(world, state, confirm, 0)
  }
  settleChoices(world, state)
  return beginChapter(world, state)
}

/** 在 scenarioSetup 里确认全部座位并开始当前关卡（hubBeginScenario）。 */
export function beginChapter(world, state) {
  for (let guard = 0; guard < 80 && !state.hubReady; guard++) {
    settleChoices(world, state)
    const seat = decisionSeat(world, state)
    const done = legalFor(world, state, seat).find(move => move.action === 'hubDoneSeat')
    if (!done) break
    playMove(world, state, done, seat)
  }
  settleChoices(world, state)
  assert.equal(state.hubReady, true, `开始关卡前 hubReady 应为 true（uiState=${state.uiState}）`)
  const begin = legalFor(world, state, 0).find(move => move.action === 'hubBeginScenario')
  assert.ok(begin, `缺少「开始当前关卡」动作：${legalFor(world, state, 0).map(move => move.action).join(',')}`)
  assert.notEqual(begin.disabled, true, `开始当前关卡不可用：${begin.explanation}`)
  playMove(world, state, begin, 0)
  settleChoices(world, state)
  return state
}

/** 用调试指令结束当前关卡（合法 resolutionKey），并结算结束后的待决选择。 */
export function finishScenario(world, state, resolutionKey, select = () => null) {
  assert.ok(Object.hasOwn(state.scenario?.resolutions || {}, resolutionKey),
    `${state.scenario?.id} 没有结局键 ${resolutionKey}`)
  const seat = decisionSeat(world, state)
  playMove(world, state, { action: 'debug', kind: 'endScenario', resolutionKey }, seat ?? 0)
  settleChoices(world, state, select)
  return state
}

/**
 * 从 scenarioResult 继续：hubContinue → 结算幕间窗口（可选真实升级）直到 scenarioSetup 或
 * campaignResult。返回本次经过的幕间节点与是否发生过真实购买。
 */
export function continueFromResult(world, state, {
  upgrades = true, storySelect = () => null, maxUpgrades = Infinity,
} = {}) {
  const info = { nodes: [], upgradesAllowed: [], upgradePurchased: false, purchases: [], uiState: null }
  let upgradesDone = 0
  playMove(world, state, { action: 'hubContinue' }, 0)
  settleChoices(world, state, storySelect)
  for (let guard = 0; guard < 200 && state.uiState === 'interlude'; guard++) {
    const node = state.campaign.flow?.nodeId || '(interlude)'
    if (info.nodes.at(-1) !== node) {
      info.nodes.push(node)
      info.upgradesAllowed.push(state.campaign.upgradesAllowed !== false)
    }
    settleChoices(world, state, storySelect)
    const seat = decisionSeat(world, state)
    const moves = legalFor(world, state, seat)
    if (upgrades && upgradesDone < maxUpgrades && moves.some(move => move.action === 'hubAutoUpgrade')) {
      playMove(world, state, moves.find(move => move.action === 'hubAutoUpgrade'), seat)
      info.upgradePurchased = true
      upgradesDone += 1
      settleChoices(world, state)
    }
    const after = legalFor(world, state, decisionSeat(world, state))
    const done = after.find(move => move.action === 'hubDoneSeat')
    if (!done) throw new Error(`幕间 ${node} 卡住：${after.map(move => move.action).join(',')}`)
    playMove(world, state, done, decisionSeat(world, state))
    settleChoices(world, state, storySelect)
  }
  if (info.upgradesAllowed.some(Boolean)) {
    info.purchases = Object.values(state.campaign.investigators || {}).flatMap(record => record.purchases || [])
  }
  info.uiState = state.uiState
  return info
}

/**
 * 走完整个 EotE 战役（真实 hub 流程）：
 *   onChapter(world, state, index) 可在结算前布置/断言章节内幕状态；返回字符串可覆盖本章结局键，
 *   返回 'self' 表示回调自己已经让本章结束（例如用真实行动触发章节目标完成）。
 *   maxChapters 只走到第 N 章结束（用于失败/分支用例先推进到目标章节之前的部分）。
 * 返回 { state, chapters, hashes }；chapters[i] = { scenarioId, uiState, nodeId, interludeNodes, upgrades }。
 */
export function walkCampaign(world, {
  seats = 2, humans = null, difficulty = 'standard', seed = 'tic-p8-walk',
  investigatorCodes = [], onChapter = null, upgrade = true, maxUpgrades = Infinity, storySelect = () => null,
  resolutionFor = state => Object.keys(state.scenario?.resolutions || {})[0], maxChapters = SCENARIO_IDS.length, expectedScenarios = null,
} = {}) {
  const state = createHubGame(world, { seats, humans, difficulty, seed, investigatorCodes })
  hubSetup(world, state, { investigatorCodes })
  const chapters = []
  const hashes = [hashState(state)]
  const limit = Math.min(maxChapters, expectedScenarios ? expectedScenarios.length : 10)
  for (let index = 0; index < limit; index++) {
    const entry = {
      index, scenarioId: state.scenario?.id, uiState: state.uiState,
      nodeId: state.campaign.flow?.nodeId, interludeNodes: [], upgrades: null,
    }
    const sequence = expectedScenarios
    const expectedId = sequence ? sequence[index] : null
    if (expectedId) {
      assert.equal(entry.scenarioId, expectedId,
        `第 ${index + 1} 章应为 ${expectedId}，实际 ${entry.scenarioId}`)
    } else {
      assert.ok(SCENARIO_IDS.includes(entry.scenarioId), `第 ${index + 1} 章 ${entry.scenarioId} 不属于本章节表`)
    }
    const override = onChapter ? onChapter(world, state, index) : null
    if (state.status !== 'playing') { chapters.push(entry); break }
    if (override !== 'self') finishScenario(world, state, override || resolutionFor(state, index))
    entry.resolution = state.campaign.scenarioResults.at(-1)?.resolution
    entry.finishedUiState = state.uiState
    hashes.push(hashState(state))
    chapters.push(entry)
    if (state.status !== 'playing') break
    assert.equal(state.uiState, 'scenarioResult', `第 ${index + 1} 章结算后应停在 scenarioResult`)
    const info = continueFromResult(world, state, { upgrades: upgrade, maxUpgrades, storySelect })
    entry.interludeNodes = info.nodes
    entry.upgrades = { purchased: info.upgradePurchased, allowed: info.upgradesAllowed, purchases: info.purchases.length }
    hashes.push(hashState(state))
    if (state.status !== 'playing') break
    if (state.uiState !== 'scenarioSetup') assert.fail(`第 ${index + 1} 章之后未进入下一章准备：uiState=${state.uiState}`)
    if (index + 1 >= limit) break
    beginChapter(world, state)
    hashes.push(hashState(state))
  }
  return { state, chapters, hashes }
}

/**
 * 建局并直接推进到第 index 章的 inScenario（前 index 章用 resolution1 正常结算 + 幕间确认）。
 * 用于失败/分支用例，避免每个用例都手写一遍前置章节。
 */
export function openChapter(world, index, {
  seats = 2, humans = null, difficulty = 'standard', seed = 'tic-p8-jump',
  investigatorCodes = [], upgrades = false, onChapter = null, storySelect = () => null,
} = {}) {
  const state = createHubGame(world, { seats, humans, difficulty, seed, investigatorCodes })
  hubSetup(world, state, { investigatorCodes })
  for (let current = 0; current < index; current++) {
    assert.equal(state.scenario?.id, SCENARIO_IDS[current], `推进到第 ${current + 1} 章时关卡不符`)
    if (onChapter) onChapter(world, state, current)
    finishScenario(world, state, 'resolution1')
    continueFromResult(world, state, { upgrades, storySelect })
    beginChapter(world, state)
  }
  assert.equal(state.scenario?.id, SCENARIO_IDS[index], `应停在第 ${index + 1} 章 inScenario`)
  assert.equal(state.uiState, 'inScenario')
  return state
}

// ---------------------------------------------------------------------------
// 存档 / 观察 / 校验辅助
// ---------------------------------------------------------------------------

export const hashState = state => createHash('sha256').update(JSON.stringify(state)).digest('hex')

/** 生产存档路径：JSON 序列化（大厅存档就是 JSON）→ migrateState → 返回可继续行动的状态。 */
export function saveAndRestore(world, state) {
  const text = JSON.stringify(state)
  const first = world.saveMigration.migrateState(JSON.parse(text))
  const second = world.saveMigration.migrateState(first.state)
  return { text, state: first.state, changes: first.changes, secondChanges: second.changes }
}

export function viewFor(world, state, seat) {
  return world.observation.viewState(state, seat, { includeStatic: false })
}

export function mechanicsOf(world, state) {
  return world.mechanics.createMechanicsApi(state)
}

/** 章节清单里某区域的声明总数（manifest.zones，例如 encounterDeck / setAside）。 */
export function declaredZoneCount(manifest, zone) {
  return (manifest?.zones?.[zone] || []).reduce((sum, entry) => sum + entry.count, 0)
}

/** 把状态里所有「物理卡」区域展开成 code → 张数（用于区域守恒断言）。 */
export function visibleCardCounts(state) {
  const counts = new Map()
  const add = value => {
    const code = codeOf(value)
    if (code) counts.set(code, (counts.get(code) || 0) + 1)
  }
  for (const zone of ['locations', 'enemies', 'storyAssets', 'victoryDisplay', 'encounterDeck',
    'encounterDiscard', 'cultistsInVictory']) for (const card of state[zone] || []) add(card)
  for (const zone of ['setAside', 'removed', 'victory', 'inPlay']) {
    for (const card of state.scenarioZones?.[zone] || []) add(card)
  }
  for (const location of state.locations || []) {
    for (const card of location.beneath || []) add(card)
    for (const card of location.attachments || []) add(card)
  }
  for (const enemy of state.enemies || []) for (const card of enemy.attachments || []) add(card)
  for (const investigator of state.investigators || []) {
    for (const zone of ['assets', 'hand', 'deck', 'discard', 'threat']) for (const card of investigator[zone] || []) add(card)
  }
  for (const card of state.agendaAside || []) add(card)
  return counts
}

/**
 * 区域守恒：对每章开局做三类断言，全部对照**生产 manifest 的 zones**：
 *   1) 遭遇牌库的每张牌都在 manifest 声明的遭遇牌库内，且张数不超过声明数；
 *   2) 任何物理区域里出现的「manifest 声明卡」张数不超过声明张数（不会凭空多牌）；
 *   3) 场上每个地点（未隐藏身份的）都有 manifest layout 的有限坐标。
 */
export function assertZoneConservation(world, state) {
  const manifest = world.contentRegistry.getScenario(state.scenario.id)
  assert.ok(manifest?.zones, `${state.scenario.id} manifest 缺少 zones`)
  const declared = new Map()
  for (const zone of Object.keys(manifest.zones)) {
    for (const entry of manifest.zones[zone]) declared.set(entry.cardCode, (declared.get(entry.cardCode) || 0) + entry.count)
  }
  const declaredEncounter = new Set((manifest.zones.encounterDeck || []).map(entry => entry.cardCode))
  for (const card of state.encounterDeck || []) {
    assert.ok(declaredEncounter.has(codeOf(card)),
      `${state.scenario.id} 遭遇牌库出现未声明卡 ${codeOf(card)}`)
  }
  const seen = visibleCardCounts(state)
  for (const [code, count] of seen) {
    if (!declared.has(code)) continue
    assert.ok(count <= declared.get(code),
      `${state.scenario.id} 区域守恒失败：${code} 场上 ${count} 张 > manifest 声明 ${declared.get(code)} 张`)
  }
  for (const location of state.locations || []) {
        const position = manifest.layout?.locations?.[location.id]
    assert.ok(position && Number.isFinite(position.x) && Number.isFinite(position.y),
      `${state.scenario.id} 地点 ${location.id} 缺少有限坐标`)
  }
  return { manifest, declared, seen }
}

/** 断言当前关卡的幕/议程与生产 manifest 一致（张数），且都来自本章节印刷幕/议程表。 */
export function assertStageStructure(world, state) {
  const manifest = world.contentRegistry.getScenario(state.scenario.id)
  const stageCards = state.scenario?.stageCards || {}
  const stageCodeOf = stage => String(stage?.originalCode || stage?.code || '')
  // 中段章节会按侦察记录动态替换当前议程（middle-setup.js）：张数仍须与 manifest 一致，
  // 但具体是哪一张由真实内容读取战役记录决定，因此按 stageCards 允许集合校验。
  assert.equal((state.acts || []).length, (manifest.acts || []).length,
    `${state.scenario.id} 幕数量与 manifest 不一致`)
  assert.equal((state.agendas || []).length, (manifest.agendas || []).length,
    `${state.scenario.id} 议程数量与 manifest 不一致`)
  for (const act of state.acts || []) assert.ok(Object.hasOwn(stageCards, stageCodeOf(act)),
    `${state.scenario.id} 幕 ${stageCodeOf(act)} 不在本章节印刷幕表`)
  for (const agenda of state.agendas || []) assert.ok(Object.hasOwn(stageCards, stageCodeOf(agenda)),
    `${state.scenario.id} 议程 ${stageCodeOf(agenda)} 不在本章节印刷议程表`)
  assert.ok(state.locations.length > 0, `${state.scenario.id} 开局没有地点`)
  assert.ok(state.locations.some(location => location.id === state.scenario.startLocation),
    `${state.scenario.id} 起始地点不在场：${state.scenario.startLocation}`)
  return manifest
}

/** 该难度的基础混乱袋 + 调查员开局标记（07001「修女玛丽」setupChaosTokens）。 */
export function expectedStartingBag(world, difficulty, investigatorCodes) {
  const tokens = [...world.chaosBags[difficulty]]
  for (const code of investigatorCodes) {
    const entry = world.registeredEntry(code)
    for (const [token, amount] of Object.entries(entry?.investigator?.setupChaosTokens || {})) {
      for (let index = 0; index < amount; index++) tokens.push(token)
    }
  }
  return tokens.sort()
}

export const sortedBag = bag => [...(bag || [])].sort()
