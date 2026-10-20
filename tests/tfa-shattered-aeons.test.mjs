import test from 'node:test'
import assert from 'node:assert/strict'
import { registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as tfaCampaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'
import * as shattered from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/index.js'
import {
  ALTERNATE_ACTS, BETWEEN_WORLDS, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
  FORMLESS_SPAWN, ICHTACA, ALEJANDRO, MEND_THE_SHATTER, NEXUS, PARADISE_LOST, POCKET,
  RELIC_AGES_UNLEASH, SHATTERED_LOCATIONS, TEMPORAL_DEVOURER, TIMELOCK,
} from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/definition.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2) {
  return {
    scenario: clone(shattered.scenario),
    acts: clone(shattered.scenario.acts),
    agendas: clone(shattered.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: NEXUS,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [...shattered.scenario.encounterDeck],
    encounterDiscard: [],
    explorationDeck: [],
    explorationDiscard: [],
    relicOfAges: null,
    chaosBag: ['+1', '0', '0', '-1', '-2', 'skull', 'skull', 'elderthing', 'autofail', 'eldersign'],
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, () => ({ id: 'inv', deck: [], purchases: [] })),
      chaosBag: [],
    },
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

// 把 11 处地点全部放入场（含线索），供大多数行为测试使用。
function placed(state) {
  state.locations = Object.values(state.scenario.locations).map(location => ({
    ...clone(location),
    revealed: true,
    clues: location.cluesFixed ?? (location.cluesPerInvestigator || 0) * state.numInvestigators,
    doom: 0,
    attachments: [],
  }))
  return state
}

function makeApi(state, overrides = {}) {
  const calls = {
    info: [], damage: [], horror: [], spawn: [], giveAsset: [], finish: [],
    moves: [], tests: [], choices: [], removed: [], drawn: [], poisoned: [],
    advanceAct: 0, advanceAgenda: 0, shuffledDiscard: 0, discarded: [], defeatedEnemies: [],
  }
  const api = {
    calls,
    info: text => calls.info.push(String(text)),
    random: () => 0.5,
    place: id => {
      const def = state.scenario.locations?.[id]
      if (!def || state.locations.some(location => location.id === id)) return null
      const location = { ...clone(def), id, revealed: true,
        clues: def.cluesFixed ?? (def.cluesPerInvestigator || 0) * state.numInvestigators,
        doom: 0, attachments: [] }
      state.locations.push(location)
      return location
    },
    remove: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
      calls.removed.push(id)
    },
    spawn: (code, location) => {
      const enemy = {
        id: `e${state.enemies.length + 1}`, code, originalCode: code, name: code, location,
        fight: 2, evade: 2, health: 4, damage: 1, horror: 1, damageTaken: 0, doom: 0,
        clues: 0, exhausted: false, engagedSeat: null, traits: [],
      }
      state.enemies.push(enemy)
      calls.spawn.push({ code, location })
      return enemy
    },
    damage: (seat, amount) => {
      state.investigators[seat].damage += amount
      calls.damage.push([seat, amount])
    },
    horror: (seat, amount) => {
      state.investigators[seat].horror += amount
      calls.horror.push([seat, amount])
    },
    healDamage: () => {}, healHorror: () => {},
    giveAsset: (seat, code) => {
      const asset = { id: `a-${code}-${seat}`, code, originalCode: code }
      state.investigators[seat].assets.push(asset)
      calls.giveAsset.push([seat, code])
      return asset
    },
    test: (seat, skill, difficulty, resolve, bonus = 0, source = null) => {
      calls.tests.push({ seat, skill, difficulty })
      const extra = state.nextTestResult || { success: true, value: difficulty, drawn: [] }
      resolve({ success: true, value: difficulty, drawn: [], ...extra, difficulty, skill })
    },
    choose: request => {
      calls.choices.push(request)
      return state.nextChoice ?? request.options?.[0]?.id
    },
    moveInvestigator: (seat, destination) => {
      state.investigators[seat].location = destination
      calls.moves.push([seat, destination])
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    addDoom: amount => { state.doom = (state.doom || 0) + amount },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    drawCards: (seat, amount) => { calls.drawn.push([seat, amount]) },
    drawEncounter: seat => { calls.drawn.push([seat, 'encounter']) },
    shuffleDiscard: () => { calls.shuffledDiscard += 1 },
    poison: seat => {
      state.investigators[seat].threat.push({ id: `poison-${seat}`, code: '04102' })
      calls.poisoned.push(seat)
    },
    isPoisoned: seat => state.investigators[seat].threat.some(card => card.code === '04102'),
    checkSupplies: (seat, name) => (state.campaign.supplies?.[seat] || []).includes(name),
    discardEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      calls.discarded.push(enemy.code)
    },
    defeatEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      calls.defeatedEnemies.push(enemy.code)
    },
    removeEnemyFromGame: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      calls.discarded.push(enemy.code)
      return true
    },
    defeat: inv => { inv.defeated = true },
    cardReveal: code => { calls.revealed = code },
    yigsFury: () => Number(state.campaign.records.yigsFury || 0),
    moveRelicOfAges: ({ code = null, location = null, seat = null } = {}) => {
      state.relicOfAges = {
        code: code || state.relicOfAges?.code || '04061',
        location: seat != null ? state.investigators[seat].location : location,
        seat: seat ?? null,
      }
      return state.relicOfAges
    },
    advanceAct: () => {
      calls.advanceAct += 1
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      shattered.behavior.actReveal(state, act, api)
    },
    advanceAgenda: () => {
      calls.advanceAgenda += 1
      const agenda = state.agendas[state.agendaIndex]
      state.agendaIndex += 1
      shattered.behavior.agendaReveal(state, agenda, api)
    },
    finish: key => {
      calls.finish.push(key)
      state.status = 'finished'
      state.resolution = key
    },
    addTrauma: (target, seat, kind, amount) => {
      calls.info.push(`trauma:${seat}:${kind}:${amount}`)
    },
  }
  return Object.assign(api, overrides)
}

const byId = (state, id) => state.locations.find(location => location.id === id)

test('破碎永世 M5：章节已从占位升级为 playable，并保留原卡身份', () => {
  assert.equal(shattered.manifest.status, 'playable')
  assert.equal(shattered.manifest.catalogReferenceOnly, undefined)
  assert.equal(shattered.manifest.referenceCode, undefined)
  assert.equal(shattered.scenario.originalCode, '04314')
  assert.equal(shattered.behavior.id, 'shatteredAeons')
  assert.equal(shattered.manifest.locations.length, 11)
  assert.deepEqual(shattered.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(shattered.manifest.agendas.map(agenda => agenda.id),
    ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(shattered.manifest.resolutionIds,
    ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5'])
  assert.deepEqual(shattered.manifest.requiredMechanicIds,
    ['tfaExploration', 'tfaVengeance', 'tfaYigsFury', 'tfaRelicOfAges'])
})

test('实现清单只列真正结算了印刷效果的敌人/诡计', () => {
  const codes = shattered.behavior.implementedEncounterCodes
  for (const code of ['04325', '04326', '04337', '04338', '04339', '04340', '04341', '04342']) {
    assert.ok(codes.includes(code), code)
  }
  assert.ok(codes.includes('01166'))
  // 04343「古代遗物」是资产，不在敌人/诡计清单里。
  assert.equal(codes.includes('04343'), false)
  assert.deepEqual([...new Set(codes)], codes, '清单不应重复')
})

test('符号地图：联结点用菱形连水滴与星星，六处破碎地点只连时间之窗', () => {
  const locations = Object.fromEntries(shattered.manifest.locations.map(location =>
    [location.id, location]))
  assert.deepEqual([...locations.nexusOfNKai.connections].sort(),
    ['aPocketInTime', 'cityOfTheUnseen', 'shoresOfRlyeh', 'yuggoth'])
  assert.deepEqual([...locations.aPocketInTime.connections].sort(),
    [NEXUS, 'atlantis', 'mu', 'pnakotus', 'plateauOfLeng', 'ruinsOfNewYork', 'valusia'].sort())
  assert.deepEqual([...locations.valusia.connections], [POCKET])
  assert.equal(locations.mu.connections.includes('valusia'), false,
    '等号地点彼此不相连，只与时间之窗相连')
  assert.deepEqual([...locations.yuggoth.connections], [NEXUS])
})

test('布置是确定性的：同一探索牌库、同一遭遇牌库，且不含放在一边的牌', () => {
  const build = seed => {
    const state = stateFor()
    shattered.behavior.setupLocations(state, [], setupApi(seed))
    return state.explorationDeck
  }
  const first = build(17)
  assert.deepEqual(first, build(17))
  assert.notDeepEqual(first, build(18))
  assert.equal(first.length, 6)
  assert.deepEqual([...first].sort(), [
    ...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERIES),
  ].sort())
  const deck = shattered.scenario.encounterDeck
  for (const code of [ICHTACA, ALEJANDRO, FORMLESS_SPAWN]) {
    assert.equal(deck.includes(code), false, `${code} 放在一边`)
  }
  assert.equal(deck.filter(code => code === BETWEEN_WORLDS).length, 1, '异界之间占用探索牌库一张')
})

test('布置把 7 处地点、伊塔卡、亚历山卓、无形之子、4a 幕与 4 张中毒放在一边', () => {
  const state = stateFor()
  const ids = shattered.behavior.setupLocations(state, [], setupApi(3))
  assert.deepEqual(ids, [NEXUS])
  const aside = state.scenarioZones.setAside
  assert.ok(aside.includes(RELIC_AGES_UNLEASH), '时光涌流的古代遗物')
  assert.ok(aside.includes(ICHTACA))
  assert.ok(aside.includes(ALEJANDRO))
  assert.ok(aside.includes(FORMLESS_SPAWN))
  assert.ok(aside.includes(PARADISE_LOST))
  assert.ok(aside.includes(TIMELOCK))
  assert.equal(aside.filter(code => code === '04102').length, 4)
  assert.deepEqual([...state.scenarioZones.setAsideLocations].sort(),
    [POCKET, ...SHATTERED_LOCATIONS].sort())
  assert.equal(state.scenarioFlags.relicCode, '04061')
})

test('混乱标记表：骷髅看遗物、石板中毒自动失败、旧神把巫术洗回探索牌库', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(5))
  const inv = state.investigators[0]
  const api = makeApi(state)
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -2)
  state.relicOfAges = { code: RELIC_AGES_UNLEASH, seat: 0, location: NEXUS }
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -4)
  state.difficulty = 'hard'
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -5)
  state.difficulty = 'standard'
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'cultist', api).delta, -2)
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'tablet', api).delta, -2)
  inv.threat.push({ id: 'p', code: '04102' })
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'tablet', api).autoFail, true)
  inv.threat = []
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'elderthing', api).delta, -2)
})

test('混乱标记结算后：异教徒放毁灭、巫术洗回探索牌库、困难难度石板放中毒', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(7))
  const inv = state.investigators[0]
  state.enemies.push({ id: 'c1', code: '04095', originalCode: '04095', name: '兄弟会异教徒',
    location: NEXUS, doom: 0, traits: ['Cultist'], damageTaken: 0, exhausted: false, engagedSeat: null })
  state.encounterDiscard = ['04340']
  state.explorationDeck = ['yuggoth']
  const api = makeApi(state)
  shattered.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 3, skill: 'willpower', drawn: ['cultist', 'elderthing'],
  }, api)
  assert.equal(state.enemies[0].doom, 1, '最近的异教徒得到 1 点毁灭')
  assert.deepEqual(state.explorationDeck, ['yuggoth', '04340'], '巫术诡计洗回探索牌库')
  assert.equal(state.encounterDiscard.length, 0)
  // 困难难度的石板：未中毒 + 检定失败 → 一张放在一边的中毒进入威胁区域。
  state.difficulty = 'hard'
  const before = state.scenarioZones.setAside.filter(code => code === '04102').length
  shattered.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 3, skill: 'willpower', drawn: ['tablet'],
  }, api)
  assert.equal(inv.threat.filter(card => card.code === '04102').length, 1)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '04102').length, before - 1)
})

test('幕 1 推进：时间之窗洗入探索牌库；幕 2 推进：破碎地点与巫术一起洗入', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(11))
  const api = makeApi(state)
  state.encounterDiscard = ['04341', '04342']
  shattered.behavior.actReveal(state, state.acts[0], api)
  assert.ok(state.explorationDeck.includes(POCKET), '时间之窗进入探索牌库')
  assert.equal(state.scenarioZones.setAsideLocations.includes(POCKET), false)
  shattered.behavior.actReveal(state, state.acts[1], api)
  for (const id of SHATTERED_LOCATIONS) assert.ok(state.explorationDeck.includes(id), id)
  assert.ok(state.explorationDeck.includes('04341'), '遭遇弃牌堆里的巫术被洗入')
  assert.equal(state.explorationDeck.includes('04342'), false, '非巫术诡计留在弃牌堆')
})

test('幕 2 背面：遗物丢失时把时光涌流附属到时间之窗', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(13))
  state.campaign.records.theRelicIsMissing = true
  state.scenarioFlags.relicCode = RELIC_AGES_UNLEASH
  const api = makeApi(state)
  shattered.behavior.actReveal(state, state.acts[1], api)
  assert.deepEqual(state.relicOfAges, { code: RELIC_AGES_UNLEASH, location: POCKET, seat: null })
  assert.equal(state.scenarioZones.setAside.includes(RELIC_AGES_UNLEASH), false)
})

test('幕 3：从牌库找出遗物、在时间之窗控制它，并推进场景', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(17))
  state.actIndex = 2
  const inv = state.investigators[0]
  state.relicOfAges = { code: '04061', location: POCKET, seat: null }
  inv.deck = ['01001', '04061']
  const api = makeApi(state)
  const moves = shattered.behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'searchRelic'))
  shattered.behavior.performAction(state, inv, moves.find(move => move.rule === 'searchRelic'), api)
  assert.ok(inv.hand.includes('04061'), '遗物被加入手牌')
  // 时间之窗上没有线索 → 可以控制遗物。
  inv.location = POCKET
  byId(state, POCKET).clues = 0
  const takeMove = shattered.behavior.actions(state, inv).find(move => move.rule === 'takeRelic')
  assert.ok(takeMove, '提供「控制古代遗物」行动')
  shattered.behavior.performAction(state, inv, takeMove, api)
  assert.equal(state.relicOfAges.seat, 0)
  assert.equal(state.relicOfAges.code, '04061')
  assert.ok(inv.assets.some(asset => asset.code === '04061'))
  const advanced = []
  shattered.behavior.checkObjectives(state, makeApi(state, {
    advanceAct: () => { advanced.push(state.actIndex); state.actIndex += 1 },
  }))
  assert.deepEqual(advanced, [2], '控制遗物后推进到场景 4')
})

test('幕 3 背面：与伊塔卡/亚历山卓为敌时在联结点与时间之窗生成', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(19))
  state.campaign.records.ichtacaIsSetAgainstYou = true
  state.campaign.records.alejandroIsSetAgainstYou = true
  const api = makeApi(state)
  shattered.behavior.actReveal(state, state.acts[2], api)
  assert.deepEqual(api.calls.spawn, [
    { code: ICHTACA, location: NEXUS },
    { code: ALEJANDRO, location: POCKET },
  ])
  assert.equal(state.scenarioFlags.relicGuard, true)
})

test('幕 4 修补裂痕：检定成功把破碎地点附属到遗物，凑够人数+1 后进入结局 1', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(23))
  state.actIndex = 3
  state.relicOfAges = { code: '04061', seat: 0, location: 'mu' }
  state.investigators[0].location = 'mu'
  state.investigators[0].assets.push({ id: 'relic', code: '04061', originalCode: '04061' })
  state.investigators[1].location = 'mu'
  const mu = byId(state, 'mu')
  mu.clues = 0
  const api = makeApi(state)
  const attach = shattered.behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'attachLocation')
  assert.ok(attach, '提供「附属地点」行动')
  shattered.behavior.performAction(state, state.investigators[0], attach, api)
  assert.equal(byId(state, 'mu'), undefined, '地点被移出游戏')
  assert.deepEqual(state.scenarioFlags.relicUnderneath.map(entry => entry.id), ['mu'])
  assert.equal(state.investigators[1].location, POCKET, '此地的其他调查员被移到时间之窗')
  // 凑够 2 + 1 = 3 处地点后推进。
  state.scenarioFlags.relicUnderneath.push(
    { id: 'valusia', code: '04335', name: '瓦卢西亚', victory: 1 },
    { id: 'pnakotus', code: '04334', name: '纳克特', victory: 1 },
  )
  const advanced = []
  shattered.behavior.checkObjectives(state, makeApi(state, {
    advanceAct: () => {
      advanced.push(1)
      const act = state.acts[state.actIndex]
      state.actIndex += 1
      shattered.behavior.actReveal(state, act, api)
    },
  }))
  assert.deepEqual(advanced, [1])
  assert.deepEqual(api.calls.finish, ['r1'], '非「重拾往昔」版本进入结局 1')
  shattered.behavior.resolution(state, 'r1', [], api)
  const victoryCodes = state.victoryDisplay.map(card => card.originalCode)
  assert.deepEqual(victoryCodes.sort(), ['04332', '04334', '04335'],
    '带胜利点的附属地点进入胜利区（姆大陆 1、纳克特 1、瓦卢西亚 1）')
})

test('幕 4 背面：控制「重拾往昔」的遗物时进入结局 5', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(29))
  state.scenarioFlags.relicCode = '04303'
  const api = makeApi(state)
  shattered.behavior.actReveal(state, state.acts[3], api)
  assert.deepEqual(api.calls.finish, ['r5'])
})

test('伊格的宽恕：接受条件会换成「失乐园」并放过蛇族', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(31))
  state.actIndex = 2
  const inv = state.investigators[0]
  inv.location = NEXUS
  const enemy = { id: 'e1', code: ICHTACA, originalCode: ICHTACA, name: '伊塔卡',
    location: NEXUS, health: 6, damageTaken: 0, exhausted: false, engagedSeat: 0 }
  state.enemies.push(enemy)
  state.nextChoice = 'accept'
  const api = makeApi(state)
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'parleyEnemy')
  assert.ok(move)
  shattered.behavior.performAction(state, inv, move, api)
  assert.deepEqual(api.calls.finish, [])
  assert.equal(state.acts[3].originalCode, PARADISE_LOST)
  assert.equal(state.scenarioFlags.serpentPassive, true)
  assert.equal(state.scenarioFlags.noParleyAlejandro, true)
  assert.equal(state.enemies.includes(enemy), false, '接受条件后卡牌从游戏中移除')
  assert.equal(state.scenarioZones.setAside.includes(PARADISE_LOST), false)
})

test('另有他法：接受亚历山卓的条件会换成「锁定时间」并放过异教徒', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(41))
  state.actIndex = 2
  const inv = state.investigators[0]
  const enemy = { id: 'e1', code: ALEJANDRO, originalCode: ALEJANDRO, name: '亚历山卓',
    location: NEXUS, health: 4, damageTaken: 0, exhausted: false, engagedSeat: null }
  state.enemies.push(enemy)
  state.nextChoice = 'accept'
  const api = makeApi(state)
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'parleyEnemy')
  shattered.behavior.performAction(state, inv, move, api)
  assert.equal(state.acts[3].originalCode, TIMELOCK)
  assert.equal(state.scenarioFlags.cultistPassive, true)
  assert.equal(state.scenarioFlags.noParleyIchtaca, true)
  assert.equal(state.enemies.includes(enemy), false)
})

test('另有他法：拒绝亚历山卓后本场冒险不能再与他谈判', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(37))
  state.actIndex = 2
  const inv = state.investigators[0]
  const enemy = { id: 'e1', code: ALEJANDRO, originalCode: ALEJANDRO, name: '亚历山卓',
    location: NEXUS, health: 4, damageTaken: 0, exhausted: false, engagedSeat: null }
  state.enemies.push(enemy)
  state.nextChoice = 'reject'
  state.nextTestResult = { success: true, value: 6, drawn: [] }
  const api = makeApi(state)
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'parleyEnemy')
  shattered.behavior.performAction(state, inv, move, api)
  assert.equal(state.scenarioFlags.noParleyAlejandro, true)
  assert.equal(enemy.exhausted, true)
  assert.equal(enemy.engagedSeat, null)
  assert.equal(state.acts[3].originalCode, MEND_THE_SHATTER, '拒绝不会换掉场景 4a')
  const again = shattered.behavior.actions(state, inv).some(entry => entry.rule === 'parleyEnemy')
  assert.equal(again, false)
})

test('密谋 1：洗回弃牌、把无形之子生成在联结点并带着复仇进入胜利区', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(41))
  state.encounterDiscard = ['04339']
  const api = makeApi(state)
  shattered.behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(api.calls.shuffledDiscard, 1)
  assert.deepEqual(api.calls.spawn, [{ code: FORMLESS_SPAWN, location: NEXUS }])
  assert.equal(state.victoryDisplay[0].vengeance, 1)
  assert.equal(state.scenarioZones.setAside.includes(FORMLESS_SPAWN), false)
})

test('密谋 2：无形之子在场时在联结点放 2 个毁灭；密谋 3 直接进入结局 4', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(43))
  state.enemies.push({ id: 'f1', code: FORMLESS_SPAWN, originalCode: FORMLESS_SPAWN,
    name: '无形之子', location: NEXUS, doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null })
  const api = makeApi(state)
  shattered.behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(byId(state, NEXUS).doom, 2)
  assert.equal(state.victoryDisplay[0].vengeance, 1)
  shattered.behavior.agendaReveal(state, state.agendas[2], api)
  assert.deepEqual(api.calls.finish, ['r4'])
  assert.equal(state.agendaIndex, 0, '密谋 3b 由 api.finish 结算，不在这里推进索引')
})

test('持有古代遗物的调查员退场时立即推进到密谋 3b', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(47))
  state.relicOfAges = { code: RELIC_AGES_UNLEASH, seat: 0, location: NEXUS }
  const api = makeApi(state)
  shattered.behavior.investigatorEliminated(state, state.investigators[0], 0, api)
  assert.equal(api.calls.advanceAgenda, 1)
  assert.equal(state.agendaIndex, 3)
  assert.deepEqual(api.calls.finish, ['r4'], '密谋 3b 是结局 4')
})

test('破碎的时代：检定失败时除联结点外每个地点各得 1 个线索', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(53))
  const before = Object.fromEntries(state.locations.map(location => [location.id, location.clues]))
  state.nextTestResult = { success: false, value: 0, drawn: [] }
  const api = makeApi(state)
  const treachery = shattered.scenario.treacheries['04339']
  shattered.behavior.resolveEncounter(state, state.investigators[0], treachery, api)
  for (const location of state.locations) {
    if (location.id === NEXUS) {
      assert.equal(location.clues, before[location.id], '联结点不受影响')
      continue
    }
    assert.equal(location.clues, before[location.id] + 1, location.id)
  }
})

test('异界之间：作为异界地点入场并连接联结点；轮末伤害与弃掉', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(59))
  const inv = state.investigators[0]
  const api = makeApi(state)
  const treachery = shattered.scenario.treacheries['04340']
  const handled = shattered.behavior.resolveEncounter(state, inv, treachery, api)
  assert.equal(handled, true, '作为地点留在场，不进弃牌堆')
  const created = state.locations.find(location => location.id.startsWith('betweenWorlds-'))
  assert.ok(created)
  assert.ok(created.connections.includes(NEXUS))
  assert.ok(byId(state, NEXUS).connections.includes(created.id))
  assert.equal(inv.location, created.id)
  assert.equal(created.clues, 1)
  shattered.behavior.roundEnded(state, api)
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  // 无人时：地点被弃掉，敌人被移回联结点。
  inv.location = NEXUS
  state.enemies.push({ id: 'x', code: '04338', name: '时间吞噬者', location: created.id,
    damageTaken: 0, exhausted: false, engagedSeat: null })
  shattered.behavior.roundEnded(state, api)
  assert.equal(state.locations.some(location => location.id === created.id), false)
  assert.equal(state.encounterDiscard.includes('04340'), true)
  assert.equal(state.enemies[0].location, NEXUS)
})

test('时空撕裂：破碎地点上的每位调查员都要检定意志(3)', () => {
  const state = placed(stateFor(3))
  shattered.behavior.setupLocations(state, [], setupApi(61))
  state.investigators[0].location = 'mu'
  state.investigators[1].location = 'valusia'
  state.investigators[2].location = NEXUS
  state.investigators[0].assets.push({ id: 'asset-1', code: '01020', originalCode: '01020' })
  state.nextTestResult = { success: false, value: 0, drawn: [] }
  const shuffled = []
  const api = makeApi(state, {
    // 模拟引擎：伤害先分配给支援，剩下的给调查员。
    damage: (seat, amount) => {
      const inv = state.investigators[seat]
      let remaining = amount
      for (const asset of inv.assets) {
        if (remaining <= 0) break
        asset.damage = (asset.damage || 0) + 1
        remaining -= 1
      }
      inv.damage += remaining
    },
    shuffleAssetIntoDeck: (seat, assetId) => { shuffled.push([seat, assetId]) },
  })
  shattered.behavior.resolveEncounter(state, state.investigators[0],
    shattered.scenario.treacheries['04341'], api)
  assert.deepEqual(api.calls.tests.map(entry => entry.seat).sort(), [0, 1])
  assert.equal(state.investigators[0].damage, 1, '1 点伤害由支援承受')
  assert.equal(state.investigators[1].damage, 2)
  assert.equal(state.investigators[2].damage, 0)
  assert.deepEqual(shuffled, [[0, 'asset-1']], '承受伤害且未被击败的支援被洗回牌库')
})

test('黑暗隐伏：附属联结点、放毁灭、提高无形之子生命值，火把可弃掉', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(67))
  const formless = { id: 'f1', code: FORMLESS_SPAWN, originalCode: FORMLESS_SPAWN, name: '无形之子',
    location: NEXUS, health: 10, doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null }
  state.enemies.push(formless)
  const api = makeApi(state)
  const handled = shattered.behavior.resolveEncounter(state, state.investigators[0],
    shattered.scenario.treacheries['04342'], api)
  assert.equal(handled, true)
  assert.equal(formless.health, 10 + 2 * 1, '+1[per_investigator]')
  const attachment = byId(state, NEXUS).attachments.find(entry => entry.code === '04342')
  assert.equal(attachment.doom, 1)
  const inv = state.investigators[0]
  state.campaign.supplies = { 0: ['torches'] }
  const moves = shattered.behavior.encounterActions(state, inv)
    .filter(move => move.rule === 'endCreepingDarkness')
  assert.equal(moves.length, 1)
  assert.equal(moves[0].actions, 2, '两次行动')
  shattered.behavior.performEncounterAction(state, inv, moves[0], api)
  assert.equal(byId(state, NEXUS).attachments.some(entry => entry.code === '04342'), false)
  assert.equal(formless.health, 10, '弃掉后生命值回退')
  // 第二张副本也能正常附属（不是白送一张遭遇），各自加生命。
  shattered.behavior.resolveEncounter(state, inv, shattered.scenario.treacheries['04342'], api)
  const beforeSecond = formless.health
  shattered.behavior.resolveEncounter(state, inv, shattered.scenario.treacheries['04342'], api)
  assert.equal(byId(state, NEXUS).attachments.filter(entry => entry.code === '04342').length, 2)
  assert.equal(formless.health, beforeSecond + 2, '每张副本各 +1[per_investigator]')
  const second = shattered.behavior.encounterActions(state, inv)
    .filter(move => move.rule === 'endCreepingDarkness').at(-1)
  shattered.behavior.performEncounterAction(state, inv, second, api)
  assert.equal(formless.health, beforeSecond, '只回退被弃掉那张的加成')
})

test('无形之子：生成在联结点、不能移动、攻防按联结点的毁灭标记加成', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(71))
  const api = makeApi(state)
  assert.equal(shattered.behavior.spawnLocation(state, FORMLESS_SPAWN, null, 0, api), NEXUS)
  const formless = { id: 'f1', code: FORMLESS_SPAWN, originalCode: FORMLESS_SPAWN, name: '无形之子',
    location: NEXUS, health: 10, doom: 0, damageTaken: 0, exhausted: false, engagedSeat: null }
  state.enemies.push(formless)
  byId(state, NEXUS).doom = 2
  state.enemies.push({ id: 'c1', code: '04095', originalCode: '04095', name: '异教徒',
    location: NEXUS, doom: 1, traits: ['Cultist'], damageTaken: 0, exhausted: false, engagedSeat: null })
  assert.equal(shattered.behavior.enemyStatModifier(state, formless, 'fight'), 3)
  assert.equal(shattered.behavior.enemyStatModifier(state, formless, 'evade'), 3)
  assert.equal(shattered.behavior.hunterMove(state, formless), true, '不能移动')
})

test('时间吞噬者：生成在最远的破碎地点，进入后在其上放 1 个线索', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(73))
  const inv = state.investigators[0]
  inv.location = NEXUS
  const api = makeApi(state)
  const spawnAt = shattered.behavior.spawnLocation(state, TEMPORAL_DEVOURER, null, 0, api)
  assert.ok(SHATTERED_LOCATIONS.includes(spawnAt), spawnAt)
  const enemy = { id: 't1', code: TEMPORAL_DEVOURER, originalCode: TEMPORAL_DEVOURER,
    name: '时间吞噬者', location: spawnAt, damageTaken: 0, exhausted: false, engagedSeat: null }
  state.enemies.push(enemy)
  const target = byId(state, spawnAt)
  const before = target.clues
  shattered.behavior.enemySpawned(state, enemy, api)
  assert.equal(target.clues, before + 1)
  // 场上没有破碎/异次元地点时，改为涌动（抽 1 张遭遇牌）。
  const empty = stateFor(1)
  shattered.behavior.setupLocations(empty, [], setupApi(79))
  empty.locations = [{ ...clone(empty.scenario.locations[NEXUS]), id: NEXUS, clues: 1 }]
  const api2 = makeApi(empty)
  assert.equal(shattered.behavior.spawnLocation(empty, TEMPORAL_DEVOURER, null, 0, api2), null)
  shattered.behavior.spawnFailed(empty, TEMPORAL_DEVOURER, 0, api2)
  assert.deepEqual(api2.calls.drawn.at(-1), [0, 'encounter'])
})

test('地点效果：联结点/时间之窗的移动惩罚、犹格斯星翻线索、亚特兰蒂斯与冷原', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(83))
  const inv = state.investigators[0]
  const api = makeApi(state)
  // 联结点 → 异界：每有 1 个线索受到 1 点恐惧。
  byId(state, 'yuggoth').clues = 3
  inv.tfaFromLocation = NEXUS
  inv.location = 'yuggoth'
  shattered.behavior.locationEntered(state, inv, byId(state, 'yuggoth'), api)
  assert.equal(inv.horror, 3)
  // 时间之窗 → 破碎：每有 1 个线索受到 1 点伤害。
  byId(state, 'mu').clues = 2
  inv.tfaFromLocation = POCKET
  inv.location = 'mu'
  shattered.behavior.locationEntered(state, inv, byId(state, 'mu'), api)
  assert.equal(inv.damage, 2)
  // 犹格斯星行动：翻 1 个线索为毁灭并抽 1 张卡。
  inv.location = 'yuggoth'
  const flip = shattered.behavior.actions(state, inv).find(move => move.rule === 'yuggothFlip')
  const clues = byId(state, 'yuggoth').clues
  shattered.behavior.performAction(state, inv, flip, api)
  assert.equal(byId(state, 'yuggoth').clues, clues - 1)
  assert.equal(byId(state, 'yuggoth').doom, 1)
  assert.deepEqual(api.calls.drawn.at(-1), [0, 1])
  // 亚特兰蒂斯：揭示自动失败标记后放毁灭，满 3 个移出游戏并「击败」此地敌人。
  const atlantis = byId(state, 'atlantis')
  atlantis.doom = 2
  const doomedEnemy = { id: 'e-atlantis', code: '04339', originalCode: '04339', name: '亚特兰蒂斯之敌',
    location: 'atlantis', health: 2, damageTaken: 0, exhausted: false, traits: ['Monster'] }
  state.enemies.push(doomedEnemy)
  shattered.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 2, skill: 'willpower', drawn: ['autofail'],
  }, api)
  assert.equal(atlantis.doom, 3)
  assert.equal(state.locations.includes(atlantis), false)
  assert.deepEqual(api.calls.defeatedEnemies, ['04339'], '敌人是被击败而不是弃掉')
  // 冷原：揭示旧神标记后受到 1 点恐惧。
  inv.location = 'plateauOfLeng'
  inv.horror = 0
  shattered.behavior.afterTest(state, inv, {
    success: true, value: 3, difficulty: 2, skill: 'willpower', drawn: ['elderthing'],
  }, api)
  assert.equal(inv.horror, 1)
})

test('姆大陆：每次检定的第一个符号标记揭示另一个标记', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(89))
  const inv = state.investigators[0]
  inv.location = 'mu'
  state.skillTest = {}
  const api = makeApi(state)
  const first = shattered.behavior.resolveChaosToken(state, inv, 'skull', api)
  assert.equal(first.drawAnother, true)
  const second = shattered.behavior.resolveChaosToken(state, inv, 'skull', api)
  assert.equal(second.drawAnother, undefined, '同一次检定只会再揭示一个')
  inv.location = NEXUS
  state.skillTest = {}
  const elsewhere = shattered.behavior.resolveChaosToken(state, inv, 'skull', api)
  assert.equal(elsewhere.drawAnother, undefined)
})

test('古代遗物（时光涌流）：探索结算诡计后把它洗回探索牌库而不是弃掉', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(97))
  state.scenarioFlags.relicCode = RELIC_AGES_UNLEASH
  state.relicOfAges = { code: RELIC_AGES_UNLEASH, seat: 0, location: NEXUS }
  state.encounterDiscard = ['04339']
  state.explorationDeck = ['yuggoth']
  const api = makeApi(state)
  shattered.behavior.afterExplore(state, state.investigators[0],
    { code: '04339', kind: 'encounter', runtime: api })
  assert.deepEqual(state.encounterDiscard, [])
  assert.ok(state.explorationDeck.includes('04339'), '诡计被洗回探索牌库')
  assert.equal(state.scenarioFlags.relicShuffledTreacheries, 1)
  // 遗物在场上但不受调查员控制（例如附属在时间之窗）也应生效。
  state.relicOfAges = { code: RELIC_AGES_UNLEASH, seat: null, location: NEXUS }
  state.encounterDiscard = ['04339']
  shattered.behavior.afterExplore(state, state.investigators[0],
    { code: '04339', kind: 'encounter', runtime: api })
  assert.deepEqual(state.encounterDiscard, [], '不受控制也洗回')
  // 遗物不在场时按正常流程弃掉。
  state.relicOfAges = null
  state.encounterDiscard = ['04339']
  shattered.behavior.afterExplore(state, state.investigators[0],
    { code: '04339', kind: 'encounter', runtime: api })
  assert.deepEqual(state.encounterDiscard, ['04339'])
})

test('结局写入战役记录、创伤与胜利区，并保持存档往返一致', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(101))
  state.scenarioFlags.relicUnderneath = [
    { id: 'mu', code: '04332', name: '姆大陆', victory: 1 },
    { id: 'ruinsOfNewYork', code: '04331', name: '纽约遗址', victory: 0 },
  ]
  const api = makeApi(state)
  const first = shattered.behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(first, { award: true, bonus: 5 })
  assert.equal(state.campaign.records.theInvestigatorsMendedTheTearInTheFabricOfTime, true)
  assert.equal(state.victoryDisplay.length, 1, '只有带胜利点的附属地点进入胜利区')
  assert.equal(state.victoryDisplay[0].originalCode, '04332')
  assert.ok(api.calls.info.filter(text => text.startsWith('trauma:')).length >= 2)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, state.campaign.records)
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)

  shattered.behavior.resolution(state, 'r2', [], api)
  assert.equal(state.campaign.records.theInvestigatorsSavedTheCivilizationOfTheSerpents, true)
  shattered.behavior.resolution(state, 'r3', [], api)
  assert.equal(state.campaign.records.theInvestigatorsSavedTheCivilizationOfTheYithians, true)
  const turned = shattered.behavior.resolution(state, 'r5', [], api)
  assert.equal(turned.bonus, 0)
  assert.equal(state.campaign.records.theInvestigatorsTurnedBackTime, true)
  assert.throws(() => shattered.behavior.resolution(state, 'r9', [], api))
  // 结局 2/3 不把附属地点放进胜利区（只有结局 1/5 才会）。
  const other = placed(stateFor(1))
  shattered.behavior.setupLocations(other, [], setupApi(111))
  other.scenarioFlags.relicUnderneath = [
    { id: 'valusia', code: '04335', name: '瓦卢西亚', victory: 1 },
  ]
  shattered.behavior.resolution(other, 'r2', [], api)
  assert.equal(other.victoryDisplay.length, 0)
})

test('无结局与结局 4：记录时间之布被拆解，每位调查员陷入疯狂', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(103))
  const api = makeApi(state)
  const result = shattered.behavior.resolution(state, 'noResolution', [], api)
  assert.deepEqual(result, { award: false, bonus: 0 })
  assert.equal(state.campaign.records.theFabricOfTimeIsUnwoven, true)
  assert.equal(state.investigators.every(inv => inv.defeated && inv.defeatCause === 'mental'), true)
  const other = placed(stateFor(1))
  shattered.behavior.setupLocations(other, [], setupApi(107))
  shattered.behavior.resolution(other, 'r4', [], api)
  assert.equal(other.campaign.records.theFabricOfTimeIsUnwoven, true)
})

test('幕 1 目标与代替幕的数据一致：4a 的两个版本都能被替换进场', () => {
  assert.equal(shattered.scenario.acts[0].objective.perInvestigator, 2)
  assert.equal(shattered.scenario.acts[1].objective.type, 'enterLocation')
  assert.equal(shattered.scenario.acts[1].objective.location, POCKET)
  assert.equal(ALTERNATE_ACTS[TIMELOCK].originalCode, TIMELOCK)
  assert.equal(ALTERNATE_ACTS[TIMELOCK].stage, '4a')
  assert.equal(ALTERNATE_ACTS[PARADISE_LOST].originalCode, PARADISE_LOST)
  assert.equal(shattered.scenario.agendas[0].doomThreshold, 6)
  assert.equal(shattered.scenario.agendas[1].doomThreshold, 7)
  assert.equal(shattered.scenario.agendas[2].doomThreshold, 12)
})

test('持有遗物的调查员退场不会重复触发密谋强制（无遗物者不触发）', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(109))
  const api = makeApi(state)
  shattered.behavior.investigatorEliminated(state, state.investigators[1], 0, api)
  assert.equal(api.calls.advanceAgenda, 0)
  assert.equal(state.agendaIndex, 0)
})

// ---------------------------------------------------------------------------
// 真实引擎冒烟：用官方 createGameState 布置本章，探索两次并推进场景 1。
// ---------------------------------------------------------------------------

const harnessPack = 'tfaShatteredHarnessPack'
const harnessCampaign = 'tfaShatteredHarness'
const harnessScenario = 'shatteredAeonsHarness'
registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: harnessPack, status: 'playable' }],
  campaigns: [{
    ...tfaCampaignManifest,
    id: harnessCampaign,
    name: '失落的时代（破碎永世冒烟）',
    status: 'playable',
    scenarioIds: [harnessScenario],
    unlock: { [harnessScenario]: [] },
    requiredPackIds: ['core', harnessPack],
    flow: {
      start: harnessScenario,
      nodes: {
        [harnessScenario]: { type: 'scenario', scenarioId: harnessScenario, next: 'end' },
        end: { type: 'end' },
      },
    },
  }],
  scenarios: [{
    scenario: { ...shattered.scenario, id: harnessScenario },
    behavior: { ...shattered.behavior, id: harnessScenario },
    manifest: {
      ...Object.fromEntries(Object.entries(shattered.manifest)
        .filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: harnessScenario,
      campaignId: harnessCampaign,
      status: 'playable',
      requiredPackIds: ['core', harnessPack],
      requiredEncounterGroupIds: [],
      behaviorIds: [harnessScenario],
    },
  }],
})

const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 600, `choice loop: ${state.pendingChoice?.kind}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

test('真实引擎：破碎永世开局后可探索、推进场景 1，并保持存档往返一致', () => {
  const state = createGameState({
    campaignId: harnessCampaign, seed: 'tfa-shattered-aeons-engine', playerInvestigator: '01001',
  }, [{ seat: 0 }])
  settle(state)
  assert.equal(state.status, 'playing')
  assert.equal(state.locations.length, 1, '开场只有恩凯联结点')
  assert.equal(state.locations[0].id, NEXUS)
  assert.equal(state.explorationDeck.length, 6)
  assert.equal(state.agendaIndex, 0)
  // 探索两次：第一次翻出地点，第二次翻出诡计或地点都行。
  for (let step = 0; step < 2; step++) {
    const explore = legalMoves(state).find(move => move.action === 'explore')
    assert.ok(explore, `第 ${step + 1} 次探索不可用`)
    applyMove(state, state.currentSeat, explore)
    settle(state)
    assert.equal(state.status, 'playing')
  }
  assert.equal(state.explorationDeck.length, 4)
  // 推进场景 1：共同支付 2×人数线索。
  for (const inv of state.investigators) inv.clues = 10
  const advance = legalMoves(state).find(move => move.action === 'advanceAct')
  assert.ok(advance, '线索足够时提供推进场景的行动')
  applyMove(state, state.currentSeat, advance)
  settle(state)
  assert.equal(state.actIndex, 1, '场景推进到搜寻兄弟会')
  assert.ok(state.explorationDeck.includes(POCKET), '时间之窗被洗入探索牌库')
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(restored.locations.map(location => location.id), state.locations.map(location => location.id))
})

test('真实引擎：本章四张诡计都能被引擎结算而不抛错', () => {  for (const code of ['04339', '04340', '04341', '04342']) {
    const state = createGameState({
      campaignId: harnessCampaign, seed: `tfa-shattered-encounter-${code}`, playerInvestigator: '01001',
    }, [{ seat: 0 }])
    settle(state)
    state.encounterDeck = [code]
    state.encounterDiscard = []
    for (let turn = 0; turn < 4 && state.status === 'playing'; turn++) {
      const endTurn = legalMoves(state).find(move => move.action === 'endTurn')
      if (!endTurn) break
      applyMove(state, state.currentSeat, endTurn)
      settle(state)
    }
    assert.equal(state.status, 'playing', `${code} 结算不应中断剧本`)
    const present = state.encounterDiscard.includes(code)
      || state.locations.some(location => location.originalCode === code
        || (location.attachments || []).some(entry => entry.code === code))
    assert.equal(present, true, `${code} 应被弃掉、附属于地点或作为地点入场`)
    const restored = JSON.parse(JSON.stringify(state))
    assert.deepEqual(restored.enemies.map(enemy => enemy.id), state.enemies.map(enemy => enemy.id))
  }
})

// ---------------------------------------------------------------------------
// P2：04320 伊斯人的遗物（控制遗物 → 推进 3a；遗物离场 → 重置到 3a）
// ---------------------------------------------------------------------------

test('04320：把遗物资产取得或打出即视为控制，场景 3a 可以推进', () => {
  const state = placed(stateFor(1))
  const act = state.scenario.acts.find(card => (card.originalCode || card.code) === '04320')
  state.acts = [state.acts[0], state.acts[1], clone(act)]
  state.actIndex = 2
  state.relicOfAges = null
  const inv = state.investigators[0]
  const api = makeApi(state)
  const asset = { id: 'relic04343', code: '04343', originalCode: '04343' }
  inv.assets.push(asset)
  shattered.behavior.assetEntered(state, inv, asset, api)
  assert.equal(state.relicOfAges.seat, 0, '打出遗物即写入控制者')
  shattered.behavior.checkObjectives(state, api)
  assert.ok(api.calls.advanceAct >= 1, '有调查员控制遗物时推进 3a')

  // 兜底路径：seat 尚未写入、但场上有遗物资产时也算控制。
  const fallback = placed(stateFor(1))
  const act2 = fallback.scenario.acts.find(card => (card.originalCode || card.code) === '04320')
  fallback.acts = [fallback.acts[0], fallback.acts[1], clone(act2)]
  fallback.actIndex = 2
  fallback.relicOfAges = null
  fallback.investigators[0].assets.push({ id: 'own', code: '04061', originalCode: '04061' })
  const api2 = makeApi(fallback)
  shattered.behavior.checkObjectives(fallback, api2)
  assert.ok(api2.calls.advanceAct >= 1, '手上有遗物资产也能推进')
})

test('04320 背面：遗物资产离场会清空控制者并把场景重置到 3a', () => {
  const state = placed(stateFor(1))
  const act = state.scenario.acts.find(card => (card.originalCode || card.code) === '04320')
  state.acts = [state.acts[0], state.acts[1], clone(act)]
  state.actIndex = 3
  state.explorationDeck = []
  const inv = state.investigators[0]
  const asset = { id: 'relic04343', code: '04343', originalCode: '04343' }
  const api = makeApi(state)
  state.relicOfAges = { code: '04343', seat: 0, location: inv.location }
  state.scenarioFlags.relicGuard = true
  state.scenarioFlags.relicWasControlled = true
  state.scenarioFlags.relicUnderneath = [{ id: 'pocket', name: '时间之窗' }]
  shattered.behavior.assetLeftPlay(state, inv, asset, api)
  assert.equal(state.relicOfAges.seat, null, '离场后不再有控制者')
  shattered.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2, '场景重置到 3a')
  assert.ok(state.explorationDeck.includes('pocket'), '附属地点洗回探索牌库')
  assert.ok(api.calls.info.some(text => text.includes('重置到 3a')))
})

test('04331 纽约遗址：入场把队长牌库顶的牌变成飞天水螅', () => {
  const build = count => {
    const state = placed(stateFor(count))
    state.campaign.leadSeat = 0
    const lead = state.investigators[0]
    lead.deck = count >= 3 ? ['01001', '01002', '01003'] : ['01001', '01002', '01003']
    state.locations.push({ ...clone(state.scenario.locations.ruinsOfNewYork), id: 'ruinsOfNewYork',
      revealed: true, clues: 3 })
    const location = state.locations.find(entry => entry.id === 'ruinsOfNewYork')
    const spawned = []
    const api = makeApi(state, {
      spawnStoryEnemy: (code, locationId, stats, extra) => {
        const enemy = { id: 'poly-' + spawned.length, code, location: locationId, damageTaken: 0, ...stats, ...extra }
        state.enemies.push(enemy)
        spawned.push(enemy)
        return enemy
      },
    })
    shattered.behavior.locationEntered(state, lead, location, api)
    return { state, lead, spawned }
  }

  const solo = build(1)
  assert.equal(solo.spawned.length, 1, '1-2 人时 1 张')
  const polyp = solo.spawned[0]
  assert.equal(polyp.fight, 2)
  assert.equal(polyp.health, 2)
  assert.equal(polyp.evade, 2)
  assert.equal(polyp.damage, 1)
  assert.ok(polyp.traits.includes('Monster'))
  assert.ok(polyp.underlyingCard, '正面朝下的牌记录在敌人上')
  assert.equal(solo.lead.deck.length, 2, '牌库顶少 1 张')
  assert.equal(solo.state.removedFromGame.includes('01003'), false, '牌作为敌人留在场上，不进 removedFromGame')

  const trio = build(3)
  assert.equal(trio.spawned.length, 2, '3-4 人时 2 张')
})

test('04314 混乱标记：遗物所在地的骷髅、困难面每个异教徒、困难面巫术总洗回', () => {
  const state = placed(stateFor(2))
  shattered.behavior.setupLocations(state, [], setupApi(101))
  state.difficulty = 'hard'
  const inv = state.investigators[0]
  inv.location = NEXUS
  state.relicOfAges = { code: RELIC_AGES_UNLEASH, seat: null, location: NEXUS }
  const api = makeApi(state)
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -5,
    '遗物在同一地点时困难面 -5')
  inv.location = 'yuggoth'
  assert.equal(shattered.behavior.resolveChaosToken(state, inv, 'skull', api).delta, -3)

  // 困难面 [cultist]：每个异教徒敌人都放 1 毁灭。
  const cultistA = { id: 'c1', code: '04095', originalCode: '04095', name: '异教徒甲', location: inv.location, traits: ['Cultist'], doom: 0 }
  const cultistB = { id: 'c2', code: '04095', originalCode: '04095', name: '异教徒乙', location: inv.location, traits: ['Cultist'], doom: 0 }
  state.enemies.push(cultistA, cultistB)
  shattered.behavior.afterTest(state, inv, { success: false, value: 0, difficulty: 2, skill: 'willpower', drawn: ['cultist'] }, api)
  assert.equal(cultistA.doom, 1)
  assert.equal(cultistB.doom, 1)

  // 困难面 [elderthing]：成功也把弃牌堆里的巫术洗回探索牌库。
  state.encounterDiscard = ['04341']
  state.explorationDeck = ['yuggoth']
  shattered.behavior.afterTest(state, inv, { success: true, value: 3, difficulty: 2, skill: 'willpower', drawn: ['elderthing'] }, api)
  assert.equal(state.encounterDiscard.includes('04341'), false)
  assert.ok(state.explorationDeck.includes('04341'))
})

test('04324/04330 的节点探索：复用引擎 explore 并临时忽略地点强制效果', () => {
  const state = placed(stateFor(1))
  shattered.behavior.setupLocations(state, [], setupApi(103))
  const inv = state.investigators[0]
  const node = state.locations.find(entry => ['04324', '04330'].includes(entry.originalCode || entry.code))
  assert.ok(node, '场上有联结点/时间之窗')
  inv.location = node.id
  state.explorationDeck = ['yuggoth']
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'exploreFromNode')
  assert.ok(move)
  const seen = []
  const api = makeApi(state, { explore: seat => seen.push([seat, state.scenarioFlags.ignoreNodeHazard]) })
  shattered.behavior.performAction(state, inv, move, api)
  assert.deepEqual(seen, [[0, true]], '探索过程中带 ignoreNodeHazard')
  assert.equal(state.scenarioFlags.ignoreNodeHazard, undefined, '结束后清理标记')
})

test('04061 古代遗物只保留一个版本', () => {
  const state = placed(stateFor(1))
  state.campaign.records.theInvestigatorsFoundTheMissingRelic = true
  const inv = state.investigators[0]
  inv.deck = ['04061', '04343']
  inv.hand = ['04303']
  inv.assets = [{ id: 'relic', code: '04343', originalCode: '04343' }]
  shattered.behavior.preScenarioSetup(state, [], { info: () => {} })
  assert.deepEqual(inv.deck, ['04061'], '保留找回的那份')
  assert.deepEqual(inv.hand, [])
  assert.equal(inv.assets.some(asset => asset.code === '04343'), false)
})

test('04342 黑暗隐伏：可在联结点用火把或意志检定弃掉', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  const spawn = { id: 'spawn', code: '04337', originalCode: '04337', name: '无形之子', health: 5, location: NEXUS, damageTaken: 0 }
  state.enemies.push(spawn)
  shattered.behavior.resolveEncounter(state, inv, { code: '04342', originalCode: '04342' }, makeApi(state))
  const nexus = state.locations.find(entry => entry.id === NEXUS)
  assert.equal(nexus.attachments.length, 1)
  assert.equal(spawn.health, 5 + state.numInvestigators)
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'endCreepingDarkness')
  assert.ok(move)
  assert.equal(move.actions, 2)
  shattered.behavior.performAction(state, inv, move, { info: () => {}, checkSupplies: () => true })
  assert.equal(nexus.attachments.length, 0)
  assert.equal(spawn.health, 5, '无形之子生命值回退')
})

test('04338 最远地点并列时由玩家选择', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  inv.location = 'a'
  state.locations = [
    { id: 'a', name: '联结点', connections: ['b', 'c'], clues: 0, traits: [] },
    { id: 'b', name: '破碎甲', connections: ['a'], clues: 0, traits: ['Shattered'] },
    { id: 'c', name: '破碎乙', connections: ['a'], clues: 0, traits: ['Shattered'] },
  ]
  const picked = shattered.behavior.spawnLocation(state, '04338', 'a', 0, { choose: () => 'c' })
  assert.equal(picked, 'c')
})

test('04327 犹格斯星：没有线索时不能发动翻面行动', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  state.locations = [{ id: 'yuggoth', originalCode: '04327', code: '04327', name: '犹格斯星', clues: 0, connections: [] }]
  inv.location = 'yuggoth'
  const move = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'yuggothFlip')
  assert.ok(move)
  assert.ok(move.reason, '没有线索时显示不可用原因')
  const draws = []
  shattered.behavior.performAction(state, inv, move, { info: () => {}, drawCards: (seat, n) => draws.push([seat, n]) })
  assert.equal(draws.length, 0, '没有线索不抽牌')
  state.locations[0].clues = 1
  const usable = shattered.behavior.actions(state, inv).find(entry => entry.rule === 'yuggothFlip')
  assert.equal(usable.reason, null)
  shattered.behavior.performAction(state, inv, usable, { info: () => {}, drawCards: (seat, n) => draws.push([seat, n]) })
  assert.deepEqual(draws, [[0, 1]])
  assert.equal(state.locations[0].doom, 1)
})

test('破碎永世标志位有读取者：describe 显示、起始手牌只减一次、时间之窗不重复洗入', () => {
  const state = placed(stateFor(1))
  const inv = state.investigators[0]
  inv.hand = ['01020', '01021', '01022']
  inv.deck = []
  const api = { info: () => {} }
  shattered.behavior.preScenarioSetup(state, [], api)
  assert.equal(inv.hand.length, 1)
  shattered.behavior.preScenarioSetup(state, [], api)
  assert.equal(inv.hand.length, 1, '重复布置不会再次 -2')
  const lines = shattered.behavior.describe(state)
  assert.ok(lines.some(text => text.includes('起始手牌已 -2')))
  state.scenarioFlags.pocketInDeck = true
  state.scenarioFlags.foundHexFromDiscard = ['04215']
  state.scenarioFlags.relicShuffledTreacheries = 2
  state.locations[0].polyps = 1
  const more = shattered.behavior.describe(state)
  assert.ok(more.some(text => text.includes('时间之窗在探索牌库')))
  assert.ok(more.some(text => text.includes('1 张巫术诡计')))
  assert.ok(more.some(text => text.includes('2 张遭遇牌')))
  assert.ok(more.some(text => text.includes('飞天水螅')))
  // 04318 背面重复揭示时时间之窗只洗入一次。
  state.explorationDeck = ['aPocketInTime']
  const act = { originalCode: '04318', code: '04318' }
  shattered.behavior.actReveal(state, act, api)
  shattered.behavior.actReveal(state, act, api)
  assert.equal(state.explorationDeck.filter(entry => entry === 'aPocketInTime').length, 1)
})
