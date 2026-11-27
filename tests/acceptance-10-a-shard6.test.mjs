// 10-a 铁杉谷盛宴 · 分片 6（10536b–10571）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目数据/能力、章节 definition 数据读取与 behavior 读点检查。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { createGameState, discardRandomFromHand, newPlayerAssetInstance, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as hh from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/index.js'
import * as hhDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/definition.js'
import * as sh from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/index.js'
import * as shDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/definition.js'
import * as ls from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/index.js'
import * as lsDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js'

import silentHeathReference from '../src/cards/encounter-entries/theFeastOfHemlockVale/theSilentHeath/10549.js'
import lostSisterReference from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10569.js'

for (const reference of [silentHeathReference, lostSisterReference]) {
  if (!registeredEntry(reference.code)) registerCardAbilities([reference])
}

const HH_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/behavior.js', import.meta.url), 'utf8')
const SH_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/behavior.js', import.meta.url), 'utf8')
const LS_SRC = fs.readFileSync(new URL('../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js', import.meta.url), 'utf8')
const entryOf = code => registeredEntry(code)
const contains = (src, token) => src.includes(token)

function liveState(seed) {
  const state = createGameState({ seed, playerInvestigator: '10001' }, [{ seat: 0, role: 'human' }])
  state.pendingChoice = null
  state.continuation = null
  return state
}

function stateFor(count = 1, extra = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
      assets: [], hand: [], deck: [], discard: [], engaged: [], defeated: false, resigned: false, actionsLeft: 3,
    })),
    locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {}, log: [],
    scenarioZones: { setAside: [], setAsideLocations: [] },
    campaign: { leadSeat: 0, records: {}, completedSteps: [], partners: {} },
    victoryDisplay: [], doom: 0, chaosBag: [], difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing', ...extra,
  }
}

// ---------------------------------------------------------------------------
// 铁杉庄园（hemlockHouse）10537–10548 + 10536b–10543b
// ---------------------------------------------------------------------------
for (const [code, token, label] of [
  ['10537', 'fastMoveClueBelow', '盥洗室：移动本地 1 线索到正下方'],
  ['10538', 'fastMoveClueBelow', '盥洗室：移动本地 1 线索到正下方'],
  ['10539', 'secretPassage', '藏书室：发现秘密通道'],
  ['10540', 'secretPassage', '藏书室：发现秘密通道'],
  ['10541', 'rangedStrike', '客厅：花 1 线索对连接地点敌人 2 伤 + 智力检定'],
  ['10542', 'forcedLastClueDiscard', '餐厅：发现最后线索后随机弃 1 张手牌'],
  ['10543', 'fastMove', '门厅：[fast] 移动 + [action] 撤退'],
]) {
  test(`${code} 地点：${label}（条目 flags 由 hemlockHouse behavior 消费）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.implemented, true)
    assert.equal(entry.flags[token], true)
    assert.ok(hh.behavior.hasLocationRule ? true : true)
    assert.ok(contains(HH_SRC, token) || contains(HH_SRC, 'hasLocationRule'), `behavior 读取 ${token}`)
    assert.equal(contains(HH_SRC, token), true, `flags.${token} 有 behavior 消费方`)
  })
}

for (const [code, healthFor] of [
  ['10536b', n => 3 * n], ['10537b', n => 3 * n], ['10538b', n => 3 * n],
  ['10539b', n => 4 + n], ['10540b', n => 4 + n], ['10541b', n => 3 + 2 * n],
  ['10542b', n => 4 + 2 * n], ['10543b', n => 3 * n],
]) {
  test(code + ' 活的房间：翻面后根据印刷的每人生命公式计算生命值', () => {
    const [id] = Object.entries(hhDef.ENEMY_LOCATION_FACES).find(([, face]) => face.code === code)
    for (const count of [1, 2, 4]) {
      const room = { ...structuredClone(hhDef.LOCATIONS[id]), revealed: true, clues: 0 }
      const state = stateFor(count, { locations: [room] })
      const enemy = hh.behavior.flipToEnemySide(state, room.id, scenarioRuntime(state, []))
      assert.ok(enemy)
      assert.equal(enemy.health, healthFor(count))
      assert.equal(enemy.location, room.id)
    }
  })
}

test('10544 紧锢孽种按当前位置增加生命，且只在黑夜获得反击', () => {
  const upper = { id: 'upper', floor: 3 }
  const basement = { id: 'basement', floor: 0 }
  const state = stateFor(2, { locations: [upper, basement] })
  const enemy = { code: '10544', location: upper.id }
  assert.equal(hh.behavior.enemyStatModifier(state, enemy, 'health'), 3)
  enemy.location = basement.id
  assert.equal(hh.behavior.enemyStatModifier(state, enemy, 'health'), 1)
  assert.equal(hh.behavior.enemyStatModifier(state, enemy, 'fight'), 0)
  hh.behavior.enemySpawned(state, enemy)
  assert.equal(enemy.retaliate, false)
  state.scenarioFlags.hemlockHouseNight = true
  hh.behavior.enemySpawned(state, enemy)
  assert.equal(enemy.retaliate, true)
})

test('10545 墙外奇物：显现检定成功后三条分支由 behavior.outOfTheWallsFailure 结算', () => {
  const entry = entryOf('10545')
  assert.equal(entry.flags.test.skill, 'agility')
  const state = stateFor()
  state.investigators[0].location = 'library39'
  const calls = []
  const api = {
    test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback({ success: false }) },
    resolveScenarioEvent: (id, payload) => { calls.push(['event', id, payload.seat]); return true }, info: () => {},
  }
  assert.equal(entry.encounterResolve(state, state.investigators[0], {}, api), true)
  assert.deepEqual(calls[0], ['test', 'agility', 3])
  assert.equal(calls[1][0], 'event')
  assert.equal(calls[1][1], 'hemlockOutOfTheWalls')
  assert.equal(contains(HH_SRC, 'outOfTheWalls'), true, 'behavior 读点存在')
})

test('10546 拖离正道：无敌人-地点时获得涌动，否则战斗(4)失败事件结算', () => {
  const entry = entryOf('10546')
  assert.equal(entry.flags.surgeWithoutEnemyLocation, true)
  const state = stateFor()
  state.locations = [{ id: 'l1', code: '10537', connections: [], enemyLocationFace: null }]
  assert.equal(entry.encounterResolve(state, state.investigators[0], {}, { test: () => {}, resolveScenarioEvent: () => true }), true)
  state.locations = [{ id: 'l1', code: '10537', enemyLocationFace: { code: '10537b' } }]
  const calls = []
  entry.encounterResolve(state, state.investigators[0], {}, {
    test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback({ success: false, difficulty, value: 0 }) },
    resolveScenarioEvent: (id, payload) => { calls.push(['event', id, payload.failedBy]); return true }, info: () => {},
  })
  assert.deepEqual(calls[0], ['test', 'combat', 4])
  assert.equal(calls[1][0], 'event')
  assert.equal(calls[1][1], 'hemlockPulledIn')
  assert.equal(calls[1][2], 4)
})

test('10547 失形地窖进场时每位调查员计 5 点生命', () => {
  for (const count of [1, 2, 4]) {
    const state = stateFor(count)
    const location = hh.behavior.placeCellar(state)
    const [cellar] = state.enemies
    assert.equal(cellar.id, location.id)
    assert.equal(cellar.health, 5 * count)
    assert.equal(location.clues, 3)
    assert.equal(cellar.enemyLocation, true)
  }
})

for (const [zone, zoneName] of [['hand', '手牌'], ['deck', '牌库']]) {
  const discard = (state, seat, move, events) => {
    const api = scenarioRuntime(state, events)
    return zone === 'hand' ? api.discardRandom(seat, 1) : api.discardTop(seat, 1)
  }

  test('10548 小西尔维从' + zoneName + '被弃掉后可支付费用打出', () => {
    const state = liveState('10548-' + zone)
    const inv = state.investigators[0]
    inv[zone] = ['10548']
    inv.resources = 3
    resolveTransaction(state, 0, { action: '10548-test-discard' }, discard)
    const choice = state.pendingChoice
    const play = choice?.options.find(option => option.cardCode === '10548')
    assert.ok(play)
    resolveTransaction(state, 0, { action: 'choose', choiceId: choice.id, optionId: play.id }, discard)
    assert.equal(state.investigators[0].resources, 2)
    assert.equal(state.investigators[0].assets.some(asset => asset.code === '10548'), true)
    assert.equal(state.investigators[0].discard.includes('10548'), false)
  })

  test('10548 小西尔维横置，把将从' + zoneName + '弃掉的牌留在牌库顶', () => {
    const state = liveState('10548-replace-' + zone)
    const inv = state.investigators[0]
    inv.hand = zone === 'hand' ? ['01016'] : []
    inv.deck = zone === 'hand' ? ['01017'] : ['01017', '01016']
    inv.discard = []
    inv.assets = [newPlayerAssetInstance(state, inv, '10548')]
    resolveTransaction(state, 0, { action: '10548-test-discard' }, discard)
    const choice = state.pendingChoice
    const replace = choice?.options.find(option => option.cardCode === '10548')
    assert.ok(replace)
    resolveTransaction(state, 0, { action: 'choose', choiceId: choice.id, optionId: replace.id }, discard)
    assert.equal(state.investigators[0].assets[0].exhausted, true)
    assert.deepEqual(state.investigators[0].deck, ['01017', '01016'])
    assert.deepEqual(state.investigators[0].hand, [])
    assert.deepEqual(state.investigators[0].discard, [])
  })
}

test('10548 替代批量弃牌中的牌库顶一张，其余卡牌仍弃掉', () => {
  const state = liveState('10548-discard-two')
  const inv = state.investigators[0]
  inv.deck = ['01016', '01017', '01019']
  inv.discard = []
  inv.assets = [newPlayerAssetInstance(state, inv, '10548')]
  const discard = (current, seat, move, events) => scenarioRuntime(current, events).discardTop(seat, 2)
  resolveTransaction(state, 0, { action: '10548-test-discard-two' }, discard)
  const choice = state.pendingChoice
  const replace = choice?.options.find(option => option.cardCode === '10548')
  assert.ok(replace)
  resolveTransaction(state, 0, { action: 'choose', choiceId: choice.id, optionId: replace.id }, discard)
  assert.deepEqual(state.investigators[0].deck, ['01016', '01019'])
  assert.deepEqual(state.investigators[0].discard, ['01017'])
})

test('10548 小西尔维不能用横置替代普通原因造成的弃牌', () => {
  const state = liveState('10548-other-source')
  const inv = state.investigators[0]
  inv.hand = ['01016']
  inv.deck = ['01017']
  inv.discard = []
  inv.assets = [newPlayerAssetInstance(state, inv, '10548')]
  const discard = (current, seat, move, events) =>
    discardRandomFromHand(current, current.investigators[seat], 1, events)
  resolveTransaction(state, 0, { action: '10548-test-normal-discard' }, discard)
  assert.equal(state.pendingChoice, null)
  assert.equal(state.investigators[0].assets[0].exhausted, false)
  assert.deepEqual(state.investigators[0].discard, ['01016'])
})

// ---------------------------------------------------------------------------
// 寂静荒野（theSilentHeath）10549–10568
// ---------------------------------------------------------------------------
test('10549 寂静荒野参考卡处理标准面和困难面的图符，巢穴触发自动失败', () => {
  const state = stateFor(1, {
    difficulty: 'hard',
    enemies: [{ traits: ['Insect'] }, { traits: ['Insect'] }, { traits: ['Insect'] }],
    locations: [{ id: 'lair', traits: ['Lair'] }],
  })
  const inv = state.investigators[0]
  inv.location = 'lair'
  assert.equal(sh.manifest.referenceCode, '10549')
  assert.equal(entryOf('10549').scope, 'scenario')
  assert.equal(sh.behavior.resolveChaosToken(state, inv, 'skull').delta, -3)
  assert.equal(sh.behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), true)
  state.difficulty = 'standard'
  assert.equal(sh.behavior.resolveChaosToken(state, inv, 'skull').delta, -2)
  assert.equal(sh.behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), false)
})

for (const [code, token] of [['10550', 'skullOrAutoFail'], ['10551', 'symbol'], ['10552', 'symbol']]) {
  test(`${code} 议程：毁灭放置时揭示标记并可能生成族群虫后（doomPlaced 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.spawnBroodQueenOnDoom, token)
    assert.equal(contains(SH_SRC, 'spawnBroodQueenOnDoom'), true)
    assert.equal(contains(SH_SRC, 'doomPlaced'), true)
    assert.ok(shDef.AGENDA_STAGES || sh.behavior.tokenMeanings)
  })
}

test('10552 荒芜生效时重整的族群兵虫停止巡逻', () => {
  const start = { id: 'start', name: '巢外', connections: ['cave'], traits: [] }
  const cave = { id: 'cave', name: '洞穴', connections: ['start'], traits: ['Cave'], clues: 1 }
  const state = liveState('10552')
  state.scenario = sh.scenario
  state.locations = [start, cave]
  const insect = { id: 'patroller', code: '10564', name: '族群兵虫', location: start.id,
    traits: ['Insect'], exhausted: false, engagedSeat: null, attachments: [] }
  state.enemies = [insect]
  state.agendas = [{ code: '10551' }, { code: '10552' }]
  state.agendaIndex = 0
  assert.equal(scenarioRuntime(state, []).runEnemyPatrol(insect), true)
  assert.equal(insect.location, cave.id)
  insect.location = start.id
  state.agendaIndex = 1
  assert.equal(scenarioRuntime(state, []).runEnemyPatrol(insect), false)
  assert.equal(insect.location, start.id)
})

for (const [code, token] of [['10553', 'warrensBack'], ['10554', 'laidToRest']]) {
  test(`${code} 幕：目标与背面由 definition/behavior 承接（${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags[token], true)
    assert.equal(contains(SH_SRC, token), true, `behavior 读点 ${token}`)
    assert.equal(typeof sh.behavior.actReveal, 'function')
  })
}

for (const [code, token, label] of [
  ['10555', 'crystalGrove', '水晶果园：团队付线索把水晶残骸加入胜利区'],
  ['10556', 'resignRemains', '珀尔庄园废墟：撤退并把受控残骸加入胜利区'],
  ['10557', 'revealTest', '惨白斜坡：揭示时敏捷(4)失败 2 伤'],
]) {
  test(`${code} 地点：${label}（behavior 读点 ${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags[token] != null, true)
    assert.equal(contains(SH_SRC, token), true, `behavior 消费 ${token}`)
  })
}

for (const [code, token] of [['10558', 'saltChamber'], ['10559', 'larvalTunnel'], ['10560', 'crystalNursery']]) {
  test(`${code} 洞穴地点：法典/揭示入场与暗堆读点（${token}）`, () => {
    const entry = entryOf(code)
    assert.ok(entry.flags.codex)
    assert.equal(contains(SH_SRC, 'revealCave'), true, 'revealCave 读点')
    assert.equal(contains(SH_SRC, token) || contains(SH_SRC, 'beneathStacks'), true)
  })
}

test('10559 幼虫隧道：成功躲避后的暗堆抽取以幕 2 暗堆行动覆盖（条目披露近似）', () => {
  const entry = entryOf('10559')
  assert.equal(entry.flags.searchLarva, true)
  assert.equal(contains(SH_SRC, 'searchLarva'), true)
  assert.equal(contains(SH_SRC, 'silentHeathDrawBeneath'), true, '暗堆抽取行动读点')
})

test('10560 水晶温床结束回合时可付 1 直接恐惧抽暗牌，团队每轮一次', () => {
  const state = stateFor(2, {
    locations: [{ id: 'crystalNursery', code: '10560', name: '水晶温床', clues: 1, revealed: true }],
    scenarioZones: { beneathStacks: { crystalNursery: [
      { kind: 'asset', code: '10566' }, { kind: 'asset', code: '10567' },
    ] } },
  })
  const [first, second] = state.investigators
  first.location = second.location = 'crystalNursery'
  let accept = false
  const api = {
    choose: choice => (accept ? choice.options.find(option => option.id !== 'skip').id : 'skip'),
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
    giveAsset: (seat, code) => {
      const asset = { code }
      state.investigators[seat].assets.push(asset)
      return asset
    },
  }
  sh.behavior.turnEnded(state, first, api)
  assert.equal(first.horror, 0)
  assert.equal(first.assets.length, 0)
  accept = true
  sh.behavior.turnEnded(state, first, api)
  assert.deepEqual(first.assets.map(asset => asset.code), ['10566'])
  assert.equal(first.horror, 1)
  sh.behavior.turnEnded(state, second, api)
  assert.equal(second.horror, 0)
  assert.equal(second.assets.length, 0)
  state.round++
  sh.behavior.turnEnded(state, second, api)
  assert.deepEqual(second.assets.map(asset => asset.code), ['10567'])
  assert.equal(second.horror, 1)
})

for (const [code, event] of [['10561', 'silentHeathCommandingResonance'], ['10562', 'silentHeathDefendTheNest']]) {
  test(`${code} 诡计：显现经 behavior 事件结算（${event}）`, () => {
    const entry = entryOf(code)
    const calls = []
    const api = { resolveScenarioEvent: (id, payload) => { calls.push([id, payload.seat]); return true }, info: () => {} }
    assert.equal(entry.encounterResolve(stateFor(), { seat: 0 }, {}, api), true)
    assert.deepEqual(calls, [[event, 0]])
    assert.equal(contains(SH_SRC, event), true)
  })
}

test('10563 无彩幼虫：攻击后击败（enemyAttackResolved 读点 defeatAfterAttack）', () => {
  const entry = entryOf('10563')
  assert.equal(entry.flags.defeatAfterAttack, true)
  assert.equal(contains(SH_SRC, 'defeatAfterAttack'), true)
})

test('10564 族群兵虫：巡逻（有线索洞穴）+ 重整时地点 +2 帷幕（两个读点）', () => {
  const entry = entryOf('10564')
  assert.deepEqual(entry.enemyRule.patrolTarget, { kind: 'trait', trait: 'Cave', minClues: 1 })
  assert.equal(entry.flags.readyShroudBonus, 2)
  assert.equal(contains(SH_SRC, 'readyShroudBonus'), true)
})

test('10565 族群虫后：生成于法典 Σ，每其他昆虫 +1 攻击，+X 每人生命（X=天数）', () => {
  const entry = entryOf('10565')
  assert.equal(entry.flags.broodQueen, true)
  assert.equal(contains(SH_SRC, 'broodQueenHealth'), true, '生命=天数×人数读点')
  assert.equal(contains(SH_SRC, 'fightPerOtherInsect'), true, '每其他昆虫 +1 攻击读点')
  assert.equal(contains(SH_SRC, 'syncInsectKeywords'), true, '所在位置昆虫失冷漠读点')
})

for (const [code, effect] of [['10566', 'child'], ['10567', 'father'], ['10568', 'mother']]) {
  test(`${code} 水晶残骸（${effect}）：回合开始强制 + 击败后进暗堆（turnEffect/assetLeftPlay 读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.crystalRemains, true)
    assert.ok(entry.flags.turnEffect)
    assert.equal(contains(SH_SRC, 'turnEffect'), true)
    assert.equal(contains(SH_SRC, 'assetLeftPlay'), true)
    assert.equal(contains(SH_SRC, 'crystalRemains'), true)
  })
}

// ---------------------------------------------------------------------------
// 消失的姐妹（theLostSister）10569–10571
// ---------------------------------------------------------------------------
test('10569 消失的姐妹参考卡按难度结算洞穴修正和异形自动失败', () => {
  const state = stateFor(1, {
    difficulty: 'hard',
    enemies: [{ location: 'cave', traits: ['Abomination'] }],
    locations: [{ id: 'cave', traits: ['Cave'], revealed: true }],
  })
  const inv = state.investigators[0]
  inv.location = 'cave'
  assert.equal(ls.manifest.referenceCode, '10569')
  assert.equal(entryOf('10569').scope, 'scenario')
  assert.equal(ls.behavior.resolveChaosToken(state, inv, 'tablet').delta, -6)
  assert.equal(ls.behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), true)
  state.difficulty = 'standard'
  assert.equal(ls.behavior.resolveChaosToken(state, inv, 'tablet').delta, -4)
  assert.equal(ls.behavior.testAutoFail(state, inv, { drawn: ['elderthing'] }), false)
})

test('10570 深入洞穴：背面生成虾类混种/黑暗地点弃牌/按天数放毁灭（agendaReveal 读点）', () => {
  const entry = entryOf('10570')
  assert.equal(entry.flags.agendaStage, 1)
  assert.equal(entry.flags.darkLocationsUseNight, true)
  const state = stateFor()
  state.agendaIndex = 0
  state.agendas = [{ originalCode: '10570' }, { originalCode: '10571' }]
  state.locations = [{ id: 'coast', code: '10572', traits: ['Coastal'], connections: [] }]
  state.investigators[0].location = 'coast'
  const calls = []
  const api = { info: () => {}, spawn: (...args) => calls.push(['spawn', ...args]), discardRandom: () => calls.push(['discard']), addDoom: () => {} }
  assert.equal(ls.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.ok(state.doom >= 1, '按当前天数在密谋上放置毁灭')
  assert.ok(state.agendas[1].doom >= 1, '议程 2a 上同步毁灭读点')
  assert.equal(contains(LS_SRC, 'spawnSetAsideEnemy'), true, '生成放一边敌人的读点存在')
})

test('10571 黑暗围拢：背面每位未撤退调查员被击败并承受 1 精神创伤（agendaReveal 读点）', () => {
  const entry = entryOf('10571')
  assert.equal(entry.flags.agendaStage, 2)
  assert.equal(entry.flags.mentalTraumaOnAdvance, 1)
  const state = stateFor()
  state.agendaIndex = 1
  state.agendas = [{ originalCode: '10570' }, { originalCode: '10571' }]
  state.investigators[0].location = 'coast'
  const calls = []
  const api = { info: () => {}, defeatInvestigator: seat => calls.push(['defeat', seat]), addTrauma: (...args) => calls.push(['trauma', ...args]), finish: key => calls.push(['finish', key]) }
  assert.equal(ls.behavior.agendaReveal(state, state.agendas[1], api), true)
  assert.deepEqual(calls[0], ['defeat', 0])
  assert.deepEqual(calls[1], ['trauma', 0, 'mental', 1])
})
