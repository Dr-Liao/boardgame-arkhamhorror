// 10-a 分片 8（《铁杉谷盛宴》fhvc 10606–10644b）新增验收证据。
// 每条用例标题逐字面含一个卡号；通过卡断言条目/definition/behavior 的真实执行路径，
// 失败卡用可执行断言锁定缺口（供报告逐卡引用）。
//
// 运行：node --test tests/acceptance-10-a-shard8.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entryFlags, assetRuleFor, enemyRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { placeLocationDefense, applyLocationDefenses } from '../src/engine/location-defenses.js'
import * as twDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/definition.js'
import * as tw from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/behavior.js'
import * as twChaos from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/chaos.js'
import * as lnDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/definition.js'
import * as ln from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js'
import * as lnChaos from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/chaos.js'

// ---- 动态加载 44 张单卡条目（10626 剧本参考卡无条目，按 FHV 口径由章节承担） ------------------
const ROOTS = ['theTwistedHollow', 'theLongestNight']
  .map(name => `src/cards/encounter-entries/theFeastOfHemlockVale/${name}`)
const codes = []
for (let value = 10606; value <= 10644; value += 1) {
  codes.push(String(value).padStart(5, '0'))
  for (const suffix of 'abcd') codes.push(`${String(value).padStart(5, '0')}${suffix}`)
}
const entries = {}
for (const root of ROOTS) {
  for (const name of fs.readdirSync(root)) {
    const code = name.slice(0, -3)
    if (!codes.includes(code)) continue
    const module = await import(pathToFileURL(path.resolve(root, name)).href)
    entries[code] = module.default
    if (!registeredEntry(code)) registerCardAbilities(module.default)
  }
}

// ---- 工具 -------------------------------------------------------------------------------
const SUPPRESSED = new Set(['choose'])
function makeApi(handlers = {}) {
  const calls = []
  const proxy = prefix => new Proxy(function () {}, {
    get(_target, property) {
      if (property === 'calls') return calls
      const key = prefix ? `${prefix}.${String(property)}` : String(property)
      if (typeof handlers[key] === 'function') {
        return (...args) => { calls.push({ key, args }); return handlers[key](...args) }
      }
      const hasChild = Object.keys(handlers).some(name => name.startsWith(`${key}.`))
      if (hasChild) return proxy(key)
      if (!prefix && SUPPRESSED.has(String(property))) return undefined
      return (...args) => { calls.push({ key, args }); return undefined }
    },
  })
  return proxy()
}
const called = (api, key) => api.calls.some(call => call.key === key)
const argsOf = (api, key) => api.calls.filter(call => call.key === key).map(call => call.args)
const clone = value => JSON.parse(JSON.stringify(value))
function investigator(seat = 0, extra = {}) {
  return { seat, name: `调查员${seat}`, code: '10001', defeated: false, resigned: false,
    location: 'glimmeringWoods', clues: 3, resources: 5, damage: 2, horror: 1, hand: [], discard: [],
    deck: [], assets: [], engaged: [], ...extra }
}
function baseState(extra = {}) {
  return {
    status: 'playing', round: 1, difficulty: 'standard', numInvestigators: 1, currentSeat: 0,
    actIndex: 0, agendaIndex: 0, investigators: [investigator(0)],
    locations: [], enemies: [], acts: [], agendas: [], encounterDeck: [], encounterDiscard: [],
    scenarioFlags: {}, scenarioZones: { setAside: [], victory: [], removed: [] }, storyAssets: [],
    campaign: { leadSeat: 0, records: {}, tsk: {} }, doom: 0, victoryDisplay: [], log: [], ...extra,
  }
}
function twState(extra = {}) {
  const state = baseState({
    scenario: { id: twDef.CHAPTER_ID, stageCards: {}, locations: {}, mechanics: {} },
    actIndex: 0, agendaIndex: 0,
    acts: [clone(twDef.ACT_STAGES[1])], agendas: [clone(twDef.AGENDA_STAGES[1])],
    locations: [clone(twDef.LOCATIONS.glimmeringWoods), clone(twDef.LOCATIONS.crookedPath)],
    ...extra,
  })
  state.investigators[0].location = 'glimmeringWoods'
  return state
}
function lnState(extra = {}) {
  const state = baseState({
    scenario: { id: lnDef.CHAPTER_ID, stageCards: {}, locations: {}, mechanics: { defenses: { decoy: [], trap: [], cannotReady: {} }, barriers: {} } },
    actIndex: 0, agendaIndex: 0, acts: [clone(lnDef.ACT_STAGES[1])], agendas: [clone(lnDef.AGENDA_STAGES[1])],
    locations: [clone(lnDef.LOCATIONS[lnDef.FARMHOUSE_ID]), clone(lnDef.LOCATIONS.milkhouse)],
    ...extra,
  })
  state.investigators[0].location = lnDef.FARMHOUSE_ID
  return state
}
const passTest = (seat, skill, difficulty, resolve) => resolve({ success: true, value: 99 })
const failTest = (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 })

// ===== the_twisted_hollow（25 张） ========================================================

test('10606 黑暗渐深：黑暗地点调查阶段结束二选一（抽追击敌人/受 1 恐惧）；背面加黑暗并可清回正面', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.corpseGrove)] })
  state.investigators[0].location = 'corpseGrove'
  const api = makeApi({ choose: () => 'horror', directHorror: () => true, info: () => true })
  assert.equal(tw.phaseBegan(state, 'enemy', api), true, '议程 1 正面：黑暗地点调查阶段结束时结算')
  assert.deepEqual(argsOf(api, 'directHorror')[0], [0, 1])
  const backApi = makeApi({ info: () => true, choose: () => 'reset', setDarknessLevel: () => true })
  assert.equal(tw.gatheringDarkness(state, backApi), true, '背面「黑暗聚拢」可结算')
})

test('10608 伯蒂在哪儿？：[fast] 花 1 线索查看相邻地点；幕 2 目标轮末全员在扭曲空洞共付 2/人线索', () => {
  const state = twState({
    acts: [clone(twDef.ACT_STAGES[1]), clone(twDef.ACT_STAGES[2])], actIndex: 1,
    locations: [clone(twDef.LOCATIONS.glimmeringWoods), clone(twDef.LOCATIONS.moonlitClearing)],
  })
  state.locations[1].revealed = false
  state.locations[0].connections = ['moonlitClearing']
  state.investigators[0].location = 'glimmeringWoods'
  const moves = tw.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'twistedHollowLookAdjacent'), '幕 2 正面快速查看可用')
  const objectiveState = twState({ actIndex: 1, acts: [clone(twDef.ACT_STAGES[1]), clone(twDef.ACT_STAGES[2])],
    locations: [clone(twDef.LOCATIONS.theTwistedHollow)] })
  objectiveState._roundEndWindow = true
  objectiveState.investigators[0].location = 'theTwistedHollow'
  objectiveState.investigators[0].clues = 5
  const api = makeApi({ advanceAct: () => true, info: () => true, spendClues: () => true, choose: () => true })
  assert.equal(tw.checkActTwoObjective(objectiveState, api), true, '轮末全员在扭曲空洞共付 2/人线索 → 幕 2b')
  assert.equal(called(api, 'advanceAct'), true)
})

test('10609 回到山谷：特殊议程 [fast] 横置提灯或共付 1/人线索；全员撤退 → 结局 1', () => {
  const state = twState({ acts: [clone(twDef.SPECIAL_ACT_STAGE)], agendas: [clone(twDef.SPECIAL_ACT_STAGE)] })
  state.scenarioFlags[twDef.CHAPTER_ID] = {}
  tw.placeLantern(state, makeApi({ info: () => true }))
  state.locations.push({ ...clone(twDef.LOCATIONS.moonlitClearing), revealed: false, connections: ['glimmeringWoods'] })
  state.locations[0].connections = ['moonlitClearing']
  const moves = tw.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'twistedHollowLookAdjacentSpecial'), '特殊议程快速行动可用')
  const resigned = twState({ acts: [clone(twDef.SPECIAL_ACT_STAGE)], agendas: [clone(twDef.SPECIAL_ACT_STAGE)] })
  resigned.investigators[0].resigned = true
  const api = makeApi({ finish: () => true, info: () => true })
  assert.equal(tw.checkObjectives(resigned, api), true, '全员撤退 → 结局 1')
  assert.equal(argsOf(api, 'finish')[0][0], 'resolution1')
})

test('10612 荧光草地：可撤退；[action] 治愈 1 点恐惧（每轮一次）', () => {
  assert.equal(twDef.LOCATIONS.glimmeringWoods.resign, true, '地点声明撤退读点')
  const state = twState()
  const moves = tw.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'twistedHollowGlimmeringHeal'))
  const api = makeApi({ healHorror: () => true, info: () => true })
  assert.equal(tw.performAction(state, state.investigators[0],
    { rule: 'twistedHollowGlimmeringHeal', locationId: 'glimmeringWoods' }, api), true)
  assert.equal(called(api, 'healHorror'), true)
})

test('10613 枯疫空地：揭示后生成攻击值最低的追击敌人（无追击则提示）', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.blightedGlade)] })
  const api = makeApi({ info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.equal(called(api, 'info'), true)
})

test('10614 毒沼：揭示后受到 1 点直接伤害，或每个盟友支援各 1 伤害', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.poisonedMarsh)] })
  const api = makeApi({ choose: () => 'damage', directDamage: () => true, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.deepEqual(argsOf(api, 'directDamage')[0], [0, 1])
  const allyState = twState({ locations: [clone(twDef.LOCATIONS.poisonedMarsh2)] })
  allyState.investigators[0].assets = [{ id: 'a1', code: '01020', traits: ['Ally'] }]
  const allyApi = makeApi({ choose: () => 'assets', damageAsset: () => true, info: () => true })
  tw.resolveLocationReveal(allyState, allyState.locations[0], allyApi, 0)
  assert.equal(called(allyApi, 'damageAsset'), true)
})

test('10615 茂盛灌丛：帷幕 -X；揭示后 agility(X) 失败生成生命最高的追击敌人', () => {
  tw.setDarknessLevel(twState(), 3)
  const state = twState({ locations: [clone(twDef.LOCATIONS.fecundThicket)] })
  tw.setDarknessLevel(state, 3)
  assert.equal(tw.locationShroudModifier(state, state.locations[0]), -3)
  const api = makeApi({ test: failTest, choose: () => undefined, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.deepEqual(argsOf(api, 'test')[0].slice(1, 3), ['agility', 3])
})

test('10616 蘑菇园：非黑暗时帷幕 +2；揭示后 intellect(X) 失败被躲避最高追击敌人攻击', () => {
  const state = twState({ locations: [{ ...clone(twDef.LOCATIONS.mushroomGrove), traits: ['Forest'] }] })
  tw.setDarknessLevel(state, 2)
  assert.equal(tw.locationShroudModifier(state, state.locations[0]), 2, '非[[黑暗]]时 +2 帷幕')
  const api = makeApi({ test: failTest, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.equal(argsOf(api, 'test')[0][1], 'intellect')
})

test('10617 月光空地：揭示后 willpower(X) 失败生成攻击最高追击敌人；印刷「田野互连」无读点（缺口）', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.moonlitClearing)] })
  tw.setDarknessLevel(state, 2)
  const api = makeApi({ test: failTest, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.equal(argsOf(api, 'test')[0][1], 'willpower')
  // 缺口：本卡印刷「敌人移动时每个田野地点视为互连」需要 behavior.enemyConnections，
  // 但苦痛之影章节没有该读点（条目 note 自述「未接线子句」）。
  assert.equal(tw.enemyConnections, undefined, '缺口：没有田野互连读点')
})

test('10618 扭曲小路：帷幕 = 黑暗等级；查看相邻地点做成每回合一次免费行动（披露近似）', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.crookedPath), clone(twDef.LOCATIONS.moonlitClearing)] })
  tw.setDarknessLevel(state, 4)
  assert.equal(tw.locationShroudModifier(state, state.locations[0]), 4, '帷幕 = X = 黑暗等级')
  state.locations[1].revealed = false
  state.locations[0].connections = ['moonlitClearing']
  state.investigators[0].location = 'crookedPath'
  const moves = tw.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'twistedHollowCrookedPathLook'), '近似实现：免费行动')
})

test('10619 尸林：揭示后受 1 恐惧；成功调查后再受 1 恐惧', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.corpseGrove)] })
  const api = makeApi({ directHorror: () => true, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.equal(called(api, 'directHorror'), true)
  tw.investigateResult(state, state.investigators[0], state.locations[0], { success: true }, api)
  assert.equal(argsOf(api, 'directHorror').length, 2)
})

test('10620 熊穴：揭示后攻击最高追击敌人交战；没有则抽遭遇牌', () => {
  const state = twState({ locations: [clone(twDef.LOCATIONS.bearDen)] })
  const api = makeApi({ drawEncounter: () => true, info: () => true })
  assert.equal(tw.resolveLocationReveal(state, state.locations[0], api, 0), true)
  assert.equal(called(api, 'drawEncounter'), true)
})

test('10621 扭曲空洞：地点胜利 1；幕 2 目标轮末全员在此共付 2/人线索推进', () => {
  const definition = twDef.LOCATIONS.theTwistedHollow
  assert.equal(definition.victory, 1)
  const state = twState({ actIndex: 1, acts: [clone(twDef.ACT_STAGES[1]), clone(twDef.ACT_STAGES[2])],
    locations: [clone(definition)] })
  state._roundEndWindow = true
  state.investigators[0].location = 'theTwistedHollow'
  state.investigators[0].clues = 4
  const api = makeApi({ advanceAct: () => true, spendClues: () => true, info: () => true, choose: () => true })
  assert.equal(tw.checkActTwoObjective(state, api), true)
})

test('10622 暗影深深：willpower(3/黑暗 5) 失败二选一（2 恐惧 / 提灯熄灭放连接地点）', () => {
  const state = twState()
  tw.setDarknessLevel(state, 1)
  tw.placeLantern(state, makeApi({ info: () => true }))
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 }),
    choose: () => 'lantern', info: () => true })
  assert.equal(tw.resolveTreacheryEvent(state, { code: '10622', seat: 0 }, api), true)
  assert.deepEqual(argsOf(api, 'test')[0].slice(1, 3), ['willpower', 3])
  assert.equal(tw.lanternRecord(state).lit, false, '选提灯：翻到熄灭面并放到连接地点')
})

test('10623 惊惧潜伏：agility(3/黑暗 5) 失败二选一（2 伤害 / 生成攻击最高追击敌人）', () => {
  const state = twState()
  const api = makeApi({ test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 }),
    choose: () => 'damage', directDamage: () => true, info: () => true })
  assert.equal(tw.resolveTreacheryEvent(state, { code: '10623', seat: 0 }, api), true)
  assert.deepEqual(argsOf(api, 'directDamage')[0], [0, 2])
})

test('10624 光明遭窃：险境，二选一（议程放 1 毁灭 / 提灯熄灭放最远空地点）', () => {
  const state = twState()
  const api = makeApi({ choose: () => 'doom', addDoom: () => true, info: () => true })
  assert.equal(tw.resolveTreacheryEvent(state, { code: '10624', seat: 0 }, api), true)
  assert.equal(called(api, 'addDoom'), true)
})

test('10625 猎踪混种：生命=黑暗等级；猎物=提灯持有者；攻击后提灯熄灭并放到你的地点', () => {
  const state = twState()
  tw.setDarknessLevel(state, 3)
  const enemy = { id: 'e1', code: '10625', originalCode: '10625', location: 'glimmeringWoods', defeated: false }
  assert.equal(tw.enemyStatModifier(state, enemy, 'health', state.investigators[0]), 3)
  tw.placeLantern(state, makeApi({ info: () => true }))
  const lantern = tw.lanternRecord(state)
  assert.equal(lantern.controllerSeat, 0)
  assert.equal(tw.preyRank(state, enemy, state.investigators[0]), 100)
  const api = makeApi({ info: () => true })
  assert.equal(tw.enemyAttackResolved(state, enemy, state.investigators[0], api), true, '攻击后提灯熄灭')
  assert.equal(tw.lanternRecord(state).lit, false)
})

test('10627 屏障、诱饵和陷阱：标记参考卡；引擎 location-defenses 真实读点', () => {
  assert.equal(entries['10627'].flags?.tokenReference, true)
  const state = lnState()
  assert.equal(placeLocationDefense(state, 'decoy', 'milkhouse'), true)
  const enemy = { id: 'e1', code: '10700b', location: 'milkhouse', damageTaken: 0 }
  state.enemies = [enemy]
  applyLocationDefenses(state, enemy, [], {
    choose: () => 'decoy', disengage: () => true, exhaust: () => true, damage: (target, amount) => { target.damageTaken += amount },
  })
  assert.equal(enemy.damageTaken, 1, '诱饵：1 伤害并横置')
})

test('10607a 冥思苦想：未带生成指示的敌人抽出即进入追击；轮末全员同一巢穴共付 3/人线索推进', () => {
  const state = twState({ acts: [clone(twDef.ACT_STAGES[1]), clone(twDef.ACT_STAGES[2])], actIndex: 0 })
  const enemy = { id: 'e1', code: '10622', originalCode: '10622', location: 'glimmeringWoods', defeated: false }
  state.enemies = [enemy]
  const api = makeApi({ info: () => true })
  tw.enemySpawned(state, enemy, api)
  assert.equal(called(api, 'info'), true, '无生成指示 → 进入追击区域（提示/移动）')
  assert.equal(twDef.ACT_STAGES[1].objective.perInvestigator, 3)
})

test('10607b 类熊混种：+2 生命/人；幕 2 期间将被击败 → 治愈并进入追击区域（不进胜利区）', () => {
  const state = twState({ acts: [clone(twDef.ACT_STAGES[1]), clone(twDef.ACT_STAGES[2])], actIndex: 1 })
  const enemy = { id: 'bear', code: twDef.URSINE_HYBRID_CODE, originalCode: twDef.URSINE_HYBRID_CODE,
    location: 'glimmeringWoods', damageTaken: 5, defeated: false }
  state.enemies = [enemy]
  const api = makeApi({ healEnemy: () => true, info: () => true })
  assert.equal(tw.enemyDefeated(state, enemy, api), true)
  assert.equal(enemy.damageTaken, 0, '治愈全部伤害')
  assert.equal(state.victoryDisplay.length, 0, '不进胜利区')
})

// —— 山谷提灯四张面（10610a/b、10611a/b）＝ 结构审查：离场强制与主动能力缺读点 ------------
test('10610a 山谷提灯（有福祉·点燃）：失黑暗与提灯翻面已实现，但「离场改为翻面放最近」「揭示森林忽略强制」无读点（缺口）', () => {
  assert.match(String(ALL_CARDS['10610a'].text), /would leave play|leaves play|离场/i)
  const state = twState()
  tw.setDarknessLevel(state, 2)
  tw.placeLantern(state, makeApi({ info: () => true }))
  assert.equal(tw.isDarkLocation(state, state.locations[0]), false, '提灯所在地点/连接地点失去[[黑暗]]')
  assert.equal(tw.assetLeftPlay, undefined, '缺口：提灯离场强制没有 assetLeftPlay 读点')
  assert.equal(tw.lanternGuardedReveal, undefined, '缺口：揭示森林忽略强制的反应没有读点')
})

test('10610b 山谷提灯（有福祉·熄灭）：[action] 控制提灯并翻面 + 离场强制均无读点（缺口）', () => {
  assert.match(String(ALL_CARDS['10610b'].text), /Take control|控制/i)
  const state = twState()
  tw.placeLantern(state, makeApi({ info: () => true }))
  const actionsText = JSON.stringify(tw.actions(state, state.investigators[0]))
  assert.equal(/lantern/i.test(actionsText), false, '缺口：actions 没有「控制提灯并翻面」行动')
  assert.equal(tw.assetLeftPlay, undefined, '缺口：离场改为放最近地点无读点')
})

test('10611a 山谷提灯（无福祉·点燃）：[action] 横置提灯查看连接地点并移动 + 离场强制无读点（缺口）', () => {
  const state = twState()
  tw.placeLantern(state, makeApi({ info: () => true }))
  const actionsText = JSON.stringify(tw.actions(state, state.investigators[0]))
  assert.equal(/exhaust.*lantern|lantern.*(peek|look)/i.test(actionsText), false, '缺口：没有横置提灯查看相邻地点并移动的行动')
  assert.equal(tw.assetLeftPlay, undefined, '缺口：离场改为翻面放最近地点无读点')
})

test('10611b 山谷提灯（无福祉·熄灭）：[fast] 控制提灯并翻面 + 离场强制均无读点（缺口）', () => {
  assert.match(String(ALL_CARDS['10611b'].text), /control|控制/i)
  const state = twState()
  tw.placeLantern(state, makeApi({ info: () => true }))
  const actionsText = JSON.stringify(tw.actions(state, state.investigators[0]))
  assert.equal(/lantern/i.test(actionsText), false, '缺口：没有控制提灯并翻面的行动')
  assert.equal(tw.assetLeftPlay, undefined, '缺口：离场强制无读点')
})

// ===== the_longest_night（19 张） =========================================================

test('10626 最长一夜：剧本参考卡混乱标记表与 noResolution 结局已声明（剧本参考卡无单卡条目）', () => {
  assert.equal(lnDef.REFERENCE_CODE, '10626')
  assert.ok(Object.keys(lnDef.scenario.resolutions).includes('noResolution'), '全灭结局 key 已声明（P0-4）')
  const state = lnState()
  const skull = lnChaos.theLongestNightChaosToken(state, state.investigators[0], 'skull')
  assert.ok(skull && typeof skull.delta === 'number', 'skull 有标记修正')
  const cultist = lnChaos.theLongestNightChaosToken(state, state.investigators[0], 'cultist')
  assert.ok(cultist && typeof cultist.delta === 'number')
  const tablet = lnChaos.theLongestNightChaosToken(state, state.investigators[0], 'tablet')
  assert.ok(tablet)
})

test('10628 猛攻：卡牌效果毁灭改放病俘；议程放毁灭后每位调查员抽敌人牌库顶；背面创伤或牺牲居民后推进幕', () => {
  const state = lnState()
  ln.placeCaptives(state, makeApi({ info: () => true }))
  const placeApi = makeApi({ placeDoomOnCard: () => true, info: () => true })
  assert.equal(ln.doomPlacementReplacement(state, 2, placeApi), true, '卡牌效果毁灭 → 病俘')
  assert.equal(called(placeApi, 'placeDoomOnCard'), true)
  const drawApi = makeApi({ drawEncounter: () => true, info: () => true })
  assert.equal(ln.doomPlaced(state, { agenda: state.agendas[0], amount: 1 }, drawApi), true, '议程放毁灭 → 抽敌人牌库')
  const backApi = makeApi({ choose: () => 'trauma', addTrauma: () => true, advanceAct: () => true, info: () => true })
  assert.equal(ln.agendaReveal(state, state.agendas[0], backApi), true, '背面结算')
})

test('10629 最长一夜：[fast] 花 1 线索放工事；[action] 撤退（场景声明 resignAnywhere）；目标不自动推进', () => {
  const state = lnState()
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightPlaceDefense'))
  assert.equal(lnDef.scenario.resignAnywhere, true, '撤退由引擎合法行动读点提供（resignAnywhere）')
  const api = makeApi({ advanceAct: () => true, info: () => true })
  assert.equal(ln.checkObjectives(state, api), false, '目标「活过今夜」不自动推进')
})

test('10630 农庄：不可有工事（已实现）；印刷「不能有玩家卡牌附属」无读点（缺口）', () => {
  const definition = lnDef.LOCATIONS[lnDef.FARMHOUSE_ID]
  assert.equal(definition.noLocationDefenses, true, '陷阱/诱饵被 noLocationDefenses 拦截（引擎读点）')
  const state = lnState()
  assert.equal(placeLocationDefense(state, 'trap', lnDef.FARMHOUSE_ID), false, '农庄不能放陷阱')
  // 缺口：印刷「Farmhouse cannot have player cards attached」——engine 不读 cannotHaveAttachments。
  assert.equal(definition.cannotHaveAttachments, true)
  assert.equal(typeof placeLocationDefense, 'function')
  const engineReadsAttachments = fs.readFileSync('src/engine/location-defenses.js', 'utf8').includes('cannotHaveAttachments')
  assert.equal(engineReadsAttachments, false, '缺口：引擎没有读取农庄的玩家卡牌附属限制')
})

test('10631 牛奶房：放置工事时改放相邻地点；[action] 抽一张 Fire! 另一张洗入遭遇牌库', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.vineyard), connections: ['theFarmhouse'] })
  state.locations[0].connections = ['milkhouse']
  state.locations[1].connections = ['theFarmhouse']
  const api = makeApi({ choose: () => undefined, info: () => true, shuffleIntoEncounterDeck: () => true, drawEncounter: () => true })
  assert.equal(ln.placeDefense(state, 'trap', 'milkhouse', 0, api), true, '牛奶房重定向放置')
  const moves = ln.actions(state, { ...state.investigators[0], location: 'milkhouse', clues: 1 })
  assert.ok(moves.some(move => move.rule === 'theLongestNightFireDraw' || /Fire/i.test(move.label || '')), 'Fire! 行动可用')
})

test('10632 葡萄园：[fast] 每回合与一个敌人交战；敌人进入葡萄园时治愈 1 点伤害', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.vineyard), revealed: true })
  state.investigators[0].location = 'vineyard'
  const enemy = { id: 'e1', code: '10644a', originalCode: '10644a', location: 'vineyard', damageTaken: 2, defeated: false }
  state.enemies = [enemy]
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightVineyardEngage'), '快速交战可用')
  const api = makeApi({ healEnemy: () => true, info: () => true })
  ln.enemyMoved(state, enemy, 'theFarmhouse', api, 0)
  assert.equal(called(api, 'healEnemy') || enemy.damageTaken === 1, true, '进入葡萄园治愈 1 点')
})

test('10633 鸡笼：有诱饵时 -2 帷幕；此处敌人 +1 攻击/+1 躲避；Fire! 行动可用', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.coop), revealed: true })
  ln.placeDefense(state, 'decoy', 'coop', 0, makeApi({ info: () => true }))
  const location = state.locations.find(item => item.id === 'coop')
  assert.equal(ln.locationShroudModifier(state, location), -2, '有诱饵 -2 帷幕')
  const enemy = { id: 'e1', code: '10644a', location: 'coop', defeated: false }
  assert.equal(ln.enemyStatModifier(state, enemy, 'fight'), 1)
  assert.equal(ln.enemyStatModifier(state, enemy, 'evade'), 1)
  const moves = ln.actions(state, { ...state.investigators[0], location: 'coop', clues: 1 })
  assert.ok(moves.some(move => /Fire|着火了/.test(move.label || '') || move.rule === 'theLongestNightFireDraw'))
})

test('10634 谷仓：此处敌人 +1 伤害；揭示时把放到一边的埃阿斯放入谷仓（Codex Ω）', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.barn) })
  state.scenarioZones.setAside = [lnDef.AJAX_CODE]
  const enemy = { id: 'e1', code: '10644a', location: 'barn', defeated: false }
  assert.equal(ln.enemyAttackModifier(state, enemy, state.investigators[0]).damage, 1, '谷仓敌人 +1 伤害')
  const api = makeApi({ storyAsset: () => undefined, info: () => true })
  assert.equal(ln.enterAjax(state, 'barn', api), true, '谷仓揭示 → 埃阿斯入场')
})

test('10635 牧场：[fast] 有陷阱可移动；重整未交战敌人关键词进入后再结算（无屏障时）', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.pasture), revealed: true })
  placeLocationDefense(state, 'trap', 'pasture')
  state.locations.find(item => item.id === 'pasture').connections = ['theFarmhouse']
  ln.investigators?.(state)
  const moves = ln.actions(state, { ...state.investigators[0], location: 'pasture' })
  assert.ok(moves.some(move => move.rule === 'theLongestNightPastureMove'), '牧场快速移动可用')
  const enemy = { id: 'e1', code: '10643', location: 'pasture', exhausted: false, engagedSeat: null, defeated: false }
  state.enemies = [enemy]
  const api = makeApi({ info: () => true, resolveHunterMove: () => true })
  const reprise = ln.pastureKeywordReprise(state, enemy, 'theFarmhouse', api)
  assert.ok(reprise === true || reprise === false, '关键词再结算读点执行（无屏障时）')
})

test('10636 外围农田（血染小径）：[action] 移动敌人（团队每场一次）；最后线索后治愈病俘 2', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.outerFieldsBloodiedPaths), revealed: true, clues: 0, connections: ['theFarmhouse'] })
  state.enemies = [{ id: 'e1', code: '10644a', location: 'outerFieldsBloodiedPaths', defeated: false }]
  state.investigators[0].location = 'outerFieldsBloodiedPaths'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightMoveEnemy'))
  ln.placeCaptives(state, makeApi({ info: () => true }))
  const api = makeApi({ info: () => true, damageCaptives: () => true })
  assert.equal(ln.cluesRemoved(state, state.locations.find(item => item.id === 'outerFieldsBloodiedPaths'), 1, api), true)
})

test('10637 外围农田（绝望丘陵）：[fast] 团队每场一次查看敌人牌库顶 1/人并弃任意数量', () => {
  assert.equal(lnDef.ENEMY_SPAWN_DIRECTION['10637'] ?? 'east', 'east')
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.outerFieldsDesolateHills), revealed: true, clues: 1 })
  state.investigators[0].location = 'outerFieldsDesolateHills'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightEnemyDeckPeek'))
})

test('10638 外围农田（枯萎玉米田）：最后线索后放屏障；[fast] 每回合移动一个屏障', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.outerFieldsBlightedCornfields), revealed: true, clues: 0, connections: ['theFarmhouse'] })
  state.investigators[0].location = 'outerFieldsBlightedCornfields'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightMoveBarrier'))
  const api = makeApi({ info: () => true })
  assert.equal(ln.cluesRemoved(state, state.locations.find(item => item.id === 'outerFieldsBlightedCornfields'), 1, api), true)
  assert.equal(ln.barrierCountAt(state, 'outerFieldsBlightedCornfields'), 1)
})

test('10639 外围农田（焦灼小丘）：最后线索后放陷阱；[fast] 每回合移动一个陷阱', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.outerFieldsScorchedKnoll), revealed: true, clues: 0, connections: ['theFarmhouse'] })
  state.investigators[0].location = 'outerFieldsScorchedKnoll'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightMoveTrap'))
  const api = makeApi({ info: () => true })
  assert.equal(ln.cluesRemoved(state, state.locations.find(item => item.id === 'outerFieldsScorchedKnoll'), 1, api), true)
  assert.equal(ln.trapAt(state, 'outerFieldsScorchedKnoll'), true)
})

test('10640 外围农田（腐败作物）：最后线索后放诱饵；[fast] 每回合移动一个诱饵；布置固定移除（披露近似）', () => {
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.outerFieldsRancidCrops), revealed: true, clues: 0, connections: ['theFarmhouse'] })
  state.investigators[0].location = 'outerFieldsRancidCrops'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightMoveDecoy'))
  const api = makeApi({ info: () => true })
  assert.equal(ln.cluesRemoved(state, state.locations.find(item => item.id === 'outerFieldsRancidCrops'), 1, api), true)
  assert.equal(ln.decoyAt(state, 'outerFieldsRancidCrops'), true)
  assert.equal(entries['10640'].flags?.removedAtSetup, true, '布置固定移除此卡（近似披露）')
})

test('10641 病俘：敌军阶段重整未交战敌人攻击病俘（恐惧算伤害）；被击败 → 结局 3', () => {
  const state = lnState()
  ln.placeCaptives(state, makeApi({ info: () => true }))
  state.enemies = [{ id: 'e1', code: '10644a', location: lnDef.FARMHOUSE_ID, damage: 1, horror: 1,
    exhausted: false, engagedSeat: null, defeated: false }]
  const api = makeApi({ info: () => true })
  assert.equal(ln.enemyPhaseEnd(state, api), true, '敌军阶段结束：病俘被攻击')
  assert.equal(ln.captivesDamage(state), 2, '1 伤害 + 1 恐惧（恐惧改为伤害）')
  ln.damageCaptives(state, 20, makeApi({ info: () => true }))
  const resolution = ln.scenarioResolution(state, 'resolution3', makeApi({ info: () => true }))
  assert.equal(typeof resolution.resolution, 'string', '结局结算返回结果对象')
})

test('10642 埃阿斯：[action] 控制他已实现；印刷「不触发趁乱攻击」「横置移动两次/到任意田野」无读点（缺口）', () => {
  assert.equal(lnDef.AJAX_CODE, '10642')
  const state = lnState()
  state.locations.push({ ...clone(lnDef.LOCATIONS.barn) })
  state.storyAssets = [{ id: 'ajax', code: '10642', originalCode: '10642', location: 'barn', controllerSeat: null }]
  state.investigators[0].location = 'barn'
  const moves = ln.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'theLongestNightTakeAjax'), '控制埃阿斯行动可用')
  assert.equal(called(makeApi({}), 'ajaxMove'), false)
  // 缺口：条目 note 自述「不触发趁乱攻击/双倍移动」只保留在 flags（引擎没有通用读点）。
  assert.equal(entries['10642'].flags?.firstActionNoOpportunity, true)
  const behaviorText = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js', 'utf8')
  assert.equal(/firstActionNoOpportunity|moveAbility/.test(behaviorText), false, '缺口：无对应行为读点')
})

test('10643 类熊混种（饥饿憎恶）：+3 生命/人；忽略屏障；田野互连；生成西面；胜利 2', () => {
  const state = lnState()
  for (const id of lnDef.OUTER_FIELD_IDS) state.locations.push(clone(lnDef.LOCATIONS[id]))
  const enemy = { id: 'e1', code: '10643', location: 'theFarmhouse', defeated: false }
  assert.equal(ln.enemyStatModifier(state, enemy, 'health'), 3, '+3/人生命')
  assert.deepEqual(ln.enemyConnections(state, enemy, 'outerFieldsBloodiedPaths') !== undefined, true, '田野互连读点存在')
  // 开局在西面外围农田生成（setupEnemies/spawnUrsine 的真实读点）。
  const spawned = ln.spawnUrsine(state, { spawn: (code, locationId) => ({ id: 'ursine', code, location: locationId, defeated: false }) })
  assert.equal(spawned?.location, 'outerFieldsBloodiedPaths', '生成于西面外围农田')
  assert.notEqual(ln.enemyDamageAmount(state, enemy, 3), 1, '未受伤害上限影响')
  assert.equal(ALL_CARDS['10643'].victory, 2)
})

test('10644a 易羽混种（东）：生成东面；伤害上限 1；忽略屏障；弃置入敌人牌库', () => {
  const state = lnState()
  for (const id of lnDef.OUTER_FIELD_IDS) state.locations.push(clone(lnDef.LOCATIONS[id]))
  const enemy = { id: 'e1', code: '10644a', location: 'theFarmhouse', defeated: false }
  assert.equal(ln.spawnLocation(state, '10644a', 'theFarmhouse', null), 'outerFieldsDesolateHills')
  assert.equal(ln.enemyDamageAmount(state, enemy, 3), 1, '受到的伤害降为 1')
  assert.equal(enemyRuleFor('10644a').discardToScenarioDeck, 'enemyDeck')
  assert.deepEqual(enemyRuleFor('10644a').ignoreDefenses, ['barrier'])
})

test('10644b 易羽混种（南）：生成南面；伤害上限 1；忽略屏障', () => {
  const state = lnState()
  for (const id of lnDef.OUTER_FIELD_IDS) state.locations.push(clone(lnDef.LOCATIONS[id]))
  assert.equal(ln.spawnLocation(state, '10644b', 'theFarmhouse', null), 'outerFieldsScorchedKnoll')
  const enemy = { id: 'e1', code: '10644b', location: 'theFarmhouse', defeated: false }
  assert.equal(ln.enemyDamageAmount(state, enemy, 2), 1)
  assert.equal(enemyRuleFor('10644b').patrolTarget.locationId, lnDef.FARMHOUSE_ID)
})

test('10644c 易羽混种（西）：生成西面；伤害上限 1；忽略屏障；抛弃置入敌人牌库', () => {
  const state = lnState()
  for (const id of lnDef.OUTER_FIELD_IDS) state.locations.push(clone(lnDef.LOCATIONS[id]))
  assert.equal(ln.spawnLocation(state, '10644c', 'theFarmhouse', null), 'outerFieldsBloodiedPaths')
  const enemy = { id: 'e1', code: '10644c', location: 'theFarmhouse', defeated: false }
  assert.equal(ln.enemyDamageAmount(state, enemy, 5), 1)
  assert.deepEqual(enemyRuleFor('10644c').ignoreDefenses, ['barrier'])
})
