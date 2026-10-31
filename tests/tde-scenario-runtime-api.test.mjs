// P8 内容层通用 API 与共享规则层的 Node 验收（食梦者 M3）。
//
// 证据目标（路线图 §8.3 / §11.2 的 setup/记录/原语门禁）：
//   1. `src/engine/scenario-runtime.js` 新增的遭遇牌库/地点线索 API 真的暴露给内容层，
//      并且行为正确（顶部弃牌、按卡号弃牌、取弃牌堆、线索增减、JSON 往返）；
//   2. `content/campaigns/theDreamEaters/encounter-rules.js` 的共享层：
//      Swarming 蜂拥卡放置/击败门槛/溢出伤害、Veiled [fast] 翻面行动、威胁区 turnEnd 强制、
//      enemyScript 分派、牌库耗尽强制；
//   3. 共享层导出被章节 behavior 覆盖时依赖的键都存在（防止 `{...encounterRules}` 静默缺键）。
//
// 这些原语不新增状态字段：所有写入都落在既有 state 容器（encounterDeck/encounterDiscard/locations/swarmCards）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { createScenarioRuntime } from '../src/engine/scenario-runtime.js'
import * as engine from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  activeInvestigators, applySwarmOverflow, discardEncounterTop, encounterRules, flagOf, performVeiledFlip,
  playerOrder, placeSwarmCardsFor, swarmBlockedReasonOf, veiledFastActions, watchEncounterDeckEmpty,
} from '../content/campaigns/theDreamEaters/encounter-rules.js'

// createScenarioRuntime(deps) 只在构造时解构 deps；用 Proxy 提供缺省空函数，显式覆盖本测试需要的真实现。
function buildRuntime(overrides = {}) {
  const defaults = {
    shuffle: list => list,
    randomValue: () => 0.5,
    info: () => {},
    cardName: code => String(code),
    scenarioBehavior: () => ({}),
    syncClues: () => {},
  }
  const deps = new Proxy({ ...defaults, ...overrides }, {
    get(target, key) {
      if (key in target) return target[key]
      return () => undefined
    },
  })
  return createScenarioRuntime(deps)
}

function baseState(overrides = {}) {
  return {
    encounters: [],
    encounterDeck: ['a', 'b', 'c'],
    encounterDiscard: [],
    investigators: [
      { seat: 0, name: '甲', location: 'loc1', clues: 0, threat: [], hand: [], deck: [], discard: [], defeated: false, resigned: false, movedThisTurn: false },
      { seat: 1, name: '乙', location: 'loc1', clues: 0, threat: [], hand: [], deck: [], discard: [], defeated: false, resigned: false, movedThisTurn: false },
    ],
    locations: [
      { id: 'loc1', code: '06119', name: '测试地点', clues: 0, veiled: true, veiledRevealed: false, connections: [] },
      { id: 'loc2', code: '06120', name: '邻居', clues: 0, connections: ['loc1'] },
    ],
    enemies: [],
    scenarioFlags: {},
    scenario: { id: 'testScenario', enemies: {}, storyFaces: { '06119b': { code: '06119b', text: '故事正文' } } },
    round: 1,
    phase: 'investigation',
    status: 'playing',
    currentSeat: 0,
    numInvestigators: 2,
    campaign: { leadSeat: 0, records: {} },
    difficulty: 'standard',
    ...overrides,
  }
}

test('runtime api：discardEncounterTop 从牌库顶弃牌并进弃牌堆', () => {
  const state = baseState()
  const api = buildRuntime()(state, [], null)
  assert.equal(typeof api.discardEncounterTop, 'function', '内容层必须拿到 api.discardEncounterTop')
  const discarded = api.discardEncounterTop(2)
  assert.deepEqual(discarded, ['c', 'b'])
  assert.deepEqual(state.encounterDeck, ['a'])
  assert.deepEqual(state.encounterDiscard, ['c', 'b'])
})

test('runtime api：牌库耗尽时按 reshuffle 选项洗回弃牌堆；log:false 不写日志', () => {
  const state = baseState({ encounterDeck: [], encounterDiscard: ['x', 'y'] })
  const logs = []
  // scenario-runtime 内部以 `info(state, events, text)` 调注入的 info，测试取最后一个参数。
  const api = buildRuntime({ info: (...args) => logs.push(String(args.at(-1))) })(state, [], null)
  const discarded = api.discardEncounterTop(1)
  assert.deepEqual(discarded, ['y'], '洗回后从新牌库顶取（shuffle 是恒等函数，顺序保持）')
  assert.deepEqual(state.encounterDeck, ['x'])
  assert.ok(logs.some(text => text.includes('洗回')), '洗回应有日志')
  const quietState = baseState()
  const quietLogs = []
  const quietApi = buildRuntime({ info: (...args) => quietLogs.push(String(args.at(-1))) })(quietState, [], null)
  quietApi.discardEncounterTop(1, { log: false })
  assert.equal(quietLogs.length, 0)
})

test('runtime api：discardEncounterCard 按卡号从牌库移除并进弃牌堆；includeDiscard 可清弃牌堆', () => {
  const state = baseState()
  const api = buildRuntime()(state, [], null)
  assert.equal(api.discardEncounterCard('b'), true)
  assert.deepEqual(state.encounterDeck, ['a', 'c'])
  assert.deepEqual(state.encounterDiscard, ['b'])
  assert.equal(api.discardEncounterCard('b'), false, '牌库已无该卡')
  assert.equal(api.discardEncounterCard('b', { includeDiscard: true }), true)
  assert.deepEqual(state.encounterDiscard, [])
})

test('runtime api：takeEncounterDiscard 取回弃牌堆；toDeck 放进牌库', () => {
  const state = baseState({ encounterDeck: [], encounterDiscard: ['p', 'q'] })
  const api = buildRuntime()(state, [], null)
  assert.equal(api.takeEncounterDiscard('q'), true)
  assert.deepEqual(state.encounterDiscard, ['p'])
  assert.equal(api.takeEncounterDiscard('p', { toDeck: true }), true)
  assert.deepEqual(state.encounterDiscard, [])
  assert.deepEqual(state.encounterDeck, ['p'])
})

test('runtime api：地点线索增减走唯一入口并同步组线索池', () => {
  const state = baseState()
  const synced = []
  const api = buildRuntime({ syncClues: () => synced.push('sync') })(state, [], null)
  assert.equal(api.addCluesToLocation('loc1', 2), 2)
  assert.equal(state.locations[0].clues, 2)
  assert.equal(api.removeLocationClues('loc1', 1), 1)
  assert.equal(state.locations[0].clues, 1)
  assert.equal(api.removeLocationClues('loc1', 5), 1, '不能扣成负数')
  assert.equal(state.locations[0].clues, 0)
  assert.equal(api.addCluesToLocation('missing', 1), 0)
  assert.equal(synced.length, 3)
})

test('runtime api：状态 JSON 往返（新增 API 不引入不可序列化字段）', () => {
  const state = baseState()
  const api = buildRuntime()(state, [], null)
  api.discardEncounterTop(1)
  api.addCluesToLocation('loc1', 1)
  const roundTrip = JSON.parse(JSON.stringify(state))
  assert.deepEqual(roundTrip, state)
  assert.deepEqual(JSON.parse(JSON.stringify(roundTrip)), roundTrip)
})

test('runtime api：隐私手牌（Hidden）的放置/取出/转移/弃置全走 api.hiddenCards', () => {
  const state = baseState()
  state.investigators[0].hand = []
  state.investigators[1].hand = []
  // 引擎侧 hidden-rules 的四个函数已注入 scenarioRuntime（存在性 + 语义形状）；
  // 这里用与 hidden-rules.js 同形的最小实现驱动 api 层（避免依赖完整 engine info 管线）。
  assert.equal(typeof engine.placeHiddenCard, 'function')
  assert.equal(typeof engine.discardHiddenCard, 'function')
  const hiddenDeps = {
    placeHiddenCard: (state2, inv, definition) => {
      inv.hand.push(definition.code)
      inv.hiddenCards ||= []
      inv.hiddenCards.push(definition.code)
      return true
    },
    discardHiddenCard: (state2, inv, code) => {
      const handIndex = inv.hand.indexOf(code)
      const hiddenIndex = (inv.hiddenCards || []).indexOf(code)
      if (handIndex < 0 || hiddenIndex < 0) return false
      inv.hand.splice(handIndex, 1)
      inv.hiddenCards.splice(hiddenIndex, 1)
      state2.encounterDiscard.push(code)
      return true
    },
    hasHiddenCard: (inv, code = null) => (inv.hiddenCards || []).some(hidden => code == null || hidden === code),
    removeHiddenMarker: (inv, code) => {
      const index = (inv.hiddenCards || []).indexOf(code)
      if (index >= 0) inv.hiddenCards.splice(index, 1)
    },
    cardDef: code => ALL_CARDS[code],
  }
  const api = buildRuntime(hiddenDeps)(state, [], null)
  // 06306 是《神居之所》的 hidden 敌人（卡池数据存在即可）。
  assert.equal(api.hiddenCards.place(0, '06306'), true)
  assert.deepEqual(state.investigators[0].hand, ['06306'])
  assert.deepEqual(state.investigators[0].hiddenCards, ['06306'])
  assert.equal(api.hiddenCards.has(0, '06306'), true)
  assert.deepEqual(api.hiddenCards.list(0), ['06306'])
  assert.equal(api.hiddenCards.transfer(0, 1, '06306'), true)
  assert.deepEqual(state.investigators[0].hand, [])
  assert.deepEqual(state.investigators[1].hand, ['06306'])
  assert.equal(api.hiddenCards.has(1, '06306'), true)
  assert.equal(api.hiddenCards.take(1, '06306'), true)
  assert.deepEqual(state.investigators[1].hand, [])
  assert.equal(api.hiddenCards.has(1, '06306'), false)
  assert.equal(api.hiddenCards.take(1, '06306'), false, '已不在手中')
  // 弃置路径（手牌 → 遭遇弃牌堆）
  api.hiddenCards.place(0, '06306')
  assert.equal(api.hiddenCards.discard(0, '06306'), true)
  assert.deepEqual(state.investigators[0].hand, [])
  assert.deepEqual(state.encounterDiscard, ['06306'])
})

test('engine 读点：隐私牌「每轮最多投入 N 张」按轮计数（06319–06321）', () => {
  assert.equal(typeof engine.hiddenCommitLimitReached, 'function')
  assert.equal(typeof engine.noteHiddenCommit, 'function')
  const state = baseState({
    scenario: {
      id: 'testScenario',
      enemies: {},
      treacheries: { '06319': { hidden: true, hiddenRule: { maxCommitsPerRound: 1 } } },
    },
  })
  const inv = state.investigators[0]
  inv.hiddenCards = ['06319']
  assert.equal(engine.hiddenCommitLimitReached(state, inv), false)
  engine.noteHiddenCommit(state, inv)
  assert.equal(engine.hiddenCommitLimitReached(state, inv), true, '投入 1 张后达到上限')
  assert.deepEqual(state.scenarioFlags.hiddenCommitCounts[inv.seat], { round: 1, count: 1 })
  state.round += 1
  assert.equal(engine.hiddenCommitLimitReached(state, inv), false, '换轮重置')
  // 没有该 hiddenRule 时不产生计数（不影响其他循环状态）
  const plain = baseState()
  plain.investigators[0].hiddenCards = []
  engine.noteHiddenCommit(plain, plain.investigators[0])
  assert.equal(plain.scenarioFlags.hiddenCommitCounts, undefined)
})

test('encounter-rules：生成地点 flags 数据分派（titles / 无人地点 / 生成失败洗回+涌动）', () => {
  const state = baseState({
    locations: [
      { id: 'pitch', code: '06273', name: 'Sea of Pitch 漆黑之海', clues: 0, connections: [] },
      { id: 'other', code: '06274', name: 'Other', clues: 0, connections: [] },
    ],
  })
  // 06273 的条目 flags.spawn = { kind: 'titles', titles: ['Sea of Pitch'] }
  assert.equal(flagOf('06273').spawn?.kind, 'titles')
  const chosen = encounterRules.spawnLocation(state, '06273', 'other', 0, {})
  assert.equal(chosen, 'pitch')
  // 生成的「最近带附属地点」（06271）：没有匹配地点 → null（引擎按生成失败处理）
  assert.equal(encounterRules.spawnLocation(state, '06271', 'other', 0, {}), null)
  // 生成失败：shuffleBack 洗回 + surge 抽取
  const failedState = baseState({ encounterDiscard: ['06271'] })
  const calls = []
  const api = {
    takeEncounterDiscard: code => { calls.push(['take', code]); return true },
    shuffleIntoEncounterDeck: codes => { calls.push(['shuffle', codes]); return 1 },
    drawEncounter: seat => calls.push(['draw', seat]),
    info: () => {},
  }
  encounterRules.spawnFailed(failedState, '06271', 1, api)
  assert.deepEqual(calls, [['take', '06271'], ['shuffle', ['06271']], ['draw', 1]])
})

test('encounter-rules：检定失败限制与「失败后看牌库顶」的数据分派（06085 / 06098）', () => {
  const state = baseState()
  const inv = state.investigators[0]
  inv.threat.push({ id: 't1', code: '06085', originalCode: '06085', name: '蛛后的意志' })
  inv.threat.push({ id: 't2', code: '06098', originalCode: '06098', name: '黑夜恐怖' })
  inv.deck = ['06007', '06018', '06019']
  const logs = []
  const api = { info: text => logs.push(text) }
  const result = { success: false, difficulty: 3, value: 1 }
  encounterRules.afterTest(state, inv, result, api)
  // 06085：本轮不能攻击/调查
  assert.equal(encounterRules.canFightEnemy(state, inv, {}), false)
  assert.match(encounterRules.investigationError(state, inv), /无法调查/)
  // 06098：牌库顶 3 张（06007/06019 是弱点）进手牌，其余移出游戏
  assert.deepEqual(inv.hand, ['06007', '06019'])
  assert.deepEqual(state.removedFromGame, ['06018'])
  // 幂等：同一个 result 再调一次不应重复结算
  encounterRules.afterTest(state, inv, result, api)
  assert.deepEqual(inv.hand, ['06007', '06019'])
  // 换轮重置
  state.round += 1
  assert.equal(encounterRules.canFightEnemy(state, inv, {}), undefined)
  assert.equal(encounterRules.investigationError(state, inv), undefined)
})

test('encounter-rules：威胁区摆脱行动的附加结算（06099 弃牌后 1 伤 1 恐）', () => {
  const state = baseState()
  const inv = state.investigators[0]
  const card = { id: 't1', code: '06099', originalCode: '06099', name: '窥看地下世界' }
  inv.threat.push(card)
  const calls = []
  const api = {
    info: () => {},
    removeThreat: target => { calls.push(['remove', target.id]); return true },
    damage: (seat, n) => calls.push(['damage', seat, n]),
    horror: (seat, n) => calls.push(['horror', seat, n]),
  }
  const moves = encounterRules.encounterActions(state, inv)
  assert.equal(moves.length, 1)
  encounterRules.performEncounterAction(state, inv, moves[0], api)
  assert.deepEqual(calls, [['remove', 't1'], ['damage', 0, 1], ['horror', 0, 1]])
})

test('encounter-rules：共享组的行动/投入限制与属性修正（06084 / 06085 / 06090）', () => {
  const state = baseState()
  const inv = state.investigators[0]
  const weaver = { id: 'e1', code: '06084', originalCode: '06084', name: '灰织蛛', location: 'loc1', exhausted: false }
  state.enemies.push(weaver)
  assert.match(encounterRules.moveError(state, inv), /灰织蛛/)
  weaver.exhausted = true
  assert.equal(encounterRules.moveError(state, inv), undefined)
  // 06085：失败限制写入 scenarioFlags.failRestricts（条目 encounterResolve 与共享 afterTest 同一形状）。
  state.scenarioFlags.failRestricts = { [inv.seat]: { round: state.round, until: 'endOfRound', cannot: ['fight', 'investigate'] } }
  assert.equal(encounterRules.canFightEnemy(state, inv, {}), false)
  assert.match(encounterRules.investigationError(state, inv), /无法调查/)
  // 06090：本轮所选技能 -2
  state.scenarioFlags.whispersOfHypnos = { round: state.round, skills: ['willpower'] }
  assert.equal(encounterRules.statModifier(state, inv, 'willpower'), -2)
  assert.equal(encounterRules.statModifier(state, inv, 'agility'), 0)
})

test('runtime api：preventEnemyReady 写入引擎读点（06092 下一个补给阶段不重整）', () => {
  const state = baseState()
  const api = buildRuntime()(state, [], null)
  const enemy = { id: 'e1', code: '06092', name: '笨拙的古革巨人', exhausted: true }
  assert.equal(api.preventEnemyReady(enemy, 1), true)
  assert.deepEqual(enemy.preventReady, { from: state.round, rounds: 1 })
})

test('encounter-rules：activeInvestigators / playerOrder 按队长座位排序且排除退场者', () => {
  const state = baseState({ campaign: { leadSeat: 1, records: {} } })
  assert.deepEqual(playerOrder(state).map(inv => inv.seat), [1, 0])
  state.investigators[1].defeated = true
  assert.deepEqual(activeInvestigators(state).map(inv => inv.seat), [0])
})

test('encounter-rules：共享钩子键完整（章节 behavior 覆盖时依赖这些键）', () => {
  const hooks = [
    'afterTest', 'canFightEnemy', 'canEvadeEnemy', 'statModifier', 'enemySpawned', 'enemyMoved',
    'enemyDamaged', 'enemyDefeated', 'enemyAttackResolved', 'enemyPhaseEnd', 'mythosEnded',
    'turnBegins', 'turnEnded', 'roundEnded', 'encounterDrawn', 'resolveEncounter',
    'encounterActions', 'performEncounterAction',
  ]
  for (const hook of hooks) assert.equal(typeof encounterRules[hook], 'function', `encounterRules.${hook}`)
  for (const hook of ['enemyCanBeDefeated', 'enemyStatModifier', 'actions', 'performAction', 'enemyPhaseStart']) {
    assert.equal(typeof encounterRules[hook], 'function', `encounterRules.${hook}`)
  }
})

test('encounter-rules：敌人入场按 Swarming 规格放置蜂拥卡（固定值 + 按人数）', () => {
  const placed = []
  const api = {
    info: () => {},
    swarm: {
      place: (host, count, options) => {
        placed.push({ count, options })
        host.swarmCards = Array.from({ length: count }, (_, index) => ({ id: `s${index}`, code: 'spider', defeated: false }))
        return host.swarmCards
      },
    },
  }
  const state = baseState({
    scenario: { id: 'testScenario', enemies: { '06228': { swarming: { kind: 'fixed', value: 2 } } } },
  })
  const enemy = { id: 'e1', code: '06228', name: '土星猫', health: 3, damageTaken: 0 }
  placeSwarmCardsFor(state, enemy, api)
  assert.equal(placed[0].count, 2)
  assert.equal(enemy.swarmCards.length, 2)

  const perInvestigator = baseState({
    scenario: { id: 'testScenario', enemies: { '06145': { swarming: { kind: 'perInvestigator', value: 1, perInvestigator: true } } } },
  })
  const host = { id: 'e2', code: '06145', name: '乌撒之猫', health: 2, damageTaken: 0 }
  placeSwarmCardsFor(perInvestigator, host, api)
  assert.equal(placed[1].count, 2, '2 位调查员 → per_investigator 1 × 2')
})

test('encounter-rules：蜂拥头领清空前不可击败；溢出伤害转给蜂拥卡', () => {
  const enemy = {
    id: 'e1', code: '06145', name: '乌撒之猫', health: 2, damageTaken: 3,
    swarmCards: [
      { id: 's1', code: 'cat1', defeated: false, health: 1 },
      { id: 's2', code: 'cat2', defeated: false, health: 1 },
    ],
  }
  assert.match(swarmBlockedReasonOf(enemy), /蜂拥卡/)
  const state = baseState({ encounterDiscard: [] })
  const removed = []
  const api = {
    info: () => {},
    healEnemy: (target, amount) => { target.damageTaken = Math.max(0, target.damageTaken - amount) },
    swarm: {
      splitDamage: () => ({ toHost: 0, toSwarm: 1, defeatedSwarm: ['s1'], leftover: 0 }),
      remove: (host, id) => {
        removed.push(id)
        const card = host.swarmCards.find(item => item.id === id)
        if (card) card.defeated = true
      },
    },
  }
  const defeated = applySwarmOverflow(state, enemy, api)
  assert.equal(defeated, 1)
  assert.deepEqual(removed, ['s1'])
  assert.equal(enemy.damageTaken, 2, '超出生命的 1 点伤害被撤回')
  assert.deepEqual(state.encounterDiscard, ['cat1'], '被击败的蜂拥卡进遭遇弃牌堆')
  assert.match(swarmBlockedReasonOf(enemy), /1 张蜂拥卡/, '还剩 1 张，仍不可击败')
  enemy.swarmCards[1].defeated = true
  assert.equal(swarmBlockedReasonOf(enemy), null, '清空后可击败')
})

test('encounter-rules：Veiled [fast] 翻面行动与执行（读背面故事卡）', () => {
  const state = baseState()
  const moves = veiledFastActions(state, state.investigators[0])
  assert.equal(moves.length, 1)
  assert.equal(moves[0].fast, true)
  assert.equal(moves[0].actions, 0)
  const logs = []
  const api = {
    info: text => logs.push(text),
    veiled: {
      flip: id => {
        const location = state.locations.find(item => item.id === id)
        location.veiledRevealed = true
        return { changed: true, storyCode: '06119b' }
      },
    },
  }
  assert.equal(performVeiledFlip(state, state.investigators[0], moves[0], api), true)
  assert.equal(state.locations[0].veiledRevealed, true)
  assert.ok(logs.some(text => text.includes('故事正文')), '翻面后要读背面故事卡正文')

  // 有线索时行动仍列出（engine 会按 reason 过滤 legalMoves，但留作 AI 提示），只是带原因。
  const blockedState = baseState()
  blockedState.locations[0].clues = 2
  const blocked = veiledFastActions(blockedState, blockedState.investigators[0])
  assert.equal(blocked.length, 1)
  assert.match(blocked[0].reason, /线索/)
})

test('encounter-rules：牌库耗尽强制由 watchEncounterDeckEmpty 在「有牌变空」时触发一次', () => {
  const state = baseState({ scenarioFlags: {} })
  const calls = []
  const enemy = { id: 'e1', code: '06070', name: '测试敌人' }
  state.enemies.push(enemy)
  // 用条目式 enemyScript 需要条目注册；这里直接验证包装函数在变空时调用 resolveEncounterDeckEmptyForced 的出口。
  const api = { info: () => {}, directHorror: (seat, amount) => calls.push([seat, amount]), test: () => {} }
  state.encounterDeck = ['only']
  const watch = watchEncounterDeckEmpty(state)
  api.discardEncounterTop = () => { state.encounterDeck.pop(); return ['only'] }
  api.discardEncounterTop(1)
  assert.equal(watch(api), true)
  assert.equal(watch(api), false, '第二次不能再触发')
  assert.equal(calls.length, 0, '本测试没有声明强制能力的卡：只验证触发点')
})
