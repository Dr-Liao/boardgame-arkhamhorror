// Phase 3 内容来源统一：D1 非玩家卡通道、D3 剧本声明化、D4 战役结果声明化。
//
// 三条线共用同一批判据：
//   · 声明即校验——未知字段/未知目标在构建或结算时抛错，不静默失效；
//   · 读点唯一——敌人/地点的数值与布尔规则只经 entityModifierTotal / entityRuleActive；
//   · 结果可校验——结局写记录必须命中 campaign.recordSchema 且类型一致。

import test from 'node:test'
import assert from 'node:assert/strict'
// 引擎是唯一装配点：import 它才会注册能力条目、注入修正读点（setModifierRegistry/Hooks）。
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry, ABILITY_SCOPES } from '../src/engine/ability.js'
import { entityModifierTotal, entityRuleActive, describeEntityRules } from '../src/engine/modifiers.js'
import { declareScenario, declarationReport } from '../content/scenario-declaration.js'
import { applyResolutionResults, matchesResultCondition, RESULT_EFFECT_KEYS } from '../src/campaign/campaign-effects.js'
import { fixture, move, enemy, settle } from './core-fixture.mjs'

const emptyState = (extra = {}) => ({
  phase: 'investigation', round: 2, currentSeat: 0, actIndex: 0, agendaIndex: 0,
  locations: [], enemies: [], acts: [], agendas: [], victoryDisplay: [], investigators: [],
  scenarioFlags: {}, ...extra,
})

// ---------------------------------------------------------------------------
// D1：非玩家卡通道
// ---------------------------------------------------------------------------

test('D1 注册：非玩家条目的 scope 与玩家卡分开记账', () => {
  assert.ok(ABILITY_SCOPES.includes('enemy') && ABILITY_SCOPES.includes('location'))
  assert.equal(registeredEntry('04086')?.scope, 'enemy')
  assert.equal(registeredEntry('04072')?.scope, 'location')
  assert.equal(registeredEntry('01001')?.scope, 'investigator')
  assert.equal(registeredEntry('01088')?.scope, 'card')
})

test('D1 注册守卫：非玩家卡不能声明玩家侧时机', () => {
  assert.throws(() => registerCardAbilities([{
    code: 'probe-lifecycle', scope: 'enemy', abilities: [{ kind: 'played', effect: { type: 'gainResource', amount: 1 } }],
  }]), /非玩家卡.*不能声明 played/)
  assert.throws(() => registerCardAbilities([{
    code: 'probe-action', scope: 'location', abilities: [{ kind: 'action', label: 'x', resolve: () => {} }],
  }]), /非玩家卡.*不能声明 action/)
  assert.throws(() => registerCardAbilities([{
    code: 'probe-scope', scope: 'nowhere', abilities: [],
  }]), /未知 scope/)
})

test('D1 敌人规则：04086 按幕三正反面切换不能攻击/不能被攻击与 +1', () => {
  const enemy = { id: 'e1', code: '04086', originalCode: '04086', location: 'barrier' }
  const search = emptyState({ scenarioFlags: { actThree: 'search' } })
  assert.equal(entityRuleActive(search, enemy, 'cannot:attack'), true)
  assert.equal(entityRuleActive(search, enemy, 'cannot:beAttacked'), true)
  assert.equal(entityRuleActive(emptyState({ scenarioFlags: { actThree: 'guarded' } }), enemy, 'cannot:attack'), false)
  const guarded = emptyState({ scenarioFlags: { actThree: 'guarded' } })
  assert.equal(entityModifierTotal(guarded, enemy, 'enemyFight'), 1)
  assert.equal(entityModifierTotal(guarded, enemy, 'enemyEvade'), 1)
})

test('D1 地点对敌人的修正：04072 只给此处的蛇族 +1', () => {
  const state = emptyState({ locations: [{ id: 'haven', originalCode: '04072', name: '万蛇据点', revealed: true }] })
  const snake = { id: 'e2', code: '04078', originalCode: '04078', location: 'haven', traits: ['Serpent'] }
  const human = { id: 'e3', code: '04086', originalCode: '04086', location: 'haven', traits: ['Humanoid'] }
  assert.equal(entityModifierTotal(state, snake, 'enemyFight'), 1)
  assert.equal(entityModifierTotal(state, human, 'enemyFight'), 0)
  snake.location = 'elsewhere'
  assert.equal(entityModifierTotal(state, snake, 'enemyFight'), 0)
})

test('D1 地点自身修正：04074 帷幕随胜利区复仇点数', () => {
  const temple = { id: 'temple', originalCode: '04074', code: '04074', revealed: true }
  const state = emptyState({ locations: [temple], victoryDisplay: [{ id: 'v1', vengeance: 2 }, { id: 'v2', vengeance: 1 }] })
  assert.equal(entityModifierTotal(state, temple, 'locationShroud'), 3)
  state.victoryDisplay = []
  assert.equal(entityModifierTotal(state, temple, 'locationShroud'), 0)
})

test('D1 文本空白让卡面规则整体失效', () => {
  const enemy = { id: 'e4', code: '04086', originalCode: '04086', location: 'x' }
  const state = emptyState({ scenarioFlags: { actThree: 'search' } })
  // 引擎注入的 entityBlanked 读 enemy.textBlanked（当前回合/阶段）。
  enemy.textBlanked = { round: state.round, phase: state.phase }
  assert.equal(entityRuleActive(state, enemy, 'cannot:attack'), false)
  assert.deepEqual(describeEntityRules(state, enemy).rules, [])
})

test('D1 未知实体目标在读取时报错，不静默返回 0', () => {
  assert.throws(() => entityModifierTotal(emptyState(), { id: 'e', code: '04072' }, 'skill:combat'), /未知实体修正目标/)
  assert.throws(() => entityRuleActive(emptyState(), { id: 'e', code: '04072' }, 'cannot:fly'), /未知实体规则/)
})

test('D1 引擎接线：敌人卡自己的「被击败时」强制能力由窗口结算', () => {
  // 只在测试里注册的探针条目：不进入任何关卡内容。
  registerCardAbilities([{
    code: 'probeForcedEnemy',
    name: '探针敌人',
    scope: 'enemy',
    abilities: [{
      kind: 'forced', trigger: 'defeatEnemy', label: '被击败时点燃探针',
      resolve: ({ state }) => { state.scenarioFlags.probeForced = (state.scenarioFlags.probeForced || 0) + 1 },
    }],
  }])
  const state = fixture()
  state.enemies = []
  const probe = enemy(state, { code: 'probeForcedEnemy', fight: 0, evade: 0, health: 1, damageTaken: 0 })
  move(state, { action: 'fight', enemyId: probe.id })
  settle(state)
  assert.equal(state.scenarioFlags.probeForced, 1, '敌人被击败后它的卡面强制能力结算一次')
  assert.ok(!state.enemies.some(item => item.id === probe.id), '敌人已离场')
})

// ---------------------------------------------------------------------------
// D3：剧本声明化
// ---------------------------------------------------------------------------

const setupApi = seed => {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  const calls = []
  return {
    calls,
    randomValue,
    shuffle: (list, random) => {
      const copy = [...list]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
    spawnEnemy: (state, code, location) => {
      calls.push({ kind: 'spawn', code, location })
      return { id: `e${calls.length}`, code, name: code, location }
    },
    locName: (state, id) => id,
    removeCardByCode: (deck, code) => {
      const index = deck.indexOf(code)
      if (index < 0) return false
      deck.splice(index, 1)
      return true
    },
    info: (state, events, text) => calls.push({ kind: 'info', text }),
  }
}

test('D3 布置声明：起始地点/地点清单/敌人/遭遇牌库都能由数据驱动', () => {
  const behavior = declareScenario({
    id: 'probe',
    setup: {
      startLocation: { record: 'burned', then: 'ruins', else: 'home' },
      locations: { all: true, exceptIf: { record: 'burned', ids: ['home'] } },
      enemies: [{ code: 'cultist', count: 'investigators-1', at: ['a', 'b', 'c'] }],
      deck: { removeSpawnedEnemies: true },
    },
    data: { roundEndActIndex: 1 },
    hooks: { describe: () => ['probe'] },
  })
  const state = emptyState({
    numInvestigators: 3,
    campaign: { records: { burned: true } },
    scenario: { locations: { home: {}, ruins: {}, a: {}, b: {}, c: {} } },
  })
  assert.equal(behavior.startLocation(state), 'ruins')
  const ids = behavior.setupLocations(state, [], setupApi(1))
  assert.deepEqual(ids, ['ruins', 'a', 'b', 'c'], '记录为真时排除 home')
  const api = setupApi(1)
  state.enemies = [{ code: 'cultist' }]
  behavior.setupEnemies(state, [], api)
  assert.deepEqual(api.calls.filter(call => call.kind === 'spawn').map(call => call.location), ['a', 'b'])
  const deck = behavior.modifyDeck(state, ['cultist', 'other'], [], api)
  assert.deepEqual(deck, ['other'], '开局敌人从遭遇牌库移除')
  assert.equal(behavior.roundEndActIndex, 1)
  assert.deepEqual(declarationReport(behavior).hooks, ['describe'])
})

test('D3 声明守卫：未知字段/重复定义/非法起始地点都立即失败', () => {
  assert.throws(() => declareScenario({ id: 'bad', setup: { nowhere: [] } }), /未知字段 nowhere/)
  assert.throws(() => declareScenario({ id: 'bad', setup: { locations: ['a'] }, hooks: { setupLocations: () => [] } }),
    /由 setup 声明生成/)
  assert.throws(() => declareScenario({ id: 'bad', setup: { startLocation: 42 } }), /startLocation/)
  assert.throws(() => declareScenario({ id: 'bad', oops: 1 }), /未知字段 oops/)
})

test('D3 随机变体与随机池：同种子可复现', () => {
  const behavior = declareScenario({
    id: 'probe-pool',
    setup: { locations: { pool: 'woodsPool', count: 3, first: 'mainPath', variants: true } },
  })
  const make = () => {
    const state = emptyState({
      scenario: {
        woodsPool: ['w1', 'w2', 'w3', 'w4', 'w5'],
        locations: { w1: {}, w2: {}, w3: {}, w4: {}, w5: {}, mainPath: {} },
        locationVariants: { w1: [{ name: 'v1' }, { name: 'v2' }] },
      },
    })
    return { state, picks: behavior.setupLocations(state, [], setupApi(7)) }
  }
  const first = make()
  const second = make()
  assert.deepEqual(first.picks, second.picks)
  assert.equal(first.picks[0], 'mainPath')
  assert.equal(first.picks.length, 4)
  assert.equal(first.state.locationVariants.w1.name, second.state.locationVariants.w1.name)
})

// ---------------------------------------------------------------------------
// D4：战役结果声明化
// ---------------------------------------------------------------------------

const campaignState = () => {
  const state = emptyState({
    resolution: 'r1',
    campaign: {
      id: 'probeCampaign', leadSeat: 0, failed: false,
      recordSchema: { burned: 'boolean', escaped: 'string[]', sacrifices: 'number' },
      records: { burned: false, escaped: [], sacrifices: 0 },
      trauma: { 0: { physical: 0, mental: 0 }, 1: { physical: 0, mental: 0 } },
      investigators: {
        0: { seat: 0, id: 'a', name: '甲', code: '01001', status: 'active', xp: 0, earnedXp: 0, deck: [] },
        1: { seat: 1, id: 'b', name: '乙', code: '01002', status: 'active', xp: 0, earnedXp: 0, deck: [] },
      },
      xp: 0, chaosBag: [], flow: { nodeId: 'probe' },
    },
  })
  state.investigators = [
    { seat: 0, name: '甲', resigned: false, defeated: false, threat: [], assets: [] },
    { seat: 1, name: '乙', resigned: true, defeated: false, threat: [], assets: [] },
  ]
  return state
}

test('D4 条件：resolution / record / all / any / not 都是纯数据', () => {
  const state = campaignState()
  assert.equal(matchesResultCondition(state, { resolution: 'r1' }), true)
  assert.equal(matchesResultCondition(state, { resolutionIn: ['r2', 'r3'] }), false)
  assert.equal(matchesResultCondition(state, { record: 'burned', equals: false }), true)
  assert.equal(matchesResultCondition(state, { not: { resolution: 'r1' } }), false)
  assert.equal(matchesResultCondition(state, { all: [{ resolution: 'r1' }, { failed: false }] }), true)
  assert.equal(matchesResultCondition(state, { any: [{ resolution: 'r9' }, { failed: false }] }), true)
})

test('D4 结算：记录/集合/创伤/经验/状态/失败都按声明执行', () => {
  const state = campaignState()
  const applied = applyResolutionResults(state, [
    { record: { burned: true }, when: { resolution: 'r1' } },
    { record: { burned: false }, when: { resolution: 'r2' } },
    { recordUnion: { escaped: ['a'] } },
    { recordUnion: { escaped: ['a', 'b'] } },
    { recordRemove: { escaped: ['a'] } },
    { trauma: { lead: { mental: 1 } } },
    { trauma: { all: { physical: 1 } }, when: { not: { resolution: 'r1' } } },
    { xp: { amount: 2, targets: 'active' } },
    { investigatorStatus: 'killed', targets: 'notResigned' },
    { failed: true },
  ], { log: () => {} })
  assert.equal(applied, 8, '条件不满足的条目整体跳过')
  assert.equal(state.campaign.records.burned, true)
  assert.deepEqual(state.campaign.records.escaped, ['b'])
  assert.equal(state.campaign.trauma[0].mental, 1)
  assert.equal(state.campaign.trauma[1].physical, 0, '未通过的条目不给创伤')
  assert.equal(state.campaign.investigators[0].xp, 2)
  assert.equal(state.campaign.investigators[1].xp, 2, 'xp targets 按战役记录状态取 active')
  assert.equal(state.campaign.investigators[0].status, 'killed')
  assert.equal(state.campaign.investigators[1].status, 'active', '已撤退者不被改写')
  assert.equal(state.campaign.failed, true)
})

test('D4 校验：未知字段、未声明记录与类型不符都立即失败', () => {
  const state = campaignState()
  assert.throws(() => applyResolutionResults(state, [{ oops: 1 }]), /未知字段 oops/)
  assert.throws(() => applyResolutionResults(state, [{ record: { unknownKey: true } }]), /未声明战役记录 unknownKey/)
  assert.throws(() => applyResolutionResults(state, [{ record: { burned: 'yes' } }]), /类型应为 boolean/)
  assert.throws(() => applyResolutionResults(state, { not: 'array' }), /必须是数组/)
  assert.ok(RESULT_EFFECT_KEYS.includes('trauma') && RESULT_EFFECT_KEYS.includes('xp'))
})
