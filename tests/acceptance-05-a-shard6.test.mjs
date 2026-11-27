// 验收 05-a 分片 6（uad《聚合幻灭》05229–05272）逐卡证据。
//
// 每个用例标题含卡号；断言读取真实实现读点（条目描述子 / 章节 behavior 钩子 /
// 引擎数据规则），不是「条目存在」。本文件由验收审计产出，主进程合并时需登记进
// tests/suites.mjs 与 tests/node-suite.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import { nonPlayerEntryFor } from '../src/cards/encounter-abilities.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { hauntedAbilitiesAt } from '../src/engine/haunted.js'
import { createGameState, applyMove, getStat, legalMoves } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import * as uad from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/index.js'
import entry05259 from '../src/cards/encounter-entries/theCircleUndone/unionAndDisillusion/05259.js'
import entry05260 from '../src/cards/encounter-entries/theCircleUndone/unionAndDisillusion/05260.js'
import entry05270 from '../src/cards/encounter-entries/theCircleUndone/unionAndDisillusion/05270.js'
import entry05271 from '../src/cards/encounter-entries/theCircleUndone/unionAndDisillusion/05271.js'

const clone = value => structuredClone(value)

function makeInvestigator(seat = 0, location = 'miskatonicRiver') {
  return {
    seat, code: '05001', name: `调查员${seat + 1}`, location,
    damage: 0, horror: 0, clues: 0, resources: 5,
    hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [], actionsLeft: 3,
  }
}

function baseState(overrides = {}) {
  const scenario = clone(uad.scenario)
  const state = {
    scenario,
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: [makeInvestigator(0)],
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    locationVariants: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [...(scenario.encounterDeck || [])],
    encounterDiscard: [],
    chaosBag: ['skull', 'cultist', 'tablet', 'elderthing'],
    chaos: { revealed: [], sealed: [], removed: [], frames: [] },
    campaign: {
      leadSeat: 0, records: {}, chaosBag: [], supplies: {},
      investigators: { 0: { id: 'inv-0', deck: [], purchases: [] } },
    },
    difficulty: 'standard',
    numInvestigators: 1,
    round: 1,
    phase: 'investigation',
    doom: 0,
    clues: 0,
    status: 'playing',
    currentSeat: 0,
    skillTest: null,
  }
  return Object.assign(state, overrides)
}

function placeLocation(state, id, overrides = {}) {
  const definition = state.scenario.locations[id]
  assert.ok(definition, `场景定义缺少地点 ${id}`)
  const variant = state.locationVariants?.[id] || {}
  const instance = {
    ...clone(definition), id, revealed: true,
    clues: definition.cluesFixed ?? (definition.cluesPerInvestigator || 0) * state.numInvestigators,
    doom: 0, attachments: [], connections: [...(definition.connections || [])],
    ...(variant.markers ? { markers: [...variant.markers] } : {}),
    ...(variant.flags ? { flags: { ...(definition.flags || {}), ...variant.flags } } : {}),
    ...overrides,
  }
  state.locations.push(instance)
  return instance
}

function makeApi(state, options = {}) {
  const calls = {}
  const rec = name => (calls[name] ||= [])
  const testResults = options.testResults ? [...options.testResults] : []
  const choices = options.choices ? [...options.choices] : []
  const base = {
    drawEncounter: seat => rec('drawEncounter').push(seat),
    calls,
    info(text) { rec('info').push(String(text)) },
    random() { return 0.5 },
    shuffle(list) { return [...list] },
    test(seat, skill, difficulty, resolve, bonus, source, extra) {
      rec('test').push({ seat, skill, difficulty, bonus, source, extra })
      const override = testResults.length ? testResults.shift() : {}
      const result = {
        success: true, value: Number(difficulty) || 0, difficulty, skill, drawn: [], cancelledTokens: [],
        source, ...override,
      }
      resolve(result)
      return result
    },
    choose(request) {
      rec('choose').push(request)
      if (choices.length) return choices.shift()
      return request.options?.[0]?.id
    },
    choice(request) { return base.choose(request) },
    place(id) {
      if (state.locations.some(location => location.id === id)) return state.locations.find(location => location.id === id)
      return placeLocation(state, id)
    },
    reveal(id) {
      const location = state.locations.find(entry => entry.id === id)
      if (location) location.revealed = true
      rec('reveal').push(id)
    },
    spawn(code, location) {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: ALL_CARDS[code]?.nameZh || code, location, doom: 0, exhausted: false, engagedSeat: null,
      }
      state.enemies.push(enemy)
      rec('spawn').push({ code, location })
      return enemy
    },
    spawnStoryEnemy(code, location, props = {}, opts = {}) {
      const enemy = {
        id: `story-enemy-${state.enemies.length + 1}`, code, originalCode: code, location,
        doom: 0, exhausted: !!opts.exhausted, engagedSeat: null, ...props,
      }
      state.enemies.push(enemy)
      rec('spawnStoryEnemy').push({ code, location, props, opts })
      return enemy
    },
    engage(enemy, seat) {
      enemy.engagedSeat = seat
      rec('engage').push([enemy?.id, seat])
    },
    moveInvestigator(seat, destination) {
      const inv = state.investigators[seat]
      if (inv) inv.location = destination
      rec('moveInvestigator').push([seat, destination])
    },
    giveAsset(seat, code) {
      const asset = { id: `asset-${code}-${seat}`, code, originalCode: code }
      state.investigators[seat].assets.push(asset)
      rec('giveAsset').push([seat, code])
      return asset
    },
    damage(seat, amount) {
      state.investigators[seat].damage += amount
      rec('damage').push([seat, amount])
    },
    horror(seat, amount) {
      state.investigators[seat].horror += amount
      rec('horror').push([seat, amount])
    },
    directDamage(seat, amount) { rec('directDamage').push([seat, amount]) },
    directHorror(seat, amount) { rec('directHorror').push([seat, amount]) },
    threat(seat, code) {
      const card = { id: `threat-${code}-${state.investigators[seat].threat.length}`, code, originalCode: code }
      state.investigators[seat].threat.push(card)
      rec('threat').push([seat, code])
      return card
    },
    discoverClue(seat, amount) {
      state.investigators[seat].clues += amount
      rec('discoverClue').push([seat, amount])
    },
    spendClues(seat, amount) {
      state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - amount)
      rec('spendClues').push([seat, amount])
    },
    discardChosen(seat, amount, source) { rec('discardChosen').push([seat, amount, source]) },
    discardFromHand(seat, code) {
      const hand = state.investigators[seat].hand
      const index = hand.indexOf(code)
      if (index >= 0) hand.splice(index, 1)
      rec('discardFromHand').push([seat, code])
    },
    loseResources(seat, amount) {
      const inv = state.investigators[seat]
      const lost = Math.min(amount, inv.resources || 0)
      inv.resources -= lost
      rec('loseResources').push([seat, amount])
      return lost
    },
    applyPenalty(seat, penalty, failedBy, options) { rec('applyPenalty').push({ seat, penalty, failedBy, options }) },
    advanceAct() { state.actIndex += 1; rec('advanceAct').push(true) },
    advanceAgenda() { state.agendaIndex += 1; rec('advanceAgenda').push(true) },
    finish(key) { rec('finish').push(key) },
    trauma(seat, kind, amount) { rec('trauma').push([seat, kind, amount]) },
    attack(enemy, inv) { rec('attack').push([enemy?.id, inv?.seat]) },
    haunted(seat, options) { rec('haunted').push([seat, options]) },
    hauntedAt(locationId) { return hauntedAbilitiesAt(state, locationId) },
    boostEnemyUntil(enemy, key, until) { enemy[key] = until; rec('boostEnemyUntil').push([enemy?.id, key, until]) },
    flipEnemy(enemy, code) { rec('flipEnemy').push([enemy?.id, code]) },
    canDiscardAsset() { return true },
    discardAsset(seat, id) { rec('discardAsset').push([seat, id]); return true },
    cardName(code) { return ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code },
    cardType(code) { return ALL_CARDS[code]?.type },
    cardTraits(code) { return ALL_CARDS[code]?.traits || [] },
    cardSanity(code) { return ALL_CARDS[code]?.sanity },
    reduceTestDifficulty(amount) { rec('reduceTestDifficulty').push(amount) },
  }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol') return undefined
      return (...args) => { rec(prop).push(args); return undefined }
    },
  })
}

function withIsles(state) {
  return state
}

// ---------------------------------------------------------------------------
// 议程 / 幕（数据 + behavior 读点）
// ---------------------------------------------------------------------------

test('05240 命运的十字路口：背面每位幸存调查员被击败并承受 1 点肉体创伤，进入结局 5', () => {
  const state = baseState()
  state.investigators.push(makeInvestigator(1))
  state.numInvestigators = 2
  const api = makeApi(state)
  uad.behavior.agendaReveal(state, { id: 'agenda2', code: '05240', originalCode: '05240' }, api)
  assert.deepEqual(api.calls.trauma, [[0, 'physical', 1], [1, 'physical', 1]])
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.deepEqual(api.calls.finish, ['r5'])
})

test('05242 命数已定：背面生成看守人并洗入攫噬/注视，灵怪陷阱入场；本幕不能离开面前地点', () => {
  const state = baseState()
  state.scenarioFlags.faction = 'coven'
  state.scenarioZones.setAside = ['05272', '05087', '05087', '05086']
  state.encounterDiscard = ['04077']
  state.locations = [placeLocation(state, 'miskatonicRiver'), placeLocation(state, 'standingStones')]
  const front = state.locations.find(location => location.id === 'standingStones')
  front.revealed = false
  state.scenarioFlags.frontOf = { standingStones: 0 }
  state.investigators[0].location = 'standingStones'
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act2', code: '05242', originalCode: '05242' }, api)
  const watcher = state.enemies.find(enemy => enemy.code === '05086')
  assert.equal(watcher.location, 'miskatonicRiver')
  assert.ok(state.encounterDeck.includes('05272'))
  assert.equal(state.encounterDeck.filter(code => code === '05087').length, 2)
  assert.ok(state.encounterDeck.includes('04077'))
  assert.equal(state.encounterDiscard.length, 0)
  const trap = state.locations.find(location => location.id === 'geistTrap')
  assert.ok(trap, '灵怪陷阱应入场')
  assert.equal(uad.behavior.brazierLit(state, 'geistTrap'), true, '女巫集会阵营火盆已点燃')

  state.actIndex = 1
  state.acts[1] = { id: 'act2', code: '05242', originalCode: '05242' }
  assert.match(uad.behavior.moveError(state, state.investigators[0], { id: 'miskatonicRiver' }), /不能离开它/)
  state.acts[1] = { id: 'act3', code: '05243', originalCode: '05243' }
  assert.equal(uad.behavior.moveError(state, state.investigators[0], { id: 'miskatonicRiver' }), undefined)
})

test('05243 迷雾彼端（v. I）：背面揭示灵怪陷阱、拉入岛上调查员，法术成功生成安妮特', () => {
  const state = baseState()
  state.scenarioFlags.faction = 'coven'
  state.scenarioZones.setAside = ['05057', '05090', '05090', '05090', '05091', '05085']
  state.campaign.records = { theWitchesSpellWasCast: true }
  state.locations = [placeLocation(state, 'miskatonicRiver'), placeLocation(state, 'standingStones')]
  state.locations[1].revealed = false
  state.investigators[0].location = 'standingStones'
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act3', code: '05243', originalCode: '05243' }, api)
  assert.equal(state.locations.find(location => location.id === 'geistTrap').revealed, true)
  assert.equal(state.investigators[0].location, 'geistTrap')
  const spawned = state.enemies.map(enemy => enemy.code)
  assert.ok(spawned.includes('05057'), '法术成功应生成安妮特')
  assert.ok(!state.scenarioZones.setAside.includes('05057'))
  assert.ok(state.encounterDeck.includes('05090'), '剩余女巫敌人应洗入遭遇牌库')
})

test('05244 迷雾彼端（v. II）：背面把异教徒标记从混乱袋/封印区/战役袋移除', () => {
  const state = baseState()
  state.chaosBag = ['cultist', 'skull', 'cultist', 'tablet']
  state.chaos.sealed = [{ token: 'cultist' }, { token: 'tablet' }]
  state.campaign.chaosBag = ['cultist', 'skull']
  state.locations = [placeLocation(state, 'miskatonicRiver')]
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act3', code: '05244', originalCode: '05244' }, api)
  assert.equal(state.chaosBag.includes('cultist'), false)
  assert.equal(state.chaos.sealed.some(item => item.token === 'cultist'), false)
  assert.equal(state.chaos.sealed.some(item => item.token === 'tablet'), true)
  assert.equal(state.campaign.chaosBag.includes('cultist'), false)
  assert.equal(state.chaosBag.includes('tablet'), true)
})

test('05245 迷雾彼端（v. III）：背面生成秘社新信徒并洗入剩余银暮秘社，约瑟夫健在则生成且禁止谈判', () => {
  const state = baseState()
  state.scenarioFlags.faction = 'lodge'
  state.scenarioZones.setAside = ['05095', '05095', '05095', '05096', '05097', '05097', '05085']
  state.campaign.records = { josefIsAliveAndWell: true }
  state.locations = [placeLocation(state, 'miskatonicRiver')]
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act3', code: '05245', originalCode: '05245' }, api)
  assert.equal(state.enemies.filter(enemy => enemy.code === '05095').length, 1)
  assert.equal(state.enemies.some(enemy => enemy.code === '05085'), true)
  assert.equal(state.scenarioFlags.noParleyJosef, true)
  assert.ok(state.encounterDeck.includes('05096'), '剩余秘社卡应洗入遭遇牌库')
  assert.equal(state.scenarioZones.setAside.includes('05085'), false)
})

test('05246 迷雾彼端（v. IV）：背面不生成秘社新信徒，只洗银暮秘社并（约瑟夫健在时）生成约瑟夫', () => {
  const state = baseState()
  state.scenarioFlags.faction = 'lodge'
  state.scenarioZones.setAside = ['05095', '05095', '05095', '05096', '05097', '05097', '05085']
  state.campaign.records = { josefIsAliveAndWell: true }
  state.locations = [placeLocation(state, 'miskatonicRiver')]
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act3', code: '05246', originalCode: '05246' }, api)
  assert.equal(state.enemies.filter(enemy => enemy.code === '05095').length, 0, 'V4 不应生成秘社新信徒')
  assert.equal(state.enemies.some(enemy => enemy.code === '05085'), true)
  assert.ok(state.encounterDeck.includes('05095'))
  assert.ok(state.encounterDeck.includes('05096'))
})

test('05247 绑定仪式：看守人在灵怪陷阱被击败且火盆点燃时推进；背面进入结局 1', () => {
  const state = baseState()
  placeLocation(state, 'miskatonicRiver')
  const trap = placeLocation(state, 'geistTrap')
  state.acts[3] = { id: 'act4', code: '05247', originalCode: '05247' }
  state.actIndex = 3
  state.enemies = [{ id: 'watcher', code: '05086', originalCode: '05086', location: 'geistTrap', damageTaken: 0, exhausted: false }]
  const api = makeApi(state)
  uad.behavior.setBrazier(state, api, 'geistTrap', true)
  uad.behavior.enemyDefeated(state, state.enemies[0], api)
  assert.equal(state.enemies[0].exhausted, true)
  assert.equal(state.enemies[0].damageTaken, 0)
  assert.equal(state.scenarioFlags.watcherDefeatedAt, 'geistTrap')
  assert.equal(state.victoryDisplay.length, 0)
  uad.behavior.checkObjectives(state, api)
  assert.equal(api.calls.advanceAct.length, 1, '火盆点燃时应在被击败瞬间推进')

  // 击败后再改火盆不应改变已达成条件（记录的是击败瞬间）。
  uad.behavior.setBrazier(state, api, 'geistTrap', false)
  uad.behavior.checkObjectives(state, makeApi(state))
  uad.behavior.actReveal(state, state.acts[3], makeApi(state))
  const finishApi = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act4', code: '05247', originalCode: '05247' }, finishApi)
  assert.deepEqual(finishApi.calls.finish, ['r1'])
})

// ---------------------------------------------------------------------------
// 地点（05249–05257）
// ---------------------------------------------------------------------------

test('05249 米斯卡塔尼克河：定义声明撤退行动（引擎 loc.resign 读点）', () => {
  const state = baseState()
  const river = placeLocation(state, 'miskatonicRiver')
  assert.equal(river.resign, true)
  assert.equal(uad.scenario.locations.miskatonicRiver.resign, true)
  state.investigators[0].location = 'miskatonicRiver'
})

test('05250 危险河岸：阵法选择意志/智力(3)，成功后点燃火盆；闹鬼二选一失去行动或资源', () => {
  const state = baseState()
  const shore = placeLocation(state, 'forbiddingShore')
  state.investigators[0].location = 'forbiddingShore'
  const moves = uad.behavior.actions(state, state.investigators[0])
  assert.ok(moves.some(move => move.rule === 'circle'))
  const api = makeApi(state, { choices: ['intellect', 'light'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, 'intellect')
  assert.equal(api.calls.test[0].difficulty, 3)
  assert.equal(api.calls.test[0].source.actionKind, 'circle')
  assert.equal(uad.behavior.brazierLit(state, 'forbiddingShore'), true)

  const haunted = hauntedAbilitiesAt(state, 'forbiddingShore')
  assert.equal(haunted.length, 1)
  const clause = haunted[0].effect.find(item => item.kind === 'choice')
  assert.deepEqual(clause.options.map(option => option.id), ['action', 'resource'])
})

test('05251 立石：阵法意志+智力(10)；闹鬼令本轮阵法检定难度 +2', () => {
  const state = baseState()
  placeLocation(state, 'standingStones')
  state.investigators[0].location = 'standingStones'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  const call = api.calls.test[0]
  assert.deepEqual(call.skill, ['willpower', 'intellect'])
  assert.equal(call.difficulty, 10)
  assert.equal(call.source.actionKind, 'circle')

  uad.behavior.hauntedScript(state, { scriptId: 'standingStones', seat: 0, locationId: 'standingStones' }, api)
  state.skillTest = { actionKind: 'circle', seat: 0 }
  assert.equal(state.scenarioFlags.circleDifficultyRound, state.round)
  assert.equal(uad.behavior.testDifficultyModifier(state, state.investigators[0], 'willpower', 10, { label: '阵法' }), 2)
})

test('05252 迷雾空地：阵法意志+敏捷(11)；闹鬼二选一放毁灭或受到 1 伤 1 恐', () => {
  const state = baseState()
  placeLocation(state, 'mistyClearing')
  state.investigators[0].location = 'mistyClearing'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['willpower', 'agility'])
  assert.equal(api.calls.test[0].difficulty, 11)
  const haunted = hauntedAbilitiesAt(state, 'mistyClearing')
  const clause = haunted[0].effect.find(item => item.kind === 'choice')
  assert.deepEqual(clause.options.map(option => option.id), ['doom', 'harm'])
})

test('05253 弃林：阵法意志+战斗(11)；闹鬼可选查找夜鹰生成或最近夜鹰攻击', () => {
  const state = baseState()
  placeLocation(state, 'forsakenWoods')
  state.investigators[0].location = 'forsakenWoods'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['willpower', 'combat'])
  assert.equal(api.calls.test[0].difficulty, 11)

  state.encounterDeck = ['05266']
  state.locations.push({ id: 'other', name: '其他', connections: ['forsakenWoods'], clues: 0, doom: 0, flags: {} })
  state.locations.find(location => location.id === 'forsakenWoods').connections.push('other')
  state.enemies = [{ id: 'bird', code: '05266', originalCode: '05266', location: 'other', exhausted: false }]
  const scriptApi = makeApi(state, { choices: ['search'] })
  uad.behavior.hauntedScript(state, { scriptId: 'forsakenWoods', seat: 0, locationId: 'forsakenWoods' }, scriptApi)
  assert.equal(scriptApi.calls.spawn.at(-1).code, '05266')
  assert.equal(state.encounterDeck.includes('05266'), false)
})

test('05254 苔藓阶梯：阵法战斗+敏捷(10)；闹鬼让下一次移动行动多花 1 行动', () => {
  const state = baseState()
  placeLocation(state, 'mossCoveredSteps')
  state.investigators[0].location = 'mossCoveredSteps'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['combat', 'agility'])
  assert.equal(api.calls.test[0].difficulty, 10)

  uad.behavior.hauntedScript(state, { scriptId: 'mossSteps', seat: 0, locationId: 'mossCoveredSteps' }, api)
  uad.behavior.beforeMove(state, state.investigators[0], 'other', api, { reason: 'move' })
  assert.equal(state.investigators[0].actionsLeft, 2)
  uad.behavior.beforeMove(state, state.investigators[0], 'other', api, { reason: 'move' })
  assert.equal(state.investigators[0].actionsLeft, 2, '同一轮只额外扣一次')
})

test('05255 闹鬼泉：阵法智力+敏捷(9)；闹鬼可选弃支援或受 1 伤（无支援时只剩受伤）', () => {
  const state = baseState()
  placeLocation(state, 'hauntedSpring')
  state.investigators[0].location = 'hauntedSpring'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['intellect', 'agility'])
  assert.equal(api.calls.test[0].difficulty, 9)

  const noAssetApi = makeApi(state, { choices: ['damage'] })
  state.investigators[0].assets = []
  uad.behavior.hauntedScript(state, { scriptId: 'hauntedSpring', seat: 0, locationId: 'hauntedSpring' }, noAssetApi)
  assert.deepEqual(noAssetApi.calls.damage, [[0, 1]])
  const request = noAssetApi.calls.choose
  assert.equal(request, undefined)
})

test('05256 腐朽柳树：阵法智力+战斗(9)；闹鬼选择并弃掉手牌 1 张', () => {
  const state = baseState()
  placeLocation(state, 'decayedWillow')
  state.investigators[0].location = 'decayedWillow'
  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['intellect', 'combat'])
  assert.equal(api.calls.test[0].difficulty, 9)
  const haunted = hauntedAbilitiesAt(state, 'decayedWillow')
  assert.equal(haunted[0].effect[0].kind, 'discardChosen')
  assert.equal(haunted[0].effect[0].amount, 1)
})

test('05257 灵怪陷阱：四技能(20)阵法；看守人位于此地获得反击；未揭示不能进入', () => {
  const state = baseState()
  const trap = placeLocation(state, 'geistTrap')
  state.investigators[0].location = 'geistTrap'
  state.enemies = [{ id: 'watcher', code: '05086', originalCode: '05086', location: 'geistTrap', retaliate: false }]
  assert.equal(uad.behavior.canFightEnemy(state, state.investigators[0], state.enemies[0]), true)
  assert.equal(state.enemies[0].retaliate, true)
  state.locations.push({ id: 'other', connections: [], clues: 0, doom: 0, flags: {} })
  state.enemies[0].location = 'other'
  uad.behavior.enemyMoved(state, state.enemies[0], 'geistTrap', makeApi(state))
  assert.equal(state.enemies[0].retaliate, false)

  const api = makeApi(state, { choices: [null, 'leave'] })
  uad.behavior.performAction(state, state.investigators[0], { rule: 'circle' }, api)
  assert.deepEqual(api.calls.test[0].skill, ['willpower', 'intellect', 'combat', 'agility'])
  assert.equal(api.calls.test[0].difficulty, 20)
  trap.revealed = false
  assert.match(uad.behavior.investigatorEntryError(state, trap), /尚未揭示|遮蔽/)
})

// ---------------------------------------------------------------------------
// 命运剧情 / 敌人 / 诡计（05263–05272）
// ---------------------------------------------------------------------------

test('05259 杰罗姆·戴维斯：同地点抽到诡计且弃 ≥2 智力图标后取消显现', () => {
  const state = baseState()
  const withIntellect = Object.values(ALL_CARDS)
    .filter(card => card && Number(card.icons?.intellect || 0) > 0 && !['weakness', 'basicweakness'].includes(card.subtype))
    .map(card => card.code)
  assert.ok(withIntellect.length >= 2)
  const [first, second] = withIntellect
  state.investigators[0].hand = [first, second]
  state.investigators[0].location = 'miskatonicRiver'
  const context = { seat: 0, cardCode: '04077', weakness: false }
  const criteria = entry05259.abilities[0].criteria[0]
  assert.equal(criteria({ inv: state.investigators[0], context, state }), true)
  const api = makeApi(state, { choices: ['0', '0'] })
  entry05259.abilities[0].resolve({ inv: state.investigators[0], state, api, context })
  assert.equal(context.cancelled, true)
  assert.equal(api.calls.discardFromHand.length, 2)
  assert.equal(state.investigators[0].hand.length, 0)
})

test('05260 佩妮·怀特：显现效果期间检定成功后横置发现 1 线索', () => {
  const state = baseState()
  state._treacheryResolving = '04077'
  state.skillTest = { seat: 0 }
  const criteria = entry05260.abilities[0].criteria[0]
  assert.equal(criteria({ inv: state.investigators[0], state, context: { seat: 0 } }), true)
  const api = makeApi(state)
  entry05260.abilities[0].resolve({ inv: state.investigators[0], api })
  assert.deepEqual(api.calls.discoverClue, [[0, 1]])
})

function fateCard(name) {
  const fates = {
    jerome: { code: '05263', ally: '05259', enemy: '05263b', person: '05047', trail: 'theInvestigatorsAreOnJeromesTrail', alive: 'jeromeIsAlive', dead: 'jeromeIsDead', name: '杰罗姆' },
    penny: { code: '05264', ally: '05260', enemy: '05264b', person: '05049', trail: 'theInvestigatorsAreOnPennysTrail', alive: 'pennyIsAlive', dead: 'pennyIsDead', name: '佩妮' },
    valentino: { code: '05265', ally: '05261', enemy: '05265b', person: '05048', trail: 'theInvestigatorsAreOnValentinosTrail', alive: 'valentinoIsAlive', dead: 'valentinoIsDead', name: '瓦伦蒂诺' },
  }
  return { ...fates[name], resolved: false, seat: null }
}

test('05263 杰罗姆的命运：失踪且在追查 → 控制剧情支援、不占盟友槽、记录还活着', () => {
  const state = baseState()
  state.locations = [placeLocation(state, 'miskatonicRiver'), placeLocation(state, 'standingStones')]
  state.scenarioFlags = {
    faction: 'coven',
    asideIsles: ['05253', '05254', '05255', '05256'],
    placedIsles: ['05251', '05252'],
    fateCards: [fateCard('jerome')],
  }
  state.campaign.records = {
    disappearedIntoTheMist: ['05047'],
    theInvestigatorsAreOnJeromesTrail: true,
  }
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act1', code: '05241', originalCode: '05241' }, api)
  assert.deepEqual(api.calls.giveAsset.at(-1), [0, '05259'])
  assert.equal(state.campaign.records.jeromeIsAlive, true)
  const asset = state.investigators[0].assets.find(card => card.code === '05259')
  assert.deepEqual(asset.slots, ['none'])
  assert.equal(asset.slotsOverride, true)
})

test('05263b 杰罗姆·戴维斯（敌人面）：与你交战后选择并弃掉 2 张手牌', () => {
  const state = baseState()
  state.investigators[0].hand = ['01001', '01002', '01003']
  const enemy = { id: 'jerome-enemy', code: '05263b', originalCode: '05263b', location: 'miskatonicRiver' }
  state.enemies = [enemy]
  const api = makeApi(state)
  uad.behavior.enemyEngaged(state, enemy, state.investigators[0], api)
  assert.deepEqual(api.calls.discardChosen.at(-1), [0, 2, enemy.name])
})

test('05264 佩妮的命运：被幽灵夺走性命且在追查 → 翻回敌人面横置不交战', () => {
  const state = baseState()
  state.locations = [placeLocation(state, 'miskatonicRiver'), placeLocation(state, 'standingStones')]
  state.scenarioFlags = {
    faction: 'coven',
    asideIsles: ['05253', '05254', '05255', '05256'],
    placedIsles: ['05251', '05252'],
    fateCards: [fateCard('penny')],
  }
  state.campaign.records = {
    wasClaimedBySpecters: ['05049'],
    theInvestigatorsAreOnPennysTrail: true,
  }
  const api = makeApi(state)
  uad.behavior.actReveal(state, { id: 'act1', code: '05241', originalCode: '05241' }, api)
  const spawned = api.calls.spawnStoryEnemy.at(-1)
  assert.equal(spawned.code, '05264b')
  assert.equal(spawned.opts.exhausted, true)
  const enemy = state.enemies.find(entry => entry.code === '05264b')
  assert.equal(enemy.exhausted, true)
  assert.equal(enemy.engagedSeat, null)
})

test('05264b 佩妮·怀特（敌人面）：成功躲避后受到 1 点伤害', () => {
  const state = baseState()
  const enemy = { id: 'penny-enemy', code: '05264b', originalCode: '05264b', location: 'miskatonicRiver' }
  state.enemies = [enemy]
  const api = makeApi(state)
  uad.behavior.afterEvade(state, state.investigators[0], enemy, { success: true }, api)
  assert.deepEqual(api.calls.damage.at(-1), [0, 1])
  const failedApi = makeApi(state)
  uad.behavior.afterEvade(state, state.investigators[0], enemy, { success: false }, failedApi)
  assert.equal(failedApi.calls.damage, undefined)
})

test('05265b 瓦伦蒂诺·里瓦斯（敌人面）：与你交战后失去 2 资源', () => {
  const state = baseState()
  const enemy = { id: 'valentino-enemy', code: '05265b', originalCode: '05265b', location: 'miskatonicRiver' }
  state.enemies = [enemy]
  state.investigators[0].resources = 3
  const api = makeApi(state)
  uad.behavior.enemyEngaged(state, enemy, state.investigators[0], api)
  assert.deepEqual(api.calls.loseResources.at(-1), [0, 2])
  assert.equal(state.investigators[0].resources, 1)
})

test('05266 夜鹰：生成在首位调查员所在地点；同地点的调查员全技能 -1（多张叠加）', () => {
  const state = baseState()
  const isle = placeLocation(state, 'standingStones')
  state.investigators[0].location = 'standingStones'
  assert.equal(uad.behavior.spawnLocation(state, '05266', 'fallback'), 'standingStones')
  state.enemies = [{ id: 'bird-1', code: '05266', originalCode: '05266', location: 'standingStones', exhausted: false }]
  assert.equal(getStat(state, state.investigators[0], 'willpower'), (state.investigators[0].willpower || 0) - 1)
  state.enemies.push({ id: 'bird-2', code: '05266', originalCode: '05266', location: 'standingStones', exhausted: false })
  assert.equal(getStat(state, state.investigators[0], 'combat'), (state.investigators[0].combat || 0) - 2)
  state.locations.push({ id: 'other', connections: [], clues: 0, doom: 0, flags: {} })
  state.investigators[0].location = 'other'
  assert.equal(getStat(state, state.investigators[0], 'willpower'), state.investigators[0].willpower || 0)
  assert.ok(isle)
})

test('05267 幽灵乌鸦：猎物为智力最低；交战二选一得到 +2 攻/躲直到调查阶段结束', () => {
  const state = baseState()
  state.locations = [placeLocation(state, 'miskatonicRiver')]
  state.phase = 'enemy'
  const enemy = { id: 'raven', code: '05267', originalCode: '05267', location: 'miskatonicRiver', exhausted: false }
  state.enemies = [enemy]
  const spawnApi = makeApi(state)
  uad.behavior.enemySpawned(state, enemy, spawnApi)
  assert.equal(enemy.prey, 'lowestIntellect')
  const api = makeApi(state, { choices: ['modify'] })
  uad.behavior.enemyEngaged(state, enemy, state.investigators[0], api)
  assert.equal(enemy.ravenBoostUntilRound, state.round + 1)
  assert.equal(uad.behavior.enemyStatModifier(state, enemy, 'fight'), 2)
  assert.equal(uad.behavior.enemyStatModifier(state, enemy, 'evade'), 2)
  state.round += 2
  assert.equal(uad.behavior.enemyStatModifier(state, enemy, 'fight'), 0, '调查阶段结束后加值消失')
})

test('05268 渴望死亡：意志(2+已受伤)失败受 2 恐惧（声明式 treacheryRule.test）', () => {
  const state = baseState()
  state.investigators[0].damage = 2
  const api = makeApi(state, { testResults: [{ success: false, value: 0 }] })
  uad.behavior.resolveEncounter(state, state.investigators[0], { code: '05268', originalCode: '05268' }, api)
  assert.equal(api.calls.test[0].skill, 'willpower')
  assert.equal(api.calls.test[0].difficulty, 4)
  assert.deepEqual(api.calls.applyPenalty[0].penalty, { kind: 'takeHorror', amount: 2 })
  assert.equal(api.calls.applyPenalty[0].failedBy, 4)
})

test('05269 灵魂之歌：显现进入任意调查员威胁区；受伤时额外 2 伤并弃卡', () => {
  const state = baseState()
  state.investigators.push(makeInvestigator(1))
  state.numInvestigators = 2
  const api = makeApi(state, { choices: ['1'] })
  const handled = uad.behavior.resolveEncounter(state, state.investigators[0], { code: '05269', originalCode: '05269' }, api)
  assert.deepEqual(handled, { placed: true, surgeHandled: true })
  assert.deepEqual(api.calls.threat.at(-1), [1, '05269'])
  assert.deepEqual(state.investigators[1].threat.map(card => card.code), ['05269'])
  assert.deepEqual(nonPlayerEntryFor('05269').harmInterceptor, { trigger: 'damage', extra: 2, discard: true })
})

test('05270 死期临近：显现进入任意调查员威胁区；受恐时额外 2 恐并弃卡', () => {
  const state = baseState()
  state.investigators.push(makeInvestigator(1))
  state.numInvestigators = 2
  const api = makeApi(state, { choices: ['1'] })
  const handled = uad.behavior.resolveEncounter(state, state.investigators[0], { code: '05270', originalCode: '05270' }, api)
  assert.equal(handled, true)
  assert.deepEqual(api.calls.threat.at(-1), [1, '05270'])
  assert.deepEqual(entry05270.harmInterceptor, { trigger: 'horror', extra: 2, discard: true })
})

test('05271 死亡记号：敏捷(2+已受恐惧)失败受 2 伤害（声明式 treacheryRule.test）', () => {
  const state = baseState()
  state.investigators[0].horror = 1
  const api = makeApi(state, { testResults: [{ success: false, value: 1 }] })
  uad.behavior.resolveEncounter(state, state.investigators[0], { code: '05271', originalCode: '05271' }, api)
  assert.equal(api.calls.test[0].skill, 'agility')
  assert.equal(api.calls.test[0].difficulty, 3)
  assert.deepEqual(api.calls.applyPenalty[0].penalty, { kind: 'takeDamage', amount: 2 })
  assert.equal(api.calls.applyPenalty[0].failedBy, 2)
})

test('05272 看守人的注视：每位调查员意志(5)，失败者二选一结算所在地或看守人所在地闹鬼', () => {
  const state = baseState()
  state.investigators.push(makeInvestigator(1, 'mistyClearing'))
  state.numInvestigators = 2
  state.investigators[0].location = 'forsakenWoods'
  state.locations = [
    placeLocation(state, 'forsakenWoods'),
    placeLocation(state, 'mistyClearing'),
    placeLocation(state, 'geistTrap'),
  ]
  state.enemies = [{ id: 'watcher', code: '05086', originalCode: '05086', location: 'geistTrap' }]
  const api = makeApi(state, {
    testResults: [{ success: false, value: 0 }, { success: false, value: 0 }],
    choices: ['here', 'watcher'],
  })
  uad.behavior.resolveEncounter(state, state.investigators[0], { code: '05272', originalCode: '05272' }, api)
  assert.equal(api.calls.test.length, 2)
  assert.deepEqual(api.calls.test[0].skill, 'willpower')
  assert.equal(api.calls.test[0].difficulty, 5)
  assert.deepEqual(api.calls.haunted[0], [0, { locationId: 'forsakenWoods' }])
  assert.deepEqual(api.calls.haunted[1], [1, { locationId: 'geistTrap' }])
})

// ---------------------------------------------------------------------------
// 章节级真实引擎冒烟（05238 场景卡 / 布置与规则读点）
// ---------------------------------------------------------------------------

const SAFE_IDS = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

function settle(state, guardMax = 800) {
  let guard = 0
  while (state.pendingChoice && guard++ < guardMax) {
    const pending = state.pendingChoice
    const options = pending.options || []
    if (!options.length) break
    const optionId = SAFE_IDS.map(id => options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)?.id
      ?? options[0].id
    try { applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }) } catch {
      try { resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => current) } catch { break }
    }
  }
  return state.pendingChoice || null
}

function driveHub(state, guardMax = 200) {
  const lead = () => state.campaign?.leadSeat ?? 0
  const seatFor = action => ['hubBeginScenario', 'hubContinue', 'hubSetLeader', 'hubSelectScenario', 'hubSetDifficulty', 'hubGoSetup'].includes(action)
    ? lead() : (state.currentSeat ?? 0)
  for (let guard = 0; guard < guardMax; guard++) {
    if (state.uiState === 'inScenario' && state.scenario?.id) return true
    if (state.status !== 'playing') return false
    settle(state)
    const moves = legalMoves(state)
    if (!moves.length) return false
    const priority = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubConfirmDeck', 'hubAutoDeck', 'hubConfirmUpgrades',
      'hubAutoUpgrade', 'hubGoSetup', 'hubSelectInvestigator', 'hubSelectScenario', 'hubSetDifficulty', 'hubSetLeader']
    const candidates = priority.map(action => moves.find(move => move.action === action)).filter(Boolean)
    let applied = false
    for (const candidate of candidates) {
      for (const seat of [...new Set([seatFor(candidate.action), 0, state.currentSeat ?? 0])]) {
        try { applyMove(state, seat, candidate); applied = true; break } catch { /* next seat */ }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function endCurrentChapter(state) {
  settle(state)
  const keys = Object.keys(state.scenario?.resolutions || {})
  const resolutionKey = keys.find(key => key !== 'noResolution') || keys[0]
  try {
    applyMove(state, state.currentSeat ?? 0, { action: 'debug', kind: 'endScenario', resolutionKey })
  } catch (error) {
    if (!/剧本结算完成/.test(String(error?.message))) throw error
  }
  settle(state)
  return driveHub(state)
}

function unionAndDisillusionState() {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed: 'tcu-uad-acceptance' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程应能进入序章')
  settle(state)
  const index = chapters.findIndex(chapter => chapter.id === 'unionAndDisillusion')
  for (let chapterIndex = 0; chapterIndex < index; chapterIndex++) {
    assert.equal(endCurrentChapter(state), true, `应能进入第 ${chapterIndex + 2} 章`)
  }
  settle(state)
  return state
}

test('05238 真实引擎：聚合幻灭可由真实战役流程建立，布置/混乱袋/火盆/幕牌库可读', () => {
  const state = unionAndDisillusionState()
  assert.equal(state.scenario.id, 'unionAndDisillusion')
  assert.equal(state.scenario.originalCode, '05238')
  const ids = state.locations.map(location => location.id)
  assert.ok(ids.includes('miskatonicRiver'))
  assert.ok(ids.includes('forbiddingShore'))
  assert.ok(ids.length >= 4, '米斯卡塔尼克河 + 危险河岸 + 2 张未访之岛')
  assert.equal((state.scenarioFlags.placedIsles || []).length, 2)
  for (const isleCode of state.scenarioFlags.placedIsles) {
    assert.ok(state.locations.some(location => (location.originalCode || location.code) === isleCode), `未访之岛 ${isleCode} 应在场`)
  }
  assert.ok((state.scenarioZones.setAside || []).includes('05257'), '灵怪陷阱（05257）放在一边')
  assert.ok((state.scenarioZones.setAside || []).includes('05272'))
  assert.ok((state.scenarioZones.setAside || []).includes('05086'))
  assert.ok((state.chaosBag || []).includes('tablet') && (state.chaosBag || []).includes('elderthing'))
  assert.equal(state.acts[0].originalCode, '05241')
  assert.equal(state.agendas[0].originalCode, '05239')
  assert.ok(Array.isArray(state.scenarioFlags.fateCards) && state.scenarioFlags.fateCards.length >= 1,
    '命运剧情卡按失踪人口记录放入牌底')
  const faction = uad.behavior.factionOf(state)
  assert.ok(['lodge', 'coven'].includes(faction))
  if (faction === 'coven') assert.equal(uad.behavior.brazierLit(state, 'forbiddingShore'), true)
  // 真实动作：米斯卡塔尼克河的撤退选项由引擎 loc.resign 读点提供。
  const moves = legalMoves(state)
  assert.ok(moves.some(move => move.action === 'resign'), '所在地点应提供撤退行动')
})
