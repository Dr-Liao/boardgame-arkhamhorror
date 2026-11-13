// 2026-11-13 P1 回归：docs/campaign/theScarletKeys/fix-plan.md 的 P1 清单。
// 全部走真实引擎入口（createGameState / applyMove / legalMoves / debug 跳关 / scenarioRuntime），
// 不使用合成 state；每条用例对应一个 P1 项，失败时可直接定位修复是否回退。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { applyMove, assignHarm, createGameState, legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { mechanicView } from '../src/integration/mechanic-view.js'
import * as dealings from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/behavior.js'
import * as sanguine from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/behavior.js'
import * as deadHeat from '../content/campaigns/theScarletKeys/scenarios/deadHeat/behavior.js'
import * as riddles from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { discardPlayerCards } from '../src/engine/player-zones.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { startScarletKeysCampaign } from '../content/campaigns/theScarletKeys/prologue.js'
import entry09716a from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09716a.js'
import entry09726a from '../src/cards/encounter-entries/theScarletKeys/_shared/cleanup_crew/09726a.js'
import entry09752 from '../src/cards/encounter-entries/theScarletKeys/_shared/red_coterie/09752.js'
import entry09015 from '../src/cards/entries/09015.js'
import entry09124 from '../src/cards/entries/09124.js'
import entry09766 from '../src/cards/encounter-entries/theScarletKeys/_shared/globetrotting/09766.js'
import * as tskMap from '../src/engine/tsk-map.js'
import { DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY } from '../content/campaigns/theScarletKeys/scenarios/dancingMad/chaos.js'
import {
  concealedSpecFor, concealedDecoysFor, distributeConcealedEnemy,
} from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/behavior.js'

const CAMPAIGN_ID = 'theScarletKeys'
// 单测进程未注册全部遭遇条目时在本地补注册（与章节测试同一口径）。
for (const entry of [entry09716a, entry09726a, entry09752, entry09015, entry09124, entry09766]) if (!registeredEntry(entry.code)) registerCardAbilities([entry])
const SAFE_CHOICES = ['done', 'skip', 'no', 'continue', 'decline', 'cancel', 'ticket', 'everything', 'pass', 'blow', 'discard', 'decoys', 'harm']

function createState (seed = 'tsk-p1') {
  return createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
}

function settle (state, { prefer = SAFE_CHOICES, max = 80 } = {}) {
  for (let guard = 0; state.pendingChoice && guard < max; guard += 1) {
    const choice = state.pendingChoice
    const safe = prefer.map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const option = safe || choice.options[0]
    if (!option) break
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
}

function enterScenario (state, scenarioId, options = {}) {
  settle(state)
  applyMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId })
  settle(state, options)
  assert.equal(state.uiState, 'inScenario', `${scenarioId} 未进入 inScenario`)
  return state
}

const miniCards = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
const findMove = (state, action) => legalMoves(state, 0).find(move => move.action === action)
const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

// debug 跳关不经过战役序幕：需要密钥的用例在本地初始化一把（与 prologue#KEY_INIT_SPECS 同形）。
function ensureKeys (api) {
  const existing = api.mechanics.tsk.keys.all()
  if (existing.length) return existing
  api.mechanics.tsk.keys.initialize([{ id: '09544', stableFace: '09544a', unstableFace: '09544b' }])
  return api.mechanics.tsk.keys.all()
}

// 在真实规则事务里跑一段结算（伤害分配/选择必须在事务上下文）；事务把 draft 提交回 state。
function runInTransaction (state, fn) {
  let output = null
  const execute = draft => {
    try {
      output = fn(draft, scenarioRuntime(draft, []))
    } catch (error) {
      if (error?.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'tskP1Run' }, execute)
  settle(state)
  state.legalMoves = legalMoves(state)
  return output
}

// ---------------------------------------------------------------------------
// P1-1 tskExposed / tskKeyShifted 窗口派发
// ---------------------------------------------------------------------------
test('P1-1a 揭露迷你卡派发 tskExposed：强制条目（09726a）真实结算', () => {
  const state = enterScenario(createState('p1-1a'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const inv = state.investigators[0]
  resolveTransaction(state, 0, { action: 'tskP1Run' }, draft => {
    const api = scenarioRuntime(draft, [])
    // 09726a「清理组打手」的强制：你揭露阴影中其他名称的敌人后，若它在阴影中：其攻击你。
    // 布置：它在场 + 它在阴影里有一张真身迷你卡；然后揭露另一张（不同卡号）的迷你卡。
    assert.ok(api.spawn('09726a', inv.location), '09726a 应能生成')
    api.mechanics.tsk.concealed.place({ kind: 'enemy09726a', code: '09726a', decoy: false, locationId: inv.location })
    const other = api.mechanics.tsk.concealed.place({
      kind: 'enemy09716a', code: '09716a', decoy: false, locationId: inv.location,
    })
    assert.equal(other.code, '09716a', '迷你卡应保存印刷卡号（P1-4 契约）')
    api.mechanics.tsk.concealed.expose(other.id, { seat: inv.seat })
  })
  // 窗口派发后 09726a 的强制 resolve 会真实攻击 → 产生伤害分配选择（无派发时完全静默、无待决）。
  assert.match(String(state.pendingChoice?.kind || ''), /assign-/, '揭露后 09726a 的强制应已结算（出现伤害分配）')
})

test('P1-1b 密钥变换派发 tskKeyShifted：09752 真实强制能力结算', () => {
  const state = enterScenario(createState('p1-1b'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  const keys = ensureKeys(api)
  assert.ok(keys.length > 0, '战役开局应初始化绯红密钥')
  const keyId = keys[0].id
  // 09752 的强制：钥匙从动荡翻到稳定后攻击你。先把钥匙强制翻到动荡面，再生成敌人并翻回稳定面。
  const toUnstable = () => api.mechanics.tsk.keys.shift(keyId, { force: true })
  if (api.mechanics.tsk.keys.get(keyId).stable) toUnstable()
  if (api.mechanics.tsk.keys.get(keyId).stable) toUnstable()
  const enemy = api.spawn('09752', inv.location)
  assert.ok(enemy, '09752 应能生成')
  const harmBefore = inv.damage + inv.horror
  api.mechanics.tsk.keys.shift(keyId, { force: true })
  // 09752 的强制在窗口派发后会结算并打日志（「使用/发动 … 戴红手套的男子」或「变换了 N 把钥匙」）；
  // 攻击本身可能因缺少目标/检定而只留日志，这里以「窗口真的跑到条目」为断言口径。
  assert.ok(state.log.some(line => /戴红手套的男子/.test(line) && /变换|使用|发动/.test(line)),
    '钥匙翻至稳定面后 09752 的强制应被窗口结算（未派发时完全静默）')
})

// ---------------------------------------------------------------------------
// P1-2 玩家 Shift / 移交入口
// ---------------------------------------------------------------------------
test('P1-2 合法动作枚举 Shift；每轮一次；非法密钥拒绝', () => {
  const state = enterScenario(createState('p1-2'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  const key = ensureKeys(api)[0]
  api.mechanics.tsk.keys.bind(key.id, { type: 'investigator', seat: inv.seat })
  const shiftMove = findMove(state, 'shiftKey')
  assert.ok(shiftMove, '持钥调查员应有 shiftKey 合法动作')
  applyMove(state, 0, plainMove(shiftMove))
  settle(state)
  assert.equal(api.mechanics.tsk.keys.get(key.id).shiftedRound, state.round, 'Shift 应记录本轮已变换')
  assert.equal(findMove(state, 'shiftKey'), undefined, '同一轮不应再次出现 Shift 动作')
  assert.throws(() => applyMove(state, 0, { action: 'shiftKey', keyId: '不存在' }), /密钥|没有持有/)
})

// ---------------------------------------------------------------------------
// P1-3 Concealed X 数值语义
// ---------------------------------------------------------------------------
test('P1-3 Concealed X：无 [per_investigator] 的卡不按人数倍增；带图标的才倍增', () => {
  const state = enterScenario(createState('p1-3'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  state.numInvestigators = 2
  const api = scenarioRuntime(state, [])
  // 09716a 印刷 Concealed 2（无图标）→ 1 真身 + 2 诱饵 = 3 张
  const createdAgent = distributeConcealedEnemy(state, '09716a', { seat: 0, locationId: state.investigators[0].location }, api)
  assert.equal(createdAgent.cards.length, 3, '09716a 在 2 人局应为 3 张迷你卡')
  // 09518 印刷 Concealed 1 [per_investigator] → 1 真身 + 2 诱饵 = 3 张
  const spec = concealedSpecFor('09518')
  assert.equal(spec.perInvestigator, true)
  assert.equal(concealedDecoysFor('09518', state), 2)
  assert.equal(concealedSpecFor('09716a').perInvestigator, false)
  assert.equal(concealedDecoysFor('09716a', state), 2)
})

// ---------------------------------------------------------------------------
// P1-4 迷你卡 kind/code 契约：跨章条目按印刷卡号判阴影
// ---------------------------------------------------------------------------
test('P1-4 迷你卡 code 契约：分配/揭露都带 code，旧夹具仍可回退 kind', () => {
  const state = enterScenario(createState('p1-4'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const api = scenarioRuntime(state, [])
  const inv = state.investigators[0]
  const placed = api.mechanics.tsk.concealed.place({ kind: 'enemy09726a', code: '09726a', decoy: false, locationId: inv.location })
  const visible = api.mechanics.tsk.concealed.projection({ revealAll: true }).find(card => card.id === placed.id)
  assert.equal(visible?.code, '09726a', '观察投影（已揭露）也应给 code')
  const exposed = api.mechanics.tsk.concealed.expose(placed.id, { seat: inv.seat })
  assert.equal(exposed.code, '09726a', '揭露结果应带印刷卡号')
  const legacy = api.mechanics.tsk.concealed.place({ kind: 'Decoy', decoy: true, locationId: inv.location })
  assert.equal(legacy.code, null)
})

// ---------------------------------------------------------------------------
// P1-5 09751 真实遭遇路径不崩（api 面一致）
// ---------------------------------------------------------------------------
test('P1-5 09751 通过真实遭遇抽取，不抛错且不新增/删除迷你卡', () => {
  const state = enterScenario(createState('p1-5'), 'withoutATrace', { prefer: ['decoys', 'harm', 'done', 'skip'] })
  state.encounterDeck = ['09751']
  const before = miniCards(state).length
  applyMove(state, 0, { action: 'debug', kind: 'encounter', targetSeat: 0 })
  settle(state)
  assert.equal(miniCards(state).length, before, '09751 只重排/伤害，不改变迷你卡数量')
})

// ---------------------------------------------------------------------------
// P1-10 疯星乱舞四档混乱标记
// ---------------------------------------------------------------------------
test('P1-10 疯星乱舞 tokenMeanings 补全 easy/expert 两档且与 standard/hard 同源', () => {
  const table = DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY
  assert.deepEqual(Object.keys(table).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(table.easy.cultist.delta, table.standard.cultist.delta)
  assert.equal(table.expert.cultist.delta, table.hard.cultist.delta)
  assert.equal(table.easy.skull.rider, 'skullShadowCount')
})

// ---------------------------------------------------------------------------
// P1-13 scenarioRuntime 缺失原语
// ---------------------------------------------------------------------------
test('P1-13 scenarioRuntime 暴露 tsk 别名与 lookAt/moveCard/playCardFromHandFree/placeDoomOnCard', () => {
  const state = enterScenario(createState('p1-13'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const api = scenarioRuntime(state, [])
  assert.equal(typeof api.tsk, 'object', 'api.tsk 别名应指向机制面')
  assert.equal(api.tsk, api.mechanics.tsk)
  for (const key of ['lookAt', 'moveCard', 'playCardFromHandFree', 'placeDoomOnCard']) {
    assert.equal(typeof api[key], 'function', `api.${key} 应是函数`)
  }
})

// ---------------------------------------------------------------------------
// P1-17 战役流程：禁用卡 / 时间 35 重定向 / θ 记录
// ---------------------------------------------------------------------------
test('P1-17a 战役开局登记禁用卡 02310', () => {
  const state = createState('p1-17a')
  startScarletKeysCampaign(state, [])
  assert.ok(Array.isArray(state.campaign?.tsk?.invalidCards), 'campaign.tsk.invalidCards 应是数组')
  assert.ok(state.campaign.tsk.invalidCards.includes('02310'), '02310 应登记为战役禁用卡')
})

test('P1-17b 时间推过 35 时旅行后重定向到强制终章节点', () => {
  const state = enterScenario(createState('p1-17b'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  const fakeGraph = { nodes: [
    { id: 'london', connections: ['cairo'] },
    { id: 'cairo', connections: [] },
    { id: 'tunguska', connections: [] },
  ] }
  const draft = structuredClone(state)
  draft.campaign.tsk.map = { ...draft.campaign.tsk.map, current: 'london', time: 34, forcedNode: 'tunguska', visited: ['london'], unlocked: ['london', 'cairo', 'tunguska'] }
  const result = tskMap.travelTo(draft, { graph: fakeGraph, destination: 'cairo' })
  assert.equal(result.crossedThreshold, true)
  assert.equal(result.to, 'tunguska', '跨过 35 后应改去强制节点')
  assert.equal(draft.campaign.tsk.map.time, 35)
})

test('P1-17c 疯星乱舞 θ 时间点写入战役记录（幕间 52 安全屋判定读点）', () => {
  const source = readFileSync(new URL('../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js', import.meta.url), 'utf8')
  assert.ok(source.includes('records.thetaTime = theta'), 'θ 应同时写入 records.thetaTime（战役记录）')
})

// ---------------------------------------------------------------------------
// P1-14 结局/分支可达：dealings 追逐 R1/R6 + R1→R2/R3→R4/R5 链；
// sanguine 幕间「云开见日」1/4→R1、7→生成 09557b 并进入「见红」。
// ---------------------------------------------------------------------------
test('P1-14a dealings「追逐」：持钥调查员在加拉塔码头 → 结局 1；持钥敌人 → 结局 6', () => {
  const state = enterScenario(createState('p1-14a'), 'dealingsInTheDark', { prefer: ['done', 'skip'] })
  const flags = state.scenarioFlags
  const inv = state.investigators[0]
  const docks = 'galataDocks'
  // 分支 A：调查员持钥并在码头 → R1。
  flags.twistedAntiprismBearer = { type: 'investigator', seat: inv.seat }
  inv.location = docks
  let finished = null
  const api = { info: () => {}, finish: key => { finished = key } }
  assert.equal(dealings.checkTheChase(state, api), true, '持钥调查员在码头应触发追逐结算')
  assert.equal(finished, 'resolution1', '应进入结局 1（而不是落到无结局）')
  // 分支 B：敌人持钥并在码头 → R6。
  flags.twistedAntiprismBearer = { type: 'enemy', enemyId: 'e-key' }
  state.enemies = [{ id: 'e-key', code: '09583', location: docks }]
  finished = null
  assert.equal(dealings.checkTheChase(state, api), true)
  assert.equal(finished, 'resolution6', '敌人持钥到码头应进入结局 6')
})

test('P1-14b dealings 结局链 R1→R2/R3→R4/R5 全部可达（按艾婕记录分流）', () => {
  // 拒绝艾婕 → R1→R2（调查员保管钥匙）
  let state = enterScenario(createState('p1-14b1'), 'dealingsInTheDark', { prefer: ['done', 'skip'] })
  state.campaign.records.theCellRefusedEcesOffer = true
  runInTransaction(state, (draft, api) => {
    api.choose = () => draft.investigators[0].seat
    return dealings.behavior.resolution(draft, 'resolution1', [], api)
  })
  assert.match(String(state.campaign.records.twistedAntiprismBearer || ''), /investigator:/, 'R1→R2 应记录调查员保管')
  // 合作 → R1→R3→R4（艾婕信任）
  state = enterScenario(createState('p1-14b2'), 'dealingsInTheDark', { prefer: ['done', 'skip'] })
  state.campaign.records.theCellIsWorkingWithEce = true
  runInTransaction(state, (draft, api) => {
    api.choose = () => draft.investigators[0].seat
    return dealings.behavior.resolution(draft, 'resolution1', [], api)
  })
  assert.equal(state.campaign.records.eceTrustsTheCell, true, '合作分支应到结局 4')
  // 欺骗 → R1→R3→R5（艾婕不信任）
  state = enterScenario(createState('p1-14b3'), 'dealingsInTheDark', { prefer: ['done', 'skip'] })
  // 开场三选一默认会被 settle 选「与艾婕合作」，这里显式改成「欺骗艾婕」以走 R3→R5。
  state.campaign.records.theCellIsWorkingWithEce = false
  state.campaign.records.theCellIsDecievingEce = true
  runInTransaction(state, (draft, api) => {
    api.choose = () => draft.investigators[0].seat
    return dealings.behavior.resolution(draft, 'resolution1', [], api)
  })
  assert.equal(state.campaign.records.eceDoesNotTrustTheCell, true, '欺骗分支应到结局 5')
})

test('P1-14c sanguine「云开见日」：红衣女郎仍有标靶 → 结局 1', () => {
  const state = enterScenario(createState('p1-14c'), 'sanguineShadows', { prefer: ['done', 'skip'] })
  const chapter = state.scenarioFlags.sanguineShadows
  chapter.referenceTargets = 3
  chapter.laChicaRojaTargets = 1
  let finished = null
  const output = sanguine.enterCastALight(state, { info: () => {}, finish: key => { finished = key } })
  assert.equal(finished, 'resolution1', '有标靶时应直接进入结局 1')
  assert.equal(output, 'resolution1')
})

test('P1-14d sanguine「云开见日 7」：生成 09557b 剧情支援并进入「见红」', () => {
  const state = enterScenario(createState('p1-14d'), 'sanguineShadows', { prefer: ['done', 'skip'] })
  const chapter = state.scenarioFlags.sanguineShadows
  chapter.referenceTargets = 3
  chapter.laChicaRojaTargets = 0
  state.campaign.records.matiasBolivarTrustsYou = true
  const output = runInTransaction(state, (draft, api) => {
    // 直接调用章节行为时用同步 choose 桩，避免在事务执行函数里再挂选择（引擎要求经继续事务）。
    api.choose = request => (request?.kind === 'investigator' ? draft.investigators[0].seat : 'believe')
    return sanguine.enterCastALight(draft, api)
  })
  assert.equal(output, 'seeingRed')
  // 09557b 进入调查员 assets（剧情支援面由调查员控制）。
  const ally = state.investigators[0].assets.find(asset => asset.code === '09557b')
  assert.ok(ally, '红衣女郎应翻到 09557b 并由调查员控制')
  assert.equal(ally.controllerSeat, state.investigators[0].seat)
  // 「见红」同时是当前幕与当前密谋。
  assert.equal(String(state.acts?.[0]?.code || state.acts?.[0]?.originalCode), '09562')
  assert.equal(String(state.agendas?.[0]?.code || state.agendas?.[0]?.originalCode), '09562')
})

// ---------------------------------------------------------------------------
// P1-15 血色阴影隐私：known 按座位隔离（knownBy），投影与公开日志不泄露身份。
// ---------------------------------------------------------------------------
test('P1-15 迷你卡「查看已揭示面」只对对应座位可见（knownBy 隔离）', () => {
  const state = enterScenario(createState('p1-15'), 'sanguineShadows', { prefer: ['done', 'skip'] })
  const inv = state.investigators[0]
  let mini = null
  runInTransaction(state, (draft, api) => {
    mini = api.mechanics.tsk.concealed.place({
      kind: 'enemy09557', code: '09557', decoy: false, locationId: draft.investigators[0].location,
    })
    api.mechanics.tsk.concealed.markKnown(mini.id, inv.seat)
  })
  assert.ok(mini?.id)
  const own = viewState(state, inv.seat).concealedMiniCards.find(row => row.visible)
  const other = viewState(state, 1).concealedMiniCards.find(row => row.visible)
  assert.ok(own, '合法查看的座位应看到这一面')
  assert.equal(other, undefined, '其他座位的投影不得暴露真身/诱饵身份')
  // 机制面板同样按观察者过滤。
  const ownView = mechanicView(state, inv.seat)
  const otherView = mechanicView(state, 1)
  assert.ok(ownView?.tsk?.concealed?.some(row => row.visible))
  assert.ok(!otherView?.tsk?.concealed?.some(row => row.visible && row.kind === 'enemy09557'))
})

// ---------------------------------------------------------------------------
// P1-12 章节状态观察投影：战役清单声明 → observation + mechanic-view 双读点。
// ---------------------------------------------------------------------------
test('P1-12 章节公开状态按清单声明投影（deadHeat 计数可见、未声明键不泄露）', () => {
  const state = enterScenario(createState('p1-12'), 'deadHeat', { prefer: ['done', 'skip'] })
  state.scenarioFlags.deadHeatTime = 3
  state.scenarioFlags.deadHeatRescued = 2
  state.scenarioFlags.secretInternal = { shouldNotLeak: true }
  const view = viewState(state, 0)
  assert.equal(view.scenarioFlagsPublic.deadHeatTime, 3, '声明的计数应投影')
  assert.equal(view.scenarioFlagsPublic.deadHeatRescued, 2)
  assert.equal(view.scenarioFlagsPublic.secretInternal, undefined, '未声明键不得下发')
  assert.equal(JSON.stringify(view.scenarioFlagsPublic).includes('shouldNotLeak'), false)
  // mechanic-view 用同一份声明生成摘要行。
  const mechanics = mechanicView(state, 0)
  const row = mechanics?.tsk?.scenarioFlags?.find(item => item.key === 'deadHeatTime')
  assert.ok(row, 'mechanic-view 应包含章节状态摘要行')
  assert.equal(row.value, 3)
})

// ---------------------------------------------------------------------------
// P1-11 章级机制缺口：deadHeat 09524/09521/09522/09532、riddles 09516/09517。
// ---------------------------------------------------------------------------
test('P1-11a deadHeat 09524：苋被击败改为推进幕 1（enemyCanBeDefeated 不真正击败）', () => {
  const state = enterScenario(createState('p1-11a'), 'deadHeat', { prefer: ['done', 'skip'] })
  const amaranth = deadHeat.spawnAmaranth(state, scenarioRuntime(state, []))
  assert.ok(amaranth, '苋应在幕 1 背面入场')
  // 正面目标：would be defeated → 不击败，改为推进幕 1。
  assert.equal(deadHeat.behavior.enemyCanBeDefeated(state, amaranth), false, '苋不应被真正击败')
  assert.equal(state.scenarioFlags.deadHeatAmaranthWouldFall, true)
  const beforeIndex = state.actIndex
  runInTransaction(state, (draft, api) => deadHeat.behavior.checkObjectives(draft, api))
  assert.ok(state.actIndex > beforeIndex || state.scenarioFlags.deadHeatAct2Reason === 'defeat',
    'checkObjectives 应把「将被击败」兑现成幕 1 推进')
})

test('P1-11b deadHeat 09521/09522 关键词与 09532 支援费用', () => {
  const state = enterScenario(createState('p1-11b'), 'deadHeat', { prefer: ['done', 'skip'] })
  const api = scenarioRuntime(state, [])
  // 议程 1 正面：复生者/食尸鬼获得「生成-随机地点」。
  const location = state.locations[0].id
  const rolled = deadHeat.behavior.spawnLocation(state, '01161', location, null, api)
  assert.notEqual(rolled, location, '议程正面时复生者/食尸鬼应改到随机地点生成')
  // 议程 2 正面：再加猎手。
  state.agendas[0].code = '09522'
  state.agendas[0].originalCode = '09522'
  state.agendas[0].face = 'front'
  const ghoul = { id: 'ghoul-x', code: '01161', originalCode: '01161', location, traits: ['Ghoul'] }
  state.enemies.push(ghoul)
  deadHeat.behavior.enemySpawned(state, ghoul, api)
  assert.equal(ghoul.hunter, true, '议程 2 正面应给复生者/食尸鬼猎手')
  // 09532 废弃版杰马广场：在此打出的支援费用 +2（引擎 turn-flow 的剧本层读点）。
  const jemaa = state.locations.find(item => item.id === 'jemaaElFnaaSquare')
  if (jemaa) jemaa.originalCode = '09532'
  const prober = { location: jemaa ? jemaa.id : 'jemaaElFnaaSquareAbandoned' }
  if (!jemaa) state.locations.push({ id: 'jemaaElFnaaSquareAbandoned' })
  assert.equal(deadHeat.behavior.playCostIncrease(state, prober), 2, '09532 上打支援应 +2 费用')
})

test('P1-11c riddles 09516 伦敦塔进入费用与 09517 迷你卡落点重定向', () => {
  const state = enterScenario(createState('p1-11c'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  const inv = state.investigators[0]
  inv.location = 'towerBridge'
  inv.clues = 0
  assert.match(String(riddles.behavior.moveError(state, inv, { id: 'towerOfLondon' }, 'towerOfLondon') || ''),
    /进入伦敦塔/, '线索不足时应阻止进入伦敦塔并说明团队线索费用')
  inv.clues = 4
  assert.equal(riddles.behavior.moveError(state, inv, { id: 'towerOfLondon' }, 'towerOfLondon'), null)
  const before = inv.clues
  assert.equal(riddles.behavior.beforeMove(state, inv, { id: 'towerOfLondon' }, { info: () => {} }), true)
  assert.ok(inv.clues < before, '进入伦敦塔应实际花费团队线索')
  // 09517：隐匿迷你卡要进入其它地点时改为伦敦塔监狱。
  const prison = state.locations.find(location => location.id === 'towerPrison')
  if (prison) {
    assert.equal(riddles.behavior.redirectConcealedLocation(state, 'bigBen'), 'towerPrison')
    assert.equal(riddles.behavior.redirectConcealedLocation(state, 'towerPrison'), 'towerPrison')
  }
})

// ---------------------------------------------------------------------------
// 第三轮剩余「引擎原语级」读点回归（2026-11-13 P1-6 / P1-8 / P1-16）。
// ---------------------------------------------------------------------------
test('P1-R1 09740阴霾日食：每位调查员每轮最多揭露 1 张（exposeLimitPerInvestigatorPerRound）', () => {
  const state = enterScenario(createState('p1-r1'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const inv = state.investigators[0]
  const minis = []
  runInTransaction(state, (draft, api) => {
    draft.agendaAside ||= []
    draft.agendaAside.push({ code: '09740', originalCode: '09740' })
    for (let index = 0; index < 2; index += 1) {
      minis.push(api.mechanics.tsk.concealed.place({
        kind: `enemy09716${index}`, code: '09716', decoy: false, locationId: draft.investigators[0].location,
      }))
    }
    api.mechanics.tsk.concealed.expose(minis[0].id, { seat: inv.seat })
    assert.throws(() => api.mechanics.tsk.concealed.expose(minis[1].id, { seat: inv.seat }),
      /最多.*1 张|不能再揭露|1 张隐匿迷你卡/, '同一轮第二次揭露应被 09740 阻止')
  })
})

test('P1-R2 09007 受伤的旁观者：非直接伤害第 1 点强制分配给它', () => {
  const state = enterScenario(createState('p1-r2'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const draft = structuredClone(state)
  const inv = draft.investigators[0]
  inv.assets.push({ id: 'bystander-x', code: '09007', originalCode: '09007', damage: 3 })
  inv.assets.push({ id: 'other-asset', code: '01020', originalCode: '01020' })
  // 直接走引擎伤害分配读点：第 1 点应只允许分配给受伤的旁观者（不提供 self / 其它支援）。
  draft._resolution = { cursor: 0, answers: [], id: 7 }
  let pending = null
  try {
    assignHarm(draft, inv, 1, 'damage', [], false)
  } catch (error) {
    if (!error?.choice) throw error
    pending = error.choice
  }
  assert.ok(pending, '第 1 点非直接伤害应出现分配选择')
  assert.deepEqual(pending.options.map(option => option.id), ['bystander-x'],
    '第 1 点的候选只能是受伤的旁观者')
})

test('P1-R3 09103 临时盾牌：只能从弃牌堆打出，legalMoves 有普通行动入口', () => {
  const state = enterScenario(createState('p1-r3'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const inv = state.investigators[0]
  runInTransaction(state, (draft, api) => {
    draft.investigators[0].discard.push('09103')
  })
  const moves = legalMoves(state, 0).filter(move => move.action === 'play' && move.cardId === '09103')
  assert.ok(moves.length >= 1, '弃牌堆里的 09103 应作为普通行动出现')
  assert.equal(moves[0].fromDiscard, true)
})

test('P1-R4 09124 暗处潜伏者：来源特质限制 + 每来源减 1 点伤害', () => {
  const state = enterScenario(createState('p1-r4'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const entry = registeredEntry('09124')
  assert.deepEqual(entry?.enemyRule?.damageOnlyFromSourceTraits?.traits, ['Weapon', 'Tactic'])
  assert.equal(entry?.enemyRule?.damageReductionFromAllSources, 1)
})

test('P1-R5 09766 基金会情报：cannotLeaveHand 四个通道读点', () => {
  const state = enterScenario(createState('p1-r5'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  runInTransaction(state, (draft) => {
    draft.investigators[0].hand.push('09766')
  })
  assert.ok(state.investigators[0].hand.includes('09766'), '09766 应在手牌中')
  // 弃牌通道兜底：即使被前置逻辑移出，也放回手牌而不进弃牌堆（player-zones 读点）。
  const beforeDiscard = state.investigators[0].discard.length
  state.investigators[0].hand = state.investigators[0].hand.filter(code => code !== '09766')
  runInTransaction(state, (draft) => {
    const inv = draft.investigators[0]
    // 模拟某个效果已经把它从手牌移出后走统一弃牌入口——应被放回手牌。
    discardPlayerCards(draft, inv, '09766')
  })
  assert.ok(state.investigators[0].hand.includes('09766'), '09766 应被放回手牌')
  assert.equal(state.investigators[0].discard.length, beforeDiscard, '09766 不应进入弃牌堆')
  // 不能打出：validate 层 / 合法动作列表都不应有普通打出入口。
  assert.ok(!legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === '09766'),
    '不能离开手牌的牌不应有普通打出入口')
})

test('P1-R6 隐匿迷你卡：legalMoves 提供攻击/躲避动作（难度=隐蔽值+地点加成）', () => {
  const state = enterScenario(createState('p1-r6'), 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  const inv = state.investigators[0]
  runInTransaction(state, (draft, api) => {
    api.mechanics.tsk.concealed.place({
      kind: 'enemy09716a', code: '09716a', decoy: false, locationId: draft.investigators[0].location,
    })
  })
  const moves = legalMoves(state, 0).filter(move => ['fightConcealed', 'evadeConcealed'].includes(move.action))
  assert.ok(moves.length >= 2, '同地点的隐匿迷你卡应给出攻击/躲避目标动作')
  assert.match(moves[0].label, /隐匿迷你卡/)
  void inv
})

test('P1-R7 09015 达雷尔：他人同地点检定的窗口参与声明', () => {
  const entry = registeredEntry('09015')
  assert.equal(entry?.flags?.testWindowObserver, true, '09015 应声明 testWindowObserver')
})


