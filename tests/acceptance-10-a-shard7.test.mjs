// 10-a-7（FHV · fhvc 10572–10605）逐卡验收。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { behavior as lostSister } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js'
import * as lostSisterDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js'
import { behavior as depthsBehavior } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/behavior.js'
import { createGameState, newPlayerAssetInstance, relocateInvestigator, scenarioRuntime, validateMove } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { assetTextBlanked } from '../src/engine/card-text.js'
import * as depthsDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js'
import * as twisted from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/definition.js'
import akwan from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10575.js'
import hiddenCove from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10577.js'
import weedbeach from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10578.js'
import rocky from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10579.js'
import pools from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10580.js'
import openCave from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10581.js'
import fungal from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10582.js'
import reclaimed from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10586.js'
import luminous from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10587.js'
import moss from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10585.js'
import depths from '../src/cards/encounter-entries/theFeastOfHemlockVale/theThingInTheDepths/10600.js'

const walk = root => {
  const out = []
  const step = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name
      if (e.isDirectory()) step(p); else if (p.endsWith('.js')) out.push(p)
    }
  }
  step(root)
  return out
}
const files = walk('src/cards/encounter-entries/theFeastOfHemlockVale')
const findEntry = code => files.find(f => f.endsWith('/' + code + '.js'))
const contentText = () => walk('content/campaigns/theFeastOfHemlockVale').map(f => fs.readFileSync(f, 'utf8')).join('\n')

test('验收 10572/10573/10574/10588/10589/10590/10591 失踪的姐妹幕与场景参考卡：definition/behavior 读点齐备', () => {
  for (const code of ['10572', '10573', '10574', '10589', '10590', '10591']) {
    assert.ok(findEntry(code), `${code} 单卡条目存在`)
    assert.ok(fs.readFileSync(findEntry(code), 'utf8').includes('scope'), `${code} 条目导出`)
  }
  // 数据型幕/密谋：代码在 definition 中，behavior 有对应分派钩子。
  const defText = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js', 'utf8')
  const depthsDefText = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js', 'utf8')
  for (const code of ['10572', '10573', '10574']) assert.ok(defText.includes(code), `${code} 在 theLostSister definition`)
  for (const code of ['10589', '10590', '10591']) assert.ok(depthsDefText.includes(code), `${code} 在 theThingInTheDepths definition`)
  for (const hook of ['actReveal', 'agendaReveal', 'checkObjectives']) {
    assert.equal(typeof depthsBehavior[hook], 'function', `theThingInTheDepths behavior.${hook} 读点`)
  }
  for (const hook of ['actReveal', 'agendaReveal', 'checkObjectives', 'locationRevealed', 'actions', 'enemyDefeated']) {
    assert.equal(typeof lostSister[hook], 'function', `theLostSister behavior.${hook} 读点`)
  }
  // 10588 深沼之物 = 场景参考卡（无条目，按约定由 definition 承载）；10572 幕目标读点。
  assert.ok(/theThingInTheDepths|10588/.test(defText + fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js', 'utf8')), '10588 场景数据存在')
  assert.ok(lostSisterDef, '章节定义可导入')
})

test('验收 10575/10576/10577/10578/10579/10580/10581/10582 岩穴地点：条目声明与 behavior 分派读点', () => {
  for (const entry of [akwan, hiddenCove, weedbeach, rocky, pools, openCave, fungal]) {
    assert.equal(entry.scope, 'location')
    assert.ok(entry.code)
  }
  const behavior = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js', 'utf8')
  for (const needle of ['lostSisterAkwanParley', 'beforeMove', 'locationEntered', 'actions']) {
    assert.ok(behavior.includes(needle), `theLostSister ${needle} 读点存在`)
  }
  // 真实执行：地点行为读点函数为函数（按章分派）。
  assert.equal(typeof lostSister.actions, 'function')
  assert.equal(typeof lostSister.beforeMove, 'function')
  assert.equal(typeof lostSister.locationEntered, 'function')
})

test('验收 10583a/10583b/10584a/10584b/10585/10586/10587/10600/10601/10602 双面混种与深沼之物：条目/窗口声明齐备', () => {
  const texts = contentText()
  for (const needle of ['flipHybrid', 'syncHybrids', 'hybridFaceFor', 'lostSisterReclaimedByNature', 'groundDisturbanceResolve']) {
    assert.ok(texts.includes(needle), `${needle} 章节读点存在`)
  }
  for (const code of ['10583a', '10583b', '10584a', '10584b', '10601', '10602']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  assert.equal(reclaimed.scope, 'treachery')
  assert.equal(typeof reclaimed.encounterResolve, 'function', '10586 显现结算入口')
  assert.equal(luminous.scope, 'treachery')
  assert.equal(moss.scope, 'enemy')
  assert.equal(depths.scope, 'enemy')
})

test('验收 10593a/10593b/10594a/10594b/10595a/10595b/10596a/10596b/10597a/10597b/10598a/10598b/10599a/10599b/10603/10604/10605 沉没地点与恐怖谷：数据/行为读点', () => {
  for (const code of ['10593a', '10593b', '10594a', '10594b', '10595a', '10595b', '10596a', '10596b', '10597a', '10597b', '10598a', '10598b', '10599a', '10599b', '10603', '10604']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  const behavior = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/behavior.js', 'utf8')
  for (const needle of ['locationEntered', 'moveError', 'afterInvestigate', 'afterTest', 'groundDisturbanceResolve', 'sinkingSludgeResolve']) {
    assert.ok(behavior.includes(needle), `theLostSister ${needle} 读点`)
  }
  assert.ok(twisted && typeof twisted === 'object', '10605 扭曲空洞 definition 可导入')
  assert.ok(depthsDef && typeof depthsDef === 'object', '10588 深沼之物 definition 可导入')
})

function fixture(invLocation, locations, extra = {}) {
  return {
    investigators: [{ seat: 0, name: '调查员', location: invLocation, assets: [], actionsLeft: 3,
      damage: 0, horror: 0, clues: 0 }],
    locations, enemies: [], round: 1, phase: 'investigation', status: 'playing',
    currentSeat: 0, numInvestigators: 1, scenarioFlags: {}, scenarioZones: {},
    campaign: { leadSeat: 0, records: { day: 1 } }, acts: [], agendas: [], encounterDiscard: [],
    ...extra,
  }
}

const at = (id, fields = {}) => ({ ...structuredClone(lostSisterDef.LOCATIONS[id]), id, revealed: true, ...fields })
const testResult = (actionKind, success, target = null, source = null) => ({
  result: { success, passed: success }, context: { test: { actionKind, target, source } },
})

test('10575 阿克望谈判可重新排列岩穴牌堆前三张', () => {
  const original = ['hiddenCove', 'weedChokedBeach', 'undergroundPools', 'rockyShoreline']
  const state = fixture('akwan', [at('akwan')], { scenarioZones: { cavernsDeck: original.slice() } })
  const inv = state.investigators[0]
  const move = lostSister.actions(state, inv).find(entry => entry.rule === 'lostSisterAkwanParley')
  assert.ok(move)
  const choices = []
  const api = { choose: spec => {
    const choice = spec.options.at(-1)
    choices.push(choice.id)
    return choice.id
  } }
  assert.equal(lostSister.performAction(state, inv, move, api), true)
  assert.deepEqual(state.scenarioZones.cavernsDeck, [original[2], original[1], original[0], original[3]])
  assert.ok(choices.length >= 2)
})

for (const [code, id, action, field] of [
  ['10577', 'hiddenCove', 'fight', 'damage'],
  ['10578', 'weedChokedBeach', 'evade', 'actionsLeft'],
  ['10580', 'undergroundPools', 'investigate', 'horror'],
]) {
  test(code + ' 只在相应的地点检定失败后受到卡面惩罚', () => {
    const state = fixture(id, [at(id)])
    const inv = state.investigators[0]
    const api = {
      damage: (seat, amount) => { state.investigators[seat].damage += amount },
      horror: (seat, amount) => { state.investigators[seat].horror += amount },
      loseActions: (seat, amount) => { state.investigators[seat].actionsLeft -= amount },
    }
    const original = inv[field]
    const target = { kind: 'location', id }
    const passed = testResult(action, true, target)
    lostSister.afterTest(state, inv, passed.result, api, passed.context)
    assert.equal(inv[field], original)
    const failed = testResult(action, false, target)
    lostSister.afterTest(state, inv, failed.result, api, failed.context)
    assert.equal(inv[field], original + (field === 'actionsLeft' ? -1 : 1))
  })
}

test('10578 乱藻海滩离开前揭示混乱标记，命中符号且无道具时取消移动', () => {
  const beach = at('weedChokedBeach')
  const destination = at('rockyShoreline')
  const state = fixture(beach.id, [beach, destination])
  const inv = state.investigators[0]
  assert.equal(lostSister.beforeMove(state, inv, destination, { revealToken: () => 'skull' }), false)
  assert.equal(lostSister.beforeMove(state, inv, destination, { revealToken: () => '+1' }), true)
})

test('10581 露天洞穴快速异能消耗 0 行动，按重整敌人数设定难度并去掉黑暗', () => {
  const cave = at('openCave1', { traits: ['Dark', 'Cave'] })
  const state = fixture(cave.id, [cave], { enemies: [
    { id: 'ready', location: cave.id, exhausted: false }, { id: 'exhausted', location: cave.id, exhausted: true },
  ] })
  const inv = state.investigators[0]
  const rule = move => move.rule.startsWith('lostSisterOpenCaveLight:')
  assert.equal(lostSister.fastActions(state, { ...inv, seat: 1 }, 'investigation.afterAction').length, 0)
  state.phase = 'enemy'
  assert.equal(lostSister.fastActions(state, inv, 'enemy.afterHunters').length, 0)
  state.phase = 'investigation'
  const moves = lostSister.fastActions(state, inv, 'investigation.afterAction')
  const move = moves.find(rule)
  assert.ok(move)
  assert.equal(move.actions, 0)
  assert.equal(lostSister.actions(state, inv).some(rule), false)
  const trials = []
  const api = { test(seat, skill, difficulty, done) {
    trials.push([seat, skill, difficulty])
    const result = { success: true }
    done(result)
    return result
  } }
  assert.equal(lostSister.performAction(state, inv, move, api), true)
  assert.deepEqual(trials, [[0, 'agility', 3]])
  assert.equal(lostSister.isDarkLocation(state, cave), false)
  assert.equal(lostSister.fastActions(state, inv, 'investigation.afterAction').some(m => rule(m) && !m.reason), false)
  lostSister.roundEnded(state, api)
  state.round++
  lostSister.phaseBegan(state, 'mythos', api)
  assert.equal(lostSister.isDarkLocation(state, cave), false, '经过轮末和下轮神话阶段仍保持熄暗')
  lostSister.phaseBegan(state, 'investigation', api)
  assert.equal(lostSister.isDarkLocation(state, cave), true)
})

test('10583b 黑夜鲎类混种被实际近战攻击命中后伤害攻击者，包括致命打击', () => {
  for (const [weaponCode, attackLethal, expected] of [
    ['01006', false, 0], ['01020', false, 1], ['01020', true, 1],
  ]) {
    const state = createGameState({ seed: '10583b-' + weaponCode, playerInvestigator: '10001' }, [{ seat: 0 }])
    state.pendingChoice = null
    state.continuation = null
    state.scenario = lostSisterDef.scenario
    const inv = state.investigators[0]
    const cave = at('undergroundPools', { traits: ['Cave', 'Dark'] })
    inv.location = cave.id
    inv.hand = []
    const weapon = newPlayerAssetInstance(state, inv, weaponCode)
    inv.assets = [weapon]
    const enemy = { id: 'hybrid', code: '10583b', name: '鲎类混种', location: cave.id, traits: [],
      damageTaken: 0, fight: 0, health: attackLethal ? 1 : 20, engagedSeat: null,
      exhausted: true, victory: 0, attachments: [] }
    state.locations = [cave]
    state.enemies = [enemy]
    state.debugNextTokens = ['+1']
    const attack = (current, seat, move, events) =>
      scenarioRuntime(current, events).fight(seat, enemy.id, { assetId: weapon.id, baseValue: 10, damageBonus: 8 })
    resolveTransaction(state, inv.seat, { action: '10583b-test-attack' }, attack)
    for (let attempt = 0; attempt < 8 && state.pendingChoice; attempt++) {
      const choice = state.pendingChoice
      const answer = choice.options.find(option => ['done', 'skip', 'continue'].includes(option.id))
      assert.ok(answer, choice.prompt)
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: answer.id }, attack)
    }
    assert.equal(state.pendingChoice, null)
    assert.equal(state.investigators[0].damage - inv.damage, expected)
    assert.equal(state.enemies.length, attackLethal ? 0 : 1)
  }
})

test('10585 岩穴青苔附属可选道具，空白宿主文本并随控制者移动', () => {
  const state = createGameState({ seed: '10585', playerInvestigator: '10001' }, [{ seat: 0 }, { seat: 1 }])
  state.pendingChoice = null
  state.continuation = null
  state.scenario = lostSisterDef.scenario
  state.locations = [
    at('undergroundPools', { connections: ['hiddenCove'] }),
    at('hiddenCove', { connections: ['undergroundPools'] }),
  ]
  state.investigators[0].location = 'undergroundPools'
  state.investigators[0].assets = ['01020', '01006', '01021'].map(code =>
    newPlayerAssetInstance(state, state.investigators[0], code))
  const [firstItem, secondItem, ally] = state.investigators[0].assets
  const enemy = { id: 'moss', code: '10585', name: '岩穴青苔', location: 'undergroundPools',
    aloof: true, hunter: true, fight: 2, health: 3, engagedSeat: null, exhausted: false,
    traits: ['Flora', 'Mutated'], attachments: [], damageTaken: 0 }
  state.enemies = [enemy]
  const attach = (current, seat, move, events) => lostSister.afterTest(
    current, current.investigators[seat], { success: true }, scenarioRuntime(current, events),
    { test: { actionKind: 'investigate' } })
  resolveTransaction(state, 0, { action: '10585-test-attach' }, attach)
  const choice = state.pendingChoice
  assert.ok(choice)
  assert.ok(choice.options.some(option => option.id === firstItem.id))
  const host = choice.options.find(option => option.id === secondItem.id)
  assert.ok(host)
  assert.equal(choice.options.some(option => option.id === ally.id), false)
  resolveTransaction(state, 0, { action: 'choose', choiceId: choice.id, optionId: host.id }, attach)
  const inv = state.investigators[0]
  const attached = state.enemies[0]
  const asset = inv.assets.find(item => item.id === secondItem.id)
  assert.equal(attached.attachedToAssetId, asset.id)
  assert.equal(assetTextBlanked(asset, inv), true)
  assert.equal(assetTextBlanked(inv.assets.find(item => item.id === firstItem.id), inv), false)
  assert.equal(validateMove(state, 0, { action: 'fight', enemyId: attached.id }), null)
  assert.ok(validateMove(state, 0, { action: 'evade', enemyId: attached.id }))
  assert.ok(validateMove(state, 0, { action: 'engage', enemyId: attached.id }))
  attached.exhausted = true
  state.enemies.push({ ...enemy, id: 'another-moss', exhausted: false, attachedToAssetId: null })
  resolveTransaction(state, 0, { action: '10585-test-attach' }, attach)
  const nextChoice = state.pendingChoice
  assert.ok(nextChoice.options.some(option => option.id === asset.id))
  resolveTransaction(state, 0, { action: 'choose', choiceId: nextChoice.id, optionId: asset.id }, attach)
  const [mover, newOwner] = state.investigators
  const sharedAsset = mover.assets.find(item => item.id === asset.id)
  const attachedEnemies = state.enemies.filter(item => item.attachedToAssetId === sharedAsset.id)
  assert.equal(attachedEnemies.length, 2)
  relocateInvestigator(state, mover.seat, 'hiddenCove', [])
  assert.ok(attachedEnemies.every(item => item.location === mover.location))
  newOwner.location = 'undergroundPools'
  assert.equal(scenarioRuntime(state, []).transferAssetControl(sharedAsset, newOwner.seat), true)
  assert.ok(attachedEnemies.every(item => item.location === newOwner.location))
  scenarioRuntime(state, []).discardEnemy(attachedEnemies[1])
  assert.equal(assetTextBlanked(sharedAsset, newOwner), true)
  assert.equal(scenarioRuntime(state, []).discardAsset(newOwner.seat, sharedAsset.id), '01006')
  assert.equal(state.enemies.some(item => item.attachedToAssetId === sharedAsset.id), false)
})

test('10586 重属自然按所在地黑暗程度使用不同检定与失败伤害', () => {
  for (const dark of [false, true]) {
    const location = at('hiddenCove', { traits: dark ? ['Dark'] : [] })
    const state = fixture(location.id, [location])
    const inv = state.investigators[0]
    const tests = []
    const api = {
      resolveScenarioEvent: (event, payload) => lostSister.events[event](state, payload, api),
      test: (seat, skill, difficulty) => {
        tests.push([seat, skill, difficulty])
        return { success: false }
      },
      damage: (seat, amount) => { state.investigators[seat].damage += amount },
      horror: (seat, amount) => { state.investigators[seat].horror += amount },
    }
    assert.equal(reclaimed.encounterResolve(state, inv, {}, api), true)
    assert.deepEqual(tests, [[0, dark ? 'willpower' : 'combat', 3]])
    assert.deepEqual([inv.damage, inv.horror], dark ? [0, 2] : [2, 0])
  }
})

test('10587 荧光增生附属到最近的黑暗地点，敏捷检定成功丢弃并恢复黑暗', () => {
  const village = at('akwan', { connections: ['near'], traits: [] })
  const near = at('near', { connections: ['akwan', 'far'], traits: ['Dark'], attachments: [] })
  const far = at('far', { connections: ['near'], traits: ['Dark'], attachments: [] })
  const state = fixture(village.id, [village, near, far])
  const inv = state.investigators[0]
  const api = {
    resolveScenarioEvent: (event, payload) => lostSister.events[event](state, payload, api),
    attachEncounterToLocation(code, locationId, extra) {
      const location = state.locations.find(candidate => candidate.id === locationId)
      const attachment = { id: 'growth', code, location: locationId, ...extra }
      location.attachments.push(attachment)
      return attachment
    },
    discardAttachment(source) {
      near.attachments = near.attachments.filter(item => item !== source)
      state.encounterDiscard.push(source.code)
      return true
    },
    test(seat, skill, difficulty, end) {
      assert.deepEqual([seat, skill, difficulty], [0, 'agility', 3])
      const result = { success: true }
      end?.(result)
      return result
    },
  }
  assert.equal(luminous.encounterResolve(state, inv, {}, api), true)
  assert.deepEqual(near.attachments.map(card => card.code), ['10587'])
  assert.equal(far.attachments.length, 0)
  assert.equal(lostSister.isDarkLocation(state, near), false)
  const enemy = { id: 'enemy', location: near.id }
  assert.equal(lostSister.enemyStatModifier(state, enemy, 'fight'), 1)
  assert.equal(lostSister.enemyStatModifier(state, enemy, 'evade'), 0)
  assert.equal(lostSister.enemyAttackModifier(state, enemy).damage, 1)
  inv.location = near.id
  const move = lostSister.actions(state, inv).find(candidate => candidate.rule.startsWith('lostSisterDiscardGrowth:'))
  assert.ok(move)
  lostSister.performAction(state, inv, move, api)
  assert.deepEqual(state.encounterDiscard, ['10587'])
  assert.equal(lostSister.isDarkLocation(state, near), true)
})

test('10592 深沼之物快速改巡逻支付同地点的团队线索，本轮巡逻改走新地点', () => {
  const state = createGameState({ seed: '10592', playerInvestigator: '10001' }, [{ seat: 0 }, { seat: 1 }])
  state.pendingChoice = null
  state.continuation = null
  state.scenario = depthsDef.scenario
  state.acts = [{ code: '10592' }]
  state.actIndex = 0
  state.locations = [
    at('origin', { connections: ['new', 'old'] }),
    at('new', { name: '新目标', connections: ['origin'] }),
    at('old', { connections: ['origin'] }),
  ]
  const [inv, partner] = state.investigators
  inv.location = partner.location = 'new'
  inv.clues = 0
  partner.clues = 2
  const hybrid = { code: depthsDef.CHELYDRAN_HYBRID_CODE, id: 'hybrid', name: '鳄龟混种', location: 'origin',
    traits: [], attachments: [], exhausted: false, engagedSeat: null }
  state.enemies = [hybrid]
  const isPatrol = move => move.rule === 'depthsChangeHybridPatrol'
  const move = depthsBehavior.fastActions(state, inv, 'investigation.afterAction').find(isPatrol)
  assert.ok(move && !move.reason)
  assert.equal(move.actions, 0)
  assert.equal(depthsBehavior.actions(state, inv).some(isPatrol), false)
  const change = (current, seat, selected, events) =>
    depthsBehavior.performAction(current, current.investigators[seat], selected, scenarioRuntime(current, events))
  resolveTransaction(state, inv.seat, move, change)
  for (let attempt = 0; attempt < 3 && state.pendingChoice; attempt++) {
    const choice = state.pendingChoice
    const answer = choice.options.find(option => option.id === String(partner.seat))
    assert.ok(answer)
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: answer.id }, change)
  }
  assert.equal(state.pendingChoice, null)
  assert.equal(state.investigators[1].clues, 0)
  for (const investigator of state.investigators) investigator.location = 'old'
  assert.equal(scenarioRuntime(state, []).runEnemyPatrol(state.enemies[0]), true)
  assert.equal(state.enemies[0].location, 'new')
})

test('10600 深沼之物在沼地完成攻击后治愈 2 点伤害，其他地形无效果', () => {
  const state = createGameState({ seed: '10600', playerInvestigator: '10001' }, [{ seat: 0 }])
  state.scenario = depthsDef.scenario
  state.pendingChoice = null
  state.continuation = null
  state.locations = [at('bog', { traits: ['Bog'] }), at('shore', { traits: [] })]
  const enemy = { id: 'depths', code: '10600', location: 'bog', name: '深沼之物',
    damageTaken: 3, damage: 1, horror: 0, attachments: [] }
  state.enemies = [enemy]
  const inv = state.investigators[0]
  inv.location = 'bog'
  inv.assets = []
  inv.hand = []
  const api = scenarioRuntime(state, [])
  api.attack(enemy, inv)
  assert.equal(enemy.damageTaken, 1)
  assert.equal(inv.damage, 1)
  enemy.location = inv.location = 'shore'
  api.attack(enemy, inv)
  assert.equal(enemy.damageTaken, 1)
  assert.equal(inv.damage, 2)
})
