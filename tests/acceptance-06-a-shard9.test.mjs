// 验收 06-a · 食梦者 · 分片 9（woc，06323–06354）的逐卡证据测试。
//
// 覆盖本分片「既有证据只是文件级/数据一致性」的 9 张战役卡 + 场景参考卡 06333 的混乱标记行为：
//   06333（场景参考卡：混乱标记数值与后果）
//   06335（议程 2：毁灭阈值 +2/人、背面洗回遭遇弃牌堆）
//   06337 / 06338 / 06339（三幕：幕 1 目标与展开大网、幕 2 神话旋转/古神行动/四腿目标、幕 3 击败目标与结局）
//   06345（巨网·网编浮岛：调查额外费用二选一）
//   06348 / 06349 / 06350（三条阿特拉克之腿：隐藏值战斗修正 + 不能借机攻击 + 躲避替代）
//   06352（黑暗中的织网者：附属最近古神敌人、+1 伤害/恐惧、摆脱行动）
//
// 章节行为、单卡条目和幕 1 的真实支付动作分别覆盖对应规则。
import test from 'node:test'
import assert from 'node:assert/strict'

import * as engine from '../src/engine/engine.js'
import { settlePendingChoices } from './tde-p95-fixture.mjs'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/behavior.js'
import {
  scenario as definition, WEB, RING, EXPANSION, LEGS, LEGS_HOME, ATLACH_NACHA, SPINNER, ACT_CODES,
} from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/definition.js'
import { weaverChaosToken, weaverChaosAfterTest } from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/chaos.js'
import location06345 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06345.js'
import legs06348 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06348.js'
import legs06349 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06349.js'
import legs06350 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06350.js'
import spinner06352 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06352.js'

const CLONE = value => JSON.parse(JSON.stringify(value))
const loc = (state, id) => state.locations.find(location => location.id === id)

function rotateRing (state, order, fromId, times = 1) {
  const index = order.indexOf(fromId)
  return order[(index + times) % order.length]
}

function stateFor (count = 2) {
  return {
    scenario: CLONE(definition),
    acts: CLONE(definition.acts),
    agendas: CLONE(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'theGreatWeb1',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3, agility: 3, combat: 3, willpower: 3, intellect: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: { setAside: [] },
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: { leadSeat: 0, records: {}, investigators: Array.from({ length: count }, () => ({ deck: [] })) },
    chaosBag: ['+1', '0', '-1', '-2', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
    currentSeat: 0, turnSerial: 1,
  }
}

function placeLocations (state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base || loc(state, id)) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    state.locations.push({
      ...CLONE(base), id, revealed: true, clues, maxClues: clues, doom: 0,
      connections: [...(base.connections || [])],
    })
  }
}

function setupState (count = 2) {
  const state = stateFor(count)
  const ids = behavior.setupLocations(state, [], { randomValue: () => 0.5, shuffle: list => [...list] })
  placeLocations(state, ids)
  for (const inv of state.investigators) inv.location = 'theGreatWeb1'
  return state
}

function createApi (state, overrides = {}) {
  const calls = []
  const api = {
    __calls: calls,
    info: () => {},
    choice: request => request?.options?.[0]?.id ?? null,
    choose: request => api.choice(request),
    random: () => 0.5,
    shuffle: list => [...list],
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, drawn: [], source: null }),
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, location: locationId,
        damageTaken: 0, exhausted: false, defeated: false, engagedSeat: null, doom: 0,
        traits: (CLONE(definition.enemies?.[code]?.traits) || []), name: CLONE(definition.enemies?.[code]?.name) }
      state.enemies.push(enemy)
      return enemy
    },
    place: id => {
      const base = state.scenario.locations[id]
      if (!base || loc(state, id)) return null
      const location = { ...CLONE(base), id, revealed: false, clues: 0, doom: 0, connections: [...(base.connections || [])] }
      state.locations.push(location)
      return location
    },
    remove: id => { state.locations = state.locations.filter(location => location.id !== id) },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    locationDoom: {
      add: (location, amount) => { location.doom = (location.doom || 0) + amount; return location.doom },
      remove: (location, amount) => { location.doom = Math.max(0, (location.doom || 0) - amount); return location.doom },
    },
    rotateGlobalEnemy: () => {},
    putGlobalEnemy: code => { calls.push(['putGlobalEnemy', code]) },
    placeGlobalEnemyAt: (enemy, id) => { enemy.location = id },
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(code)
      if (index >= 0) list.splice(index, 1)
      return index >= 0
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes) },
    shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard); state.encounterDiscard = [] },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    spendAction: seat => { const inv = state.investigators[seat]; inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1) },
    damageEnemy: (enemy, amount) => { enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    attack: (enemy, inv) => { calls.push(['attack', enemy.code, inv.seat]) },
    attackWithSwarm: (enemy, holder) => { calls.push(['attackWithSwarm', enemy.code, holder.seat]) },
    advanceAct: () => { state.advanced = (state.advanced || 0) + 1 },
    finish: key => { state.finishedWith = key },
    present: () => {},
    protectFromEnemyAttack: (enemy, seat, options) => { enemy.attackProtection = [seat, options?.until] },
    readyEnemy: enemy => { enemy.exhausted = false },
    attachStoryAssetToEnemy: (code, enemyId, extra) => {
      const enemy = state.enemies.find(item => String(item.id) === String(enemyId))
      if (!enemy) return null
      const attachment = { id: `att-${code}`, code, originalCode: code, ...(extra || {}) }
      enemy.attachments = [...(enemy.attachments || []), attachment]
      return attachment
    },
    detachEnemyAttachment: (enemyId, attachmentId) => {
      const enemy = state.enemies.find(item => String(item.id) === String(enemyId))
      if (!enemy) return false
      enemy.attachments = (enemy.attachments || []).filter(item => item.id !== attachmentId)
      return true
    },
  }
  return Object.assign(api, overrides)
}

// ---------------------------------------------------------------------------
// 06333 场景参考卡：混乱标记数值与后果
// ---------------------------------------------------------------------------
test('06-a9 06333 编织宇宙：混乱标记数值（最高/总毁灭、tablet、elderthing）与后果', () => {
  const state = stateFor(2)
  placeLocations(state, ['theGreatWeb1', 'theGreatWeb2'])
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb1'
  loc(state, 'theGreatWeb1').doom = 3
  loc(state, 'theGreatWeb2').doom = 2
  assert.equal(weaverChaosToken(state, inv, 'skull', {}), -3, '标准：skull = -场上单个地点最高毁灭')
  assert.equal(weaverChaosToken(state, inv, 'tablet', {}), 0, '标准：tablet 0')
  assert.equal(weaverChaosToken(state, inv, 'elderthing', {}), -3, '标准：elder_thing -3')
  state.difficulty = 'hard'
  assert.equal(weaverChaosToken(state, inv, 'skull', {}), -5, '困难：skull = -场上地点毁灭总数')
  assert.equal(weaverChaosToken(state, inv, 'tablet', {}), -1, '困难：tablet -1')
  assert.equal(weaverChaosToken(state, inv, 'elderthing', {}), -4, '困难：elder_thing -4')
  state.difficulty = 'standard'
  assert.deepEqual(behavior.resolveChaosToken(state, inv, 'cultist', createApi(state)), { delta: 0, drawAnother: true },
    '[cultist]：再揭示一个标记')

  // [tablet] 成功超过难度 2 点：移除所在地点 1 毁灭。
  const api = createApi(state)
  weaverChaosAfterTest(state, inv, { success: true, value: 5, difficulty: 3, drawn: ['tablet'], source: {} }, api)
  assert.equal(loc(state, 'theGreatWeb1').doom, 2, '[tablet] 成功且超出 2 点：移除 1 个毁灭标记')

  // [elderthing] 攻击蜘蛛失败：该敌人所在地点 +1 毁灭。
  const spider = api.spawn('06102', 'theGreatWeb2')
  weaverChaosAfterTest(state, inv, {
    success: false, value: 1, difficulty: 3, drawn: ['elderthing'],
    source: { action: 'fight', enemy: spider },
  }, api)
  assert.equal(loc(state, 'theGreatWeb2').doom, 3, '[elder_thing] 攻击[[蜘蛛]]失败：敌人地点放 1 毁灭')

  // [cultist] 失败且所在地点有[[古神]]敌人：其攻击你。
  const ancient = api.spawn(ATLACH_NACHA, 'theGreatWeb1')
  const attackApi = createApi(state)
  weaverChaosAfterTest(state, inv, { success: false, value: 1, difficulty: 3, drawn: ['cultist'], source: {} }, attackApi)
  assert.ok(attackApi.__calls.some(call => call[0] === 'attack' && call[1] === ancient.code), '[cultist] 失败：古神敌人攻击')
})

// ---------------------------------------------------------------------------
// 06335 曲折道路：毁灭阈值 +2/人；背面把遭遇弃牌堆洗回
// ---------------------------------------------------------------------------
test('06-a9 06335 曲折道路：毁灭阈值 +2[每调查员]，背面洗回遭遇弃牌堆', () => {
  const state = stateFor(2)
  behavior.afterChaosBagSetup(state)
  assert.equal(state.agendas[1].originalCode, '06335')
  assert.equal(state.agendas[1].doomThreshold, 9 + 2 * 2, '印刷 9 + 2[每调查员]×2 = 13')
  assert.equal(state.agendas[0].doomThreshold, 7 + 2 * 2, '议程 1 同为 +2/人')
  state.encounterDiscard = ['06102']
  const api = createApi(state)
  behavior.agendaAdvancing(state, state.agendas[1], api)
  assert.equal(state.encounterDiscard.length, 0, '背面：遭遇弃牌堆洗回遭遇牌库')
  assert.ok(state.encounterDeck.includes('06102'))
})

// ---------------------------------------------------------------------------
// 06337 穿过桥梁：幕 1 目标（全员最下方 + 团队 3/人线索）与背面展开大网
// ---------------------------------------------------------------------------
test('06-a9 06337 穿过桥梁：全员在最下方并共同支付线索后，翻幕展开大网并生成四条腿', () => {
  const state = engine.createGameState({ seed: 'acceptance-06-a-shard9', playerInvestigator: '01001' }, [{ seat: 0 }, { seat: 1 }])
  settlePendingChoices(engine, state)
  engine.startScenario(state, 0, [], 'weaverOfTheCosmos')
  for (const [index, id] of WEB.entries()) {
    const adjacent = [WEB[index - 1], WEB[index + 1]].filter(Boolean)
    assert.deepEqual(loc(state, id).connections.filter(target => WEB.includes(target)).sort(), adjacent.sort())
  }
  const findAdvance = () => engine.legalMoves(state, 0).find(move => move.action === 'advanceAct')
  state.investigators[0].location = WEB[3]
  state.investigators[0].clues = 6
  state.investigators[1].location = WEB[2]
  assert.equal(findAdvance(), undefined, '队友没有到达最下方地点')
  state.investigators[1].location = WEB[3]
  state.investigators[0].clues = 4
  state.investigators[1].clues = 1
  assert.equal(findAdvance(), undefined, '队伍线索不足')
  state.investigators[1].clues = 2
  engine.checkAct(state, [])
  assert.equal(state.actIndex, 0, '队伍满足条件后可自行决定何时支付')
  const move = findAdvance()
  assert.ok(move)
  engine.applyMove(state, 0, move)
  for (const [seat, amount] of [[0, 4], [1, 2]]) {
    const choice = state.pendingChoice
    assert.equal(choice?.kind, 'payment', '进入共同支付分摊窗口')
    assert.equal(choice.seat, seat)
    assert.ok(choice.options.some(option => option.id === String(amount)))
    engine.applyMove(state, seat, { action: 'choose', choiceId: choice.id, optionId: String(amount) })
  }
  assert.deepEqual(state.investigators.map(inv => inv.clues), [0, 0])
  assert.equal(state.actIndex, 1)
  assert.equal(EXPANSION.filter(id => loc(state, id)).length, 7)
  for (const [code, homeId] of Object.entries(LEGS_HOME)) {
    assert.ok(state.enemies.some(enemy => enemy.code === code && enemy.location === homeId),
      `${code} 之腿生成在 ${homeId}`)
  }
  assert.equal(state.scenarioFlags.atlachCenter?.assembled, true)
  assert.equal(state.encounterDeck.filter(code => code === SPINNER).length, 2)
})

// ---------------------------------------------------------------------------
// 06338 编织宇宙（幕 2）：花线索伤古神、神话旋转四腿、胜利区四腿推进
// ---------------------------------------------------------------------------
test('06-a9 06338 编织宇宙：花 1 线索伤[[古神]]、神话旋转四腿、胜利区四腿推进', () => {
  const state = setupState(2)
  placeLocations(state, Object.keys(definition.locations))
  state.actIndex = ACT_CODES.indexOf('06338')
  const inv = state.investigators[0]
  inv.clues = 2
  inv.location = 'theGreatWeb5'
  const api = createApi(state)
  const ancient = api.spawn(ATLACH_NACHA, 'theGreatWeb5')
  const moves = behavior.actions(state, inv)
  const move = moves.find(item => item.rule === 'spendClueDamageAncientOne')
  assert.ok(move, '幕 2 提供「花费 1 线索：对[[古神]]敌人造成 3 点伤害」')
  behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 1, '支付 1 个线索')
  assert.equal(ancient.damageTaken, 3, '对古神敌人造成 3 点伤害')

  // 神话阶段开始：负修正标记让四条腿顺时针旋转。
  const legs = []
  for (const [code, homeId] of Object.entries(LEGS_HOME)) legs.push(api.spawn(code, homeId))
  state.chaosBag = ['-2']
  behavior.phaseBegan(state, 'mythos', createApi(state))
  for (const leg of legs) {
    const beforeHome = Object.entries(LEGS_HOME).find(([code]) => code === leg.code)[1]
    assert.notEqual(leg.location, beforeHome, `${leg.code} 旋转后离开原地点`)
    assert.equal(leg.location, rotateRing(state, RING, beforeHome, 2), `${leg.code} 顺时针旋转 2 格`)
  }

  // 胜利区 4 条腿 → 推进。
  state.victoryDisplay = LEGS.map(code => ({ id: `v-${code}`, code, originalCode: code }))
  const advanceApi = createApi(state)
  behavior.checkObjectives(state, advanceApi)
  assert.equal(state.advanced, 1, '胜利区 4 张阿特拉克之腿：推进幕 2')
})

// ---------------------------------------------------------------------------
// 06339 阴谋破灭（幕 3）：击败阿特拉克·纳克亚推进；背面 → 结局
// ---------------------------------------------------------------------------
test('06-a9 06339 阴谋破灭：阿特拉克·纳克亚被击败时推进，背面结算结局', () => {
  const state = setupState(2)
  state.actIndex = ACT_CODES.indexOf('06339')
  const api = createApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(state.advanced, undefined, '未击败时不推进')
  state.scenarioFlags.atlachNachaDefeated = true
  behavior.checkObjectives(state, api)
  assert.equal(state.advanced, 1, '阿特拉克·纳克亚被击败：推进幕 3')
  behavior.actLeftPlay(state, state.acts[state.actIndex], api)
  assert.equal(state.finishedWith, 'resolution5', '无战役记录时背面 → 结局 5')
})

// ---------------------------------------------------------------------------
// 06345 巨网·网编浮岛：调查的额外费用——花 1 行动或放 1 毁灭
// ---------------------------------------------------------------------------
test('06-a9 06345 巨网·网编浮岛：调查额外费用二选一（行动/毁灭）', () => {
  const state = setupState(2)
  placeLocations(state, Object.keys(definition.locations))
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb11'
  inv.actionsLeft = 3
  const doomApi = createApi(state, { choose: () => 'doom' })
  behavior.beforeInvestigate(state, inv, loc(state, 'theGreatWeb11'), doomApi)
  assert.equal(loc(state, 'theGreatWeb11').doom, 1, '选择放置 1 个毁灭标记')
  const actionApi = createApi(state, { choose: () => 'action' })
  behavior.beforeInvestigate(state, inv, loc(state, 'theGreatWeb11'), actionApi)
  assert.equal(inv.actionsLeft, 2, '选择花费 1 个行动')
  assert.equal(location06345.code, '06345')
})

// ---------------------------------------------------------------------------
// 06348 / 06349 / 06350 阿特拉克·纳克亚之腿：隐藏值战斗修正、不能借机攻击、躲避替代
// ---------------------------------------------------------------------------
for (const entry of [legs06348, legs06349, legs06350]) {
  test(`06-a9 ${entry.code} 阿特拉克·纳克亚之腿：战斗值=地点隐藏值、不能借机攻击、躲避替代保护`, () => {
    const state = setupState(2)
    placeLocations(state, Object.keys(definition.locations))
    const api = createApi(state)
    const shroud = Number(loc(state, 'theGreatWeb5').shroud || 0)
    const fightModifier = entry.modifiers.find(modifier => modifier.target === 'enemyFight')
    const enemy = api.spawn(entry.code, 'theGreatWeb5')
    assert.equal(-2 + fightModifier.amount({ state, entity: enemy }), shroud,
      '印刷战斗值 -2 + 修正（隐藏值+2）= 地点隐藏值')
    assert.ok(entry.modifiers.some(modifier => modifier.target === 'cannot:opportunityAttack'),
      '本敌人不能进行趁乱攻击')
    enemy.exhausted = true
    behavior.afterEvade(state, state.investigators[0], enemy, { success: true }, api)
    assert.equal(enemy.exhausted, false, '躲避替代：不横置')
    assert.equal(enemy.attackProtection?.[0], state.investigators[0].seat, '本轮不能攻击所选调查员')
  })
}

// ---------------------------------------------------------------------------
// 06352 黑暗中的织网者：附属最近[[古神]]敌人、+1 伤害/恐惧、检定任意技能摆脱
// ---------------------------------------------------------------------------
test('06-a9 06352 黑暗中的织网者：附属最近[[古神]]敌人 +1 伤害/恐惧，可检定摆脱', () => {
  const state = setupState(2)
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb1'
  const api = createApi(state)
  const near = api.spawn(ATLACH_NACHA, 'theGreatWeb2')
  const far = api.spawn(ATLACH_NACHA, 'theGreatWeb6')
  const handled = spinner06352.encounterResolve(state, inv, { code: SPINNER }, api)
  assert.equal(handled, true, '显现：附属到最近的[[古神]]敌人')
  assert.equal((near.attachments || []).length, 1, '最近（1 格）的古神敌人获得附属')
  assert.equal((far.attachments || []).length, 0, '更远的古神敌人不获得附属')
  assert.deepEqual(behavior.enemyAttackModifier(state, near), { damage: 1, horror: 1 }, '附属敌人 +1 伤害与 +1 恐惧')

  inv.location = near.location
  const moves = behavior.actions(state, inv)
  const discard = moves.find(item => String(item.rule).startsWith('discardSpinner:'))
  assert.ok(discard, '提供「检定任意技能(5)：弃掉黑暗中的织网者」行动')
  const discardApi = createApi(state, {
    choose: request => (request.kind === 'skill' ? 'willpower' : request.options?.[0]?.id),
  })
  behavior.performAction(state, inv, { ...discard, rule: `discardSpinner:${near.id}` }, discardApi)
  assert.equal((near.attachments || []).length, 0, '检定成功：弃掉附属')
  assert.ok(state.encounterDiscard.includes(SPINNER), '黑暗中的织网者进入遭遇弃牌堆')
})
