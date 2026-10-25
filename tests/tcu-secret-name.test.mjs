// 隐秘之名（theSecretName · 05120）章节测试（P8 worker w-witch）。
//
// 两层证据：
//   1. 章节钩子（behavior）——setup/未知地点牌库、沃尔特房间的锁、幕/议程流程、混乱标记、
//      Nahab/Brown Jenkin 强制、结局/记录、存档往返；
//   2. 单卡条目（encounter-entries）——逐卡 actRule/agendaRule/locationRule/enemyRule/
//      treacheryRule 的规则行为（直接 import 单卡文件，不依赖 implementedFor）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import * as secretName from '../content/campaigns/theCircleUndone/scenarios/theSecretName/index.js'
import {
  scenario as definition, NAHAB, BROWN_JENKIN, THE_BLACK_BOOK, GHOSTLY_PRESENCE,
  STRANGE_GEOMETRY, SWARM_OF_RATS, UNKNOWN_PLACES,
} from '../content/campaigns/theCircleUndone/scenarios/theSecretName/definition.js'
import act1 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05125.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { createHaunted } from '../src/engine/haunted.js'
import { fixture, asset, legalMoves, validateMove, move, settle } from './core-fixture.mjs'
import act2 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05126.js'
import act3 from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05127.js'
import hermit from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05121.js'
import familiar from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05122.js'
import witchLight from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05123.js'
import marked from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05124.js'
import landlordRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05129.js'
import joeRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05130.js'
import earlierTonight from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05134.js'
import ruinsRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05137.js'
import salemRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05138.js'
import physicsRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05139.js'
import sacrificeRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05141.js'
import geometryRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05142.js'
import cityRoom from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05136.js'
import meddlesome from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05143.js'
import ghostly from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05144.js'
import visions from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05145.js'
import pulledByStars from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05146.js'
import disquieting from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05147.js'
import brownJenkinEntry from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05148.js'
import nahabEntry from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05149.js'
import blackBookEntry from '../src/cards/encounter-entries/theCircleUndone/theSecretName/05150.js'
import ratsEntry from '../src/cards/encounter-entries/shared/rats/01159.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(randomValue() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2) {
  return {
    scenario: clone(definition), acts: clone(definition.acts), agendas: clone(definition.agendas),
    actIndex: 0, agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'moldyHalls',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0, clues: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', '-1', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

function placeFromDefinition(state, id, { revealed = true } = {}) {
  const base = state.scenario.locations[id]
  if (!base) return null
  const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
  const location = { ...clone(base), id, revealed,
    clues: revealed ? clues : 0, maxClues: clues, doom: 0 }
  state.locations.push(location)
  return location
}

function setup(state, seed = 1) {
  secretName.behavior.setupLocations(state, [], setupApi(seed))
  const placed = ['moldyHalls', 'walterGilmansRoom', 'landlordsQuarters', 'joeMazurewiczsRoom', 'frankElwoodsRoom']
  for (const id of placed) placeFromDefinition(state, id, { revealed: id === 'moldyHalls' })
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const codeOf = card => card?.originalCode || card?.code

function apiStub(state, overrides = {}) {
  return {
    info: () => {}, choose: () => 'skip', random: () => 0.5,
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    healHorror: (seat, amount) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, doom: 0, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    place: (id) => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const location = { ...clone(base), id, revealed: false, clues: 0,
        maxClues: base.cluesPerInvestigator || 0, doom: 0 }
      state.locations.push(location)
      return location
    },
    remove: (id) => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    giveAsset: (seat, code) => { state.investigators[seat].assets.push({ id: `asset-${code}`, code }) },
    payClues: (n, location) => {
      let left = n
      for (const inv of state.investigators) {
        if (location && inv.location !== location) continue
        const spend = Math.min(inv.clues, left)
        inv.clues -= spend
        left -= spend
      }
    },
    drawCards: (seat, n) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < (n || 0); index++) {
        const card = inv.deck.length ? inv.deck.pop() : '01001'
        inv.hand.push(card)
      }
    },
    discardRandom: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    // 05137：参考实现用 investigateAbility（标准调查管线）；测试默认成功并回调 onInvestigateSuccess。
    investigate: (seat, options = {}) => {
      if (typeof options?.onInvestigateSuccess === 'function') {
        options.onInvestigateSuccess({ success: true, value: 9, difficulty: 4, skill: 'intellect' })
      }
      return true
    },
    // 05120/05144 的猎手移动：引擎 hunterStep 是纯计算；默认无目标，测试按需覆盖。
    hunterStep: () => null,
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => String(asset.id) !== String(assetId))
    },
    cosmoDraw: () => {},
    cosmos: ({ draw } = {}) => {
      const deck = state.extraLocationDecks?.unknownPlaces?.deck || []
      return Array.from({ length: draw || 0 }, () => deck.pop()).filter(Boolean)
    },
    threat: (seat, code, extra = {}) => { state.investigators[seat].threat.push({ id: `threat-${code}`, code, originalCode: code, ...extra }) },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    advanceAct: () => { state.actIndex += 1 },
    finish: key => { state.resolutionKey = key },
    shuffleEncounterDeck: () => {},
    campaignCard: (code, seat) => { state.campaign.investigators[seat].deck.push(code) },
    discoverClue: (seat, amount, locationId) => {
      const target = loc(state, locationId)
      if (target) { target.clues = Math.max(0, (target.clues || 0) - amount); state.investigators[seat].clues += amount }
    },
    hunterStep: (enemy) => { state.huntersMoved = (state.huntersMoved || 0) + 1 },
    attack: (enemy, inv) => { state.attacks = (state.attacks || 0) + 1; apiForAttack.push({ enemy, seat: inv.seat }) },
    locName: id => loc(state, id)?.name || id,
    ...overrides,
  }
}
const apiForAttack = []

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('05120 章节清单：playable、地点 16 实例 / 3 幕 / 4 议程 / 3 结局', () => {
  assert.equal(secretName.manifest.status, 'playable')
  assert.equal(secretName.manifest.campaignId, 'theCircleUndone')
  assert.equal(secretName.scenario.originalCode, '05120')
  assert.equal(secretName.manifest.locations.length, 16)
  assert.deepEqual(secretName.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(secretName.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3', 'agenda4'])
  assert.deepEqual(secretName.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(secretName.manifest.startLocationId, 'moldyHalls')
  assert.ok(secretName.manifest.zones.encounterDeck.some(entry => entry.cardCode === SWARM_OF_RATS))
})

test('身份登记：地点/幕/议程/敌人/剧情资产都有原卡身份且 mapped', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'storyAssets']) {
    for (const [id, identity] of Object.entries(secretName.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(secretName.identities.enemies[NAHAB].originalCode, NAHAB)
  assert.equal(secretName.identities.storyAssets[THE_BLACK_BOOK].originalCode, THE_BLACK_BOOK)
})

// ---------------------------------------------------------------------------
// 2. setup / 未知地点牌库 / 锁
// ---------------------------------------------------------------------------
test('setup：未知地点牌库 7 张（底部巫宅遗址 + 3 随机，顶部 3 随机），放一边 8 张（詹金在遭遇牌库）', () => {
  const state = setup(stateFor(2), 5)
  const deck = state.extraLocationDecks.unknownPlaces.deck
  assert.equal(deck.length, 7)
  assert.equal(new Set(deck).size, 7)
  assert.ok(deck.slice(0, 4).includes('witchHouseRuins'), '巫宅遗址在牌库底部 4 张里')
  assert.deepEqual([...[...UNKNOWN_PLACES, 'witchHouseRuins']].sort(), [...deck].sort())
  const aside = state.scenarioZones.setAside
  for (const code of [NAHAB, THE_BLACK_BOOK, GHOSTLY_PRESENCE, GHOSTLY_PRESENCE, '05141', '05133', STRANGE_GEOMETRY, STRANGE_GEOMETRY]) {
    assert.ok(aside.includes(code), `放一边缺少 ${code}`)
  }
  // 参考 setupTheSecretName：布朗·詹金不在 set aside，随遭遇牌库入场（findEncounterCard 找）。
  assert.equal(aside.includes(BROWN_JENKIN), false)
  assert.equal(state.investigators.map(inv => inv.location).join(','), 'moldyHalls,moldyHalls')
})

test('setup 确定性：同种子未知地点牌库一致、不同种子不同', () => {
  assert.deepEqual(setup(stateFor(2), 11).extraLocationDecks, setup(stateFor(2), 11).extraLocationDecks)
  assert.notDeepEqual(setup(stateFor(2), 11).extraLocationDecks, setup(stateFor(2), 12).extraLocationDecks)
})

test('沃尔特·吉尔曼的房间：线索不够时 entryError 阻止进入，够时 beforeMove 支付团队线索', () => {
  const state = setup(stateFor(2), 17)
  const inv = state.investigators[0]
  inv.clues = 0
  state.investigators[1].clues = 1
  assert.equal(typeof secretName.behavior.investigatorEntryError(state, loc(state, 'walterGilmansRoom'), inv), 'string')
  inv.clues = 2
  state.investigators[1].clues = 0
  let paid = null
  secretName.behavior.beforeMove(state, inv, loc(state, 'walterGilmansRoom'),
    apiStub(state, { payClues: (n, location) => { paid = { n, location } } }))
  assert.deepEqual(paid, { n: 2, location: 'moldyHalls' })
  assert.equal(state.scenarioFlags.walterLockPaid, true)
})

test('印刷符号图与揭示面：破旧房门揭示后换符号；未知地点揭示后按新符号重连', () => {
  const state = setup(stateFor(2), 19)
  const moldy = loc(state, 'moldyHalls')
  assert.ok(moldy.connections.includes('landlordsQuarters'))
  assert.ok(moldy.connections.includes('walterGilmansRoom'))
  const landlord = loc(state, 'landlordsQuarters')
  assert.equal(landlord.name, '破旧房门')
  landlord.revealed = true
  secretName.behavior.locationRevealed(state, landlord, apiStub(state))
  assert.equal(landlord.name, '屋主的住处')
  assert.equal(landlord.symbols.front.symbol, 'circle')
  assert.ok(landlord.connections.includes('moldyHalls'))
  assert.ok(!landlord.connections.includes('joeMazurewiczsRoom'), '揭示后不再与另两张破旧房门互连')
})

// ---------------------------------------------------------------------------
// 3. 幕
// ---------------------------------------------------------------------------
test('act1 背面：换成凯夏的房间（带上标记/卡牌）、移除其他地点、黑书归属、洗入 2 张古怪图形', () => {
  const state = setup(stateFor(2), 23)
  state.encounterDeck = []
  const walter = loc(state, 'walterGilmansRoom')
  walter.clues = 2
  walter.doom = 1
  walter.attachments = ['05093']
  state.playerLocationAttachments = [{ location: 'walterGilmansRoom', code: '05146', ownerSeat: 0 }]
  const atWalter = { id: 'e1', code: '05090', originalCode: '05090', name: '敌人A', location: 'walterGilmansRoom', engagedSeat: null }
  const atMoldy = { id: 'e2', code: '05090', originalCode: '05090', name: '敌人B', location: 'moldyHalls', engagedSeat: null }
  state.enemies.push(atWalter, atMoldy)
  const api = apiStub(state)
  act1.actRule.onReveal(state, state.acts[0], api)
  assert.deepEqual(state.locations.map(location => location.id), ['keziahsRoom'])
  assert.ok(state.investigators.every(inv => inv.location === 'keziahsRoom'))
  // swapLocation：原地点上的 token 与卡牌一起带到新地点。
  assert.equal(loc(state, 'keziahsRoom').clues, 2)
  assert.equal(loc(state, 'keziahsRoom').doom, 1)
  assert.deepEqual(loc(state, 'keziahsRoom').attachments, ['05093'])
  assert.equal(state.playerLocationAttachments[0].location, 'keziahsRoom')
  // 原地点上的敌人搬到新地点；其他被移除地点上的敌人弃到遭遇弃牌堆。
  assert.equal(atWalter.location, 'keziahsRoom')
  assert.equal(state.enemies.includes(atMoldy), false)
  assert.ok(state.encounterDiscard.includes('05090'))
  const owner = state.investigators.find(inv => (inv.assets || []).some(asset => codeOf(asset) === THE_BLACK_BOOK))
  assert.ok(owner, '有调查员控制了黑书')
  assert.equal(state.encounterDeck.filter(code => code === STRANGE_GEOMETRY).length, 2)
  assert.equal(state.scenarioZones.setAside.includes(THE_BLACK_BOOK), false)
})

test('act1/act2 团队线索推进：满足条件时出现脚本行动并支付推进', () => {
  const state = setup(stateFor(2), 29)
  const inv = state.investigators[0]
  // act1 目标：所有未被击败的调查员都必须在沃尔特·吉尔曼的房间（卡面）。
  for (const other of state.investigators) other.location = 'walterGilmansRoom'
  inv.clues = 6
  const moves = secretName.behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'advanceInvestigatingTheWitchHouse'))
  let advanced = 0
  secretName.behavior.performAction(state, inv, { rule: 'advanceInvestigatingTheWitchHouse' },
    apiStub(state, { advanceAct: () => { advanced += 1 } }))
  assert.equal(advanced, 1)
  assert.equal(inv.clues, 0, '团队支付 3×人数线索')

  state.actIndex = 1
  placeFromDefinition(state, 'witchHouseRuins')
  inv.location = 'witchHouseRuins'
  inv.clues = 10
  const moves2 = secretName.behavior.actions(state, inv)
  assert.ok(moves2.some(move => move.rule === 'advanceBeyondTheWitchHouse'))
})

test('act2 背面：放置献祭场所、那赫卜 +2 毁灭、布朗·詹金放在那赫卜所在地点', () => {
  const state = setup(stateFor(2), 31)
  state.actIndex = 1
  state.encounterDeck.push(BROWN_JENKIN)
  const taken = []
  const api = apiStub(state, { spawn: (code, location) => { taken.push({ code, location }); return null } })
  act2.actRule.onReveal(state, state.acts[1], api)
  assert.ok(loc(state, 'siteOfTheSacrifice'))
  assert.deepEqual(taken.map(entry => entry.code), [NAHAB, BROWN_JENKIN])
  assert.equal(taken[0].location, 'siteOfTheSacrifice')
  assert.equal(state.encounterDeck.includes(BROWN_JENKIN), false, '詹金从遭遇牌库被找出')
})

test('act3 目标：那赫卜上有毁灭时不推进，无毁灭时推进', () => {
  const state = setup(stateFor(1), 37)
  state.actIndex = 2
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', doom: 1, engagedSeat: null }
  state.enemies.push(nahab)
  let advanced = 0
  secretName.behavior.checkObjectives(state, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 0)
  nahab.doom = 0
  secretName.behavior.checkObjectives(state, { advanceAct: () => { advanced += 1 } })
  assert.equal(advanced, 1)
})

test('act3 背面 → 结局 2；act4 议程背面 → 结局 1', () => {
  const state = setup(stateFor(1), 41)
  act3.actRule.onReveal(state, state.acts[2], apiStub(state))
  assert.equal(state.resolutionKey, 'resolution2')
  marked.agendaRule.onReveal(state, state.agendas[3], apiStub(state))
  assert.equal(state.resolutionKey, 'resolution1')
})

// ---------------------------------------------------------------------------
// 4. 议程
// ---------------------------------------------------------------------------
test('agenda1 背面：詹金在场找鼠群生成在他地点；不在场则从牌库找出詹金；≥3 人再在巫宅地点生成一只', () => {
  const state = setup(stateFor(3), 43)
  placeFromDefinition(state, 'witchHouseRuins')
  state.enemies.push({ id: 'bj', code: BROWN_JENKIN, originalCode: BROWN_JENKIN, name: '布朗·詹金', location: 'moldyHalls', engagedSeat: null })
  state.encounterDiscard = ['01166', SWARM_OF_RATS, SWARM_OF_RATS]
  const spawned = []
  const api = apiStub(state, { spawn: (code, location) => { spawned.push({ code, location }); return null } })
  hermit.agendaRule.onReveal(state, state.agendas[0], api)
  assert.equal(spawned.filter(entry => entry.code === SWARM_OF_RATS).length, 2)
  assert.equal(spawned[0].location, 'moldyHalls', '第一只鼠群在詹金所在地点')
  assert.ok(spawned[1].location === 'moldyHalls' || spawned[1].location === 'witchHouseRuins',
    '3–4 人的第二只鼠群生成在某个巫宅地点')

  // 布朗·詹金不在场：从遭遇牌库找出他（不是从 set aside 凭空生成），找到后 2 人局不再额外找鼠群。
  const missing = setup(stateFor(2), 44)
  missing.encounterDeck = ['01166', BROWN_JENKIN]
  const leadLocation = missing.investigators[0].location
  const found = []
  hermit.agendaRule.onReveal(missing, missing.agendas[0], apiStub(missing, {
    spawn: (code, location) => { found.push({ code, location }); return null },
  }))
  assert.deepEqual(found, [{ code: BROWN_JENKIN, location: leadLocation }])
  assert.equal(missing.encounterDeck.includes(BROWN_JENKIN), false)

  // 詹金与鼠群都不在牌库/弃牌堆：什么都不生成（参考 findEncounterCard 语义）。
  const empty = setup(stateFor(2), 45)
  const none = []
  hermit.agendaRule.onReveal(empty, empty.agendas[0], apiStub(empty, {
    spawn: (code, location) => { none.push({ code, location }); return null },
  }))
  assert.deepEqual(none, [])
})

test('议程反应：击败詹金/那赫卜后由击败者选择是否获得线索（1 或 ≥3 人 2）', () => {
  const state = setup(stateFor(2), 46)
  const jenkin = { id: 'bj', code: BROWN_JENKIN, originalCode: BROWN_JENKIN, name: '布朗·詹金',
    location: 'moldyHalls', defeatedBy: 1, engagedSeat: null }
  state.enemies.push(jenkin)
  state.enemies = state.enemies.filter(enemy => enemy !== jenkin)
  secretName.behavior.enemyDefeated(state, jenkin, apiStub(state, { choose: () => 'use' }))
  assert.equal(state.investigators[1].clues, 1, '线索给击败者（座位 1）')
  assert.equal(state.investigators[0].clues, 0)

  // 可以放弃。
  const pass = setup(stateFor(2), 47)
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜',
    location: 'moldyHalls', defeatedBy: 0, engagedSeat: null }
  pass.enemies.push(nahab)
  secretName.behavior.enemyDefeated(pass, nahab, apiStub(pass, { choose: () => 'skip' }))
  assert.equal(pass.investigators[0].clues, 0)

  // 3 人局：2 个线索。
  const three = setup(stateFor(3), 48)
  const jenkin3 = { id: 'bj', code: BROWN_JENKIN, originalCode: BROWN_JENKIN, name: '布朗·詹金',
    location: 'moldyHalls', defeatedBy: 2, engagedSeat: null }
  three.enemies.push(jenkin3)
  secretName.behavior.enemyDefeated(three, jenkin3, apiStub(three, { choose: () => 'use' }))
  assert.equal(three.investigators[2].clues, 2)
})

test('agenda2 背面：按幕放置那赫卜、洗入 2 张鬼影骤现、布朗·詹金放到那赫卜地点', () => {
  const state = setup(stateFor(2), 51)
  state.encounterDeck = [BROWN_JENKIN]
  const api = apiStub(state)
  familiar.agendaRule.onReveal(state, state.agendas[1], api)
  assert.ok(state.enemies.some(enemy => codeOf(enemy) === NAHAB && enemy.location === 'walterGilmansRoom'))
  assert.equal(state.encounterDeck.filter(code => code === GHOSTLY_PRESENCE).length, 2)
  const jenkin = state.enemies.find(enemy => codeOf(enemy) === BROWN_JENKIN)
  const nahab = state.enemies.find(enemy => codeOf(enemy) === NAHAB)
  assert.equal(jenkin.location, nahab.location)
  assert.equal(state.encounterDeck.includes(BROWN_JENKIN), false, '詹金从遭遇牌库被找出')
})

test('agenda3 背面：幕 1/2 把那赫卜放回场外并为密谋 4a 预留 4 毁灭；幕 3 放 1 毁灭', () => {
  const early = setup(stateFor(1), 53)
  early.agendaIndex = 2
  early.enemies.push({ id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', doom: 0, engagedSeat: null })
  witchLight.agendaRule.onReveal(early, early.agendas[2], apiStub(early))
  assert.equal(early.enemies.some(enemy => codeOf(enemy) === NAHAB), false)
  // 4 毁灭不在揭示时预写（密谋 4a 尚未入场），而是留待 agendaChain 在其入场时放。
  assert.deepEqual(early.scenarioFlags.pendingAgendaDoom, { code: '05124', amount: 4 })
  assert.equal(early.agendas[3].doom || 0, 0)
  secretName.behavior.agendaChain(early, early.agendas[3], apiStub(early))
  assert.equal(early.agendas[3].doom, 4)
  assert.equal(early.scenarioFlags.pendingAgendaDoom, undefined)
  // 非 05124 的议程入场不会错误消费标记。
  const other = setup(stateFor(1), 54)
  other.scenarioFlags.pendingAgendaDoom = { code: '05124', amount: 4 }
  secretName.behavior.agendaChain(other, other.agendas[2], apiStub(other))
  assert.equal(other.agendas[2].doom || 0, 0)
  assert.ok(other.scenarioFlags.pendingAgendaDoom)

  const late = setup(stateFor(1), 59)
  late.actIndex = 2
  late.agendaIndex = 2
  late.enemies.push({ id: 'n2', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', doom: 0, engagedSeat: null })
  witchLight.agendaRule.onReveal(late, late.agendas[2], apiStub(late))
  assert.equal(late.enemies.find(enemy => codeOf(enemy) === NAHAB).doom, 1)
})

// ---------------------------------------------------------------------------
// 5. 敌人
// ---------------------------------------------------------------------------
test('Nahab：攻击值 + 密谋编号；敌军阶段开始若重整放 1 毁灭', () => {
  const state = setup(stateFor(1), 61)
  state.agendaIndex = 2
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', doom: 0, exhausted: false, engagedSeat: null, traits: ['Witch'] }
  state.enemies.push(nahab)
  assert.equal(secretName.behavior.enemyStatModifier(state, nahab, 'fight'), 3)
  secretName.behavior.enemyPhaseStart(state, apiStub(state))
  assert.equal(nahab.doom, 1)
})

test('act3：那赫卜被击败时不弃掉，改为治愈/横置/解除交战/本轮不重整并给击败者奖励线索', () => {
  const state = setup(stateFor(2), 67)
  state.actIndex = 2
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls',
    doom: 2, exhausted: false, engagedSeat: 0, damageTaken: 3, defeatedBy: 0, traits: ['Witch'] }
  state.investigators[0].engaged = ['n1']
  state.enemies.push(nahab)
  // 允许正常击败（引擎随后移除敌人并调用 enemyDefeated，由章节实现「替代弃掉」）。
  assert.equal(secretName.behavior.enemyCanBeDefeated(state, nahab, null, 0), true)
  state.enemies = state.enemies.filter(enemy => enemy !== nahab)
  const api = apiStub(state, { choose: () => 'use' })
  const replaced = secretName.behavior.enemyDefeated(state, nahab, api)
  assert.equal(replaced, true, '不走胜利区')
  assert.ok(state.enemies.includes(nahab), '放回场上')
  assert.equal(nahab.damageTaken, 0)
  assert.equal(nahab.exhausted, true)
  assert.equal(nahab.engagedSeat, null)
  assert.deepEqual(nahab.preventReady, { from: state.round, rounds: 1 })
  assert.equal(state.investigators[0].clues, 1, '2 人时奖励 1 线索（≥3 人才是 2）')
  // act3 起 immobile（不能离开献祭场所），离开 act3 后恢复。
  assert.equal(nahab.immobile, true)
  state.actIndex = 1
  secretName.behavior.checkObjectives(state, apiStub(state, { advanceAct: () => {} }))
  assert.equal(nahab.immobile, false)
})

test('Brown Jenkin：非弱点敌人 + 当前密谋编号生命；重整生物敌人 +2 攻击；敌军阶段结束弃手牌再抽', () => {
  const state = setup(stateFor(2), 71)
  state.agendaIndex = 1
  const jenkin = { id: 'bj', code: BROWN_JENKIN, originalCode: BROWN_JENKIN, name: '布朗·詹金',
    location: 'moldyHalls', exhausted: false, engagedSeat: null, traits: ['Creature'] }
  state.enemies.push(jenkin)
  const generic = { id: 'e1', code: '05090', name: '女巫', location: 'moldyHalls', exhausted: false, traits: ['Witch'] }
  assert.equal(secretName.behavior.enemyStatModifier(state, generic, 'health'), 2)
  const creature = { id: 'e2', code: '05090', name: '生物', location: 'moldyHalls', exhausted: false, traits: ['Creature'] }
  assert.equal(secretName.behavior.enemyStatModifier(state, creature, 'fight'), 2)
  state.investigators[0].hand = ['01001', '01002']
  secretName.behavior.enemyPhaseEnd(state, apiStub(state))
  assert.equal(state.investigators[0].hand.length, 2, '弃掉所有手牌后抽等量')
  assert.equal(brownJenkinEntry.enemyRule.hunter, true)
})

test('条目声明：布朗·詹金/那赫卜/鼠群/黑书 implemented', () => {
  assert.equal(brownJenkinEntry.implemented, true)
  assert.equal(nahabEntry.implemented, true)
  assert.equal(ratsEntry.implemented, true)
  assert.equal(blackBookEntry.implemented, true)
})

// ---------------------------------------------------------------------------
// 6. 诡计（单卡条目）
// ---------------------------------------------------------------------------
test('05143 好事魔宠：布朗·詹金不在场时从遭遇牌库找出他并造成 1 伤；找不到时只造成 1 伤', () => {
  const state = setup(stateFor(1), 73)
  state.encounterDeck.push(BROWN_JENKIN)
  const api = apiStub(state)
  meddlesome.encounterResolve(state, state.investigators[0], { code: '05143' }, api)
  assert.equal(state.enemies.some(enemy => codeOf(enemy) === BROWN_JENKIN), true)
  assert.equal(state.investigators[0].damage, 1)

  // 牌库/弃牌堆都没有詹金：不凭空生成，伤害照常。
  const missing = setup(stateFor(1), 74)
  meddlesome.encounterResolve(missing, missing.investigators[0], { code: '05143' }, apiStub(missing))
  assert.equal(missing.enemies.length, 0)
  assert.equal(missing.investigators[0].damage, 1)
})

test('05144 鬼影骤现：那赫卜只从遭遇牌库/弃牌堆找出；在场时重整、结算猎手并攻击同地点调查员', () => {
  // 仅 set aside 中的那赫卜：不在「遭遇牌库和弃牌堆」里，不生成（参考 findEncounterCard 语义）。
  const asideOnly = setup(stateFor(1), 79)
  asideOnly.scenarioZones.setAside.push(NAHAB)
  ghostly.encounterResolve(asideOnly, asideOnly.investigators[0], { code: '05144' }, apiStub(asideOnly))
  assert.equal(asideOnly.enemies.length, 0)

  // 弃牌堆中的那赫卜：取出并生成在你所在地点。
  const fromDiscard = setup(stateFor(1), 80)
  fromDiscard.encounterDiscard.push(NAHAB)
  ghostly.encounterResolve(fromDiscard, fromDiscard.investigators[0], { code: '05144' }, apiStub(fromDiscard))
  assert.ok(fromDiscard.enemies.some(enemy => codeOf(enemy) === NAHAB
    && enemy.location === fromDiscard.investigators[0].location))

  // 在场：重整 + 猎手移动一步（api.hunterStep 纯计算，内容执行移动）+ 攻击同地点每位调查员。
  const state = setup(stateFor(2), 81)
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'walterGilmansRoom',
    exhausted: true, engagedSeat: null, hunter: true, doom: 0, traits: ['Witch'] }
  state.enemies.push(nahab)
  apiForAttack.length = 0
  ghostly.encounterResolve(state, state.investigators[0], { code: '05144' }, apiStub(state, {
    hunterStep: enemy => (enemy === nahab ? 'moldyHalls' : null),
  }))
  assert.equal(nahab.exhausted, false)
  assert.equal(nahab.location, 'moldyHalls', '结算猎手关键词：向调查员移动一步后再攻击')
  assert.equal(apiForAttack.length, 2, '攻击同地点每位调查员')

  // immobile（act3 不能离开献祭场所）时不移动。
  const pinned = setup(stateFor(1), 82)
  const chained = { id: 'n2', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'siteOfTheSacrifice',
    exhausted: false, engagedSeat: null, hunter: true, immobile: true, doom: 0, traits: ['Witch'] }
  pinned.enemies.push(chained)
  ghostly.encounterResolve(pinned, pinned.investigators[0], { code: '05144' }, apiStub(pinned, {
    hunterStep: () => 'moldyHalls',
  }))
  assert.equal(chained.location, 'siteOfTheSacrifice')
  assert.equal(chained.doom, 1, '位于献祭场所再放 1 毁灭')
})

test('05145 异次元幻象：难度 = 2 + 遭遇弃牌堆每 10 张 +1，失败弃支援', () => {
  const state = setup(stateFor(1), 83)
  state.encounterDiscard = Array.from({ length: 23 }, () => '01166')
  state.investigators[0].assets.push({ id: 'a1', code: '01001' })
  let difficulty = null
  const api = apiStub(state, {
    test: (seat, skill, value, resolve) => { difficulty = value; resolve({ success: false, value: 0, difficulty: value, skill }) },
    choose: () => 'a1',
  })
  visions.encounterResolve(state, state.investigators[0], { code: '05145' }, api)
  assert.equal(difficulty, 4)
  assert.equal(state.investigators[0].assets.length, 0)
})

test('05146 群星牵引：进入威胁区；本回合未移动则回合结束受 2 恐惧（只算自己回合内的移动）', () => {
  const state = setup(stateFor(1), 89)
  const inv = state.investigators[0]
  const api = apiStub(state)
  pulledByStars.encounterResolve(state, inv, { code: '05146' }, api)
  assert.equal(inv.threat.length, 1)
  // 神话阶段/别人回合的效果位移不计入「本回合移动过」。
  state.phase = 'mythos'
  secretName.behavior.locationEntered(state, inv)
  assert.ok(!inv.tcuMovedThisTurn)
  secretName.behavior.turnEnded(state, inv, api)
  assert.equal(inv.horror, 2)
  assert.equal(pulledByStars.threatAction.rule, 'discardPulledByTheStars')
  // 自己回合内的移动才计入：本回合移动过 → 回合结束不受。
  state.phase = 'investigation'
  state.currentSeat = inv.seat
  secretName.behavior.locationEntered(state, inv)
  assert.equal(inv.tcuMovedThisTurn, true)
  secretName.behavior.turnEnded(state, inv, api)
  assert.equal(inv.horror, 2, '移动过则不再受 2 恐惧')
})

test('05147 不安的梦：意志(5)失败放入威胁区；回合结束弃遭遇牌库顶；牌库耗尽时弃本卡并揭示牌堆顶 10 张', () => {
  const state = setup(stateFor(1), 97)
  const inv = state.investigators[0]
  const api = apiStub(state)
  disquieting.encounterResolve(state, inv, { code: '05147' }, api)
  assert.equal(inv.threat.length, 1)
  state.encounterDeck = ['01166', '05092']
  secretName.behavior.turnEnded(state, inv, api)
  assert.equal(state.encounterDeck.length, 1)
  assert.equal(state.encounterDiscard.length, 1)

  // 遭遇牌库由有到无 → 强制：弃本卡 + 揭示拥有者牌库顶 10 张，弱点进手牌、其余进弃牌堆。
  const exhausted = setup(stateFor(1), 98)
  const owner = exhausted.investigators[0]
  disquieting.encounterResolve(exhausted, owner, { code: '05147' }, apiStub(exhausted, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }),
  }))
  owner.deck = ['01001', '01165', '01020', '01021', '01022', '01023', '01024', '01025', '01026', '10135']
  exhausted.encounterDeck = ['01166']
  const drainApi = apiStub(exhausted, {
    drawCards: (seat, n) => {
      for (let index = 0; index < n; index++) owner.hand.push(owner.deck.pop())
    },
  })
  // 抽牌后遭遇牌库为 0：behavior.encounterDrawn（共享钩子）立即结算「牌库耗尽」。
  exhausted.encounterDeck.pop()
  secretName.behavior.encounterDrawn(exhausted, owner, '01166', drainApi)
  assert.equal(owner.threat.some(threat => codeOf(threat) === '05147'), false, '弃掉不安的梦')
  assert.ok(exhausted.encounterDiscard.includes('05147'))
  assert.equal(owner.hand.filter(code => ALL_CARDS[code]?.subtype === 'weakness'
    || ALL_CARDS[code]?.subtype === 'basicweakness').length, 1, '10 张里的 1 张弱点进手牌')
  assert.equal(owner.hand.length, 1)
  assert.equal(owner.deck.length, 0, '弱点被抽走后牌库恢复为 0')
})

// ---------------------------------------------------------------------------
// 7. 地点条目
// ---------------------------------------------------------------------------
test('05129 屋主的住处：揭示后找出鼠群生成在发霉的走道', () => {
  const state = setup(stateFor(1), 101)
  state.encounterDiscard = [SWARM_OF_RATS]
  const spawned = []
  landlordRoom.locationRule.onReveal(state, loc(state, 'landlordsQuarters'),
    apiStub(state, { spawn: (code, location) => spawned.push({ code, location }) }))
  assert.deepEqual(spawned, [{ code: SWARM_OF_RATS, location: 'moldyHalls' }])
})

test('05130 乔的房间：每场一次检索祝福/道具支援加入手牌', () => {
  const state = setup(stateFor(1), 103)
  const inv = state.investigators[0]
  inv.location = 'joeMazurewiczsRoom'
  inv.deck = ['01020', '01021']
  const moves = []
  joeRoom.locationRule.actions({ moves, state, inv, location: loc(state, 'joeMazurewiczsRoom') })
  assert.deepEqual(moves.map(move => move.rule), ['joeSearchBlessed'])
  joeRoom.locationRule.performAction(state, inv, { rule: 'joeSearchBlessed' }, apiStub(state))
  assert.equal(state.scenarioFlags.joeSearchUsed, true)
  assert.ok(inv.hand.length <= 1)
})

test('05134 今晚早些时候：向过去的自己求助把弃牌返回手牌并把「沉湎过去」写进战役记录', () => {
  const state = setup(stateFor(1), 107)
  const inv = state.investigators[0]
  placeFromDefinition(state, 'moldyHallsEarlierTonight')
  inv.location = 'moldyHallsEarlierTonight'
  inv.discard = ['01001']
  earlierTonight.locationRule.performAction(state, inv, { rule: 'requestPastSelf' },
    apiStub(state, { choose: () => 'request' }))
  assert.equal(inv.hand.length, 1)
  assert.deepEqual(state.campaign.records.meddledWithThePast, [inv.code])
})

test('05137/05138/05141/05142 的行动：治愈/移动/移除毁灭/离开古怪图形', () => {
  const state = setup(stateFor(1), 109)
  const inv = state.investigators[0]
  placeFromDefinition(state, 'witchHouseRuins')
  inv.location = 'witchHouseRuins'
  inv.horror = 3
  let investigate = null
  ruinsRoom.locationRule.performAction(state, inv, { rule: 'investigateRuins' },
    apiStub(state, {
      investigate: (seat, options = {}) => {
        investigate = { seat, options }
        options.onInvestigateSuccess?.({ success: true, value: 9, difficulty: 4, skill: 'intellect' })
      },
    }))
  // 参考 WitchHouseRuins.hs：走标准调查管线（api.investigate），成功时治愈 2 恐惧、不发现线索。
  assert.equal(investigate?.seat, inv.seat)
  assert.equal(investigate?.options.allowNoClues, true)
  assert.equal(investigate?.options.noClueDiscovery, true)
  assert.equal(inv.horror, 1)
  assert.equal(state.scenarioFlags.ruinsHealUsedBySeat[inv.seat], true, '使用即消耗每场一次（失败也算）')
  // 失败也消耗：直接再调用一次不会清掉已消耗的标记。
  ruinsRoom.locationRule.performAction(state, inv, { rule: 'investigateRuins' },
    apiStub(state, { investigate: () => {} }))
  assert.equal(state.scenarioFlags.ruinsHealUsedBySeat[inv.seat], true)

  placeFromDefinition(state, 'salemGaol1692')
  inv.location = 'salemGaol1692'
  salemRoom.locationRule.performAction(state, inv, { rule: 'salemIntellect' },
    apiStub(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 5, difficulty, skill }),
      choose: () => 'moldyHalls' }))
  assert.equal(inv.location, 'moldyHalls')

  placeFromDefinition(state, 'siteOfTheSacrifice')
  inv.location = 'siteOfTheSacrifice'
  inv.clues = 2
  state.enemies.push({ id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'siteOfTheSacrifice', doom: 2, engagedSeat: null })
  sacrificeRoom.locationRule.performAction(state, inv, { rule: 'removeNahabDoom' }, apiStub(state))
  assert.equal(state.enemies[0].doom, 1)

  placeFromDefinition(state, 'strangeGeometry1')
  inv.location = 'strangeGeometry1'
  loc(state, 'strangeGeometry1').clues = 0
  geometryRoom.locationRule.performAction(state, inv, { rule: 'leaveStrangeGeometry' },
    apiStub(state, { choose: () => 'moldyHalls' }))
  assert.equal(inv.location, 'moldyHalls')

  // 05141：卡面「此行动不会引发那赫卜的借机攻击」= 定向豁免（noOpportunityAttackFrom），
  // 不是把行动伪装成 Parley（否则其它敌人的借机攻击也会被跳过）。
  inv.location = 'siteOfTheSacrifice'
  state.enemies[0].doom = 1
  const sacrificeMoves = []
  sacrificeRoom.locationRule.actions({ moves: sacrificeMoves, state, inv, location: loc(state, 'siteOfTheSacrifice') })
  const removeDoom = sacrificeMoves.find(move => move.rule === 'removeNahabDoom')
  assert.deepEqual(removeDoom.noOpportunityAttackFrom, ['05149'])
  assert.equal(removeDoom.actionKind, undefined, '不得用 parley 伪装免借机攻击')
  assert.equal(removeDoom.action, 'scenarioAction')

  // 05142：无线索的古怪图形上，[free] 移动项必须带 fast:true（引擎 playerWindow 只收
  // behavior.actions() 里 actions===0 && fast===true 的剧本行动）。
  inv.location = 'strangeGeometry1'
  const geometryMoves = []
  geometryRoom.locationRule.actions({ moves: geometryMoves, state, inv, location: loc(state, 'strangeGeometry1') })
  const leave = geometryMoves.find(move => move.rule === 'leaveStrangeGeometry')
  assert.equal(leave.actions, 0)
  assert.equal(leave.fast, true, '玩家窗口需要 fast:true 才能使用 [free] 行动')
})

test('05139 物理教室：成功超难度 ≥2 时在另一地点发现 1 线索（每轮一次）', () => {
  const state = setup(stateFor(1), 113)
  const inv = state.investigators[0]
  placeFromDefinition(state, 'physicsClassroom')
  loc(state, 'physicsClassroom').clues = 1
  inv.location = 'physicsClassroom'
  const api = apiStub(state, { choose: () => 'moldyHalls' })
  physicsRoom.locationRule.onInvestigateSuccess({ state, location: loc(state, 'physicsClassroom'), inv,
    result: { success: true, value: 6, difficulty: 4 }, api })
  assert.equal(loc(state, 'moldyHalls').clues, 0)
  physicsRoom.locationRule.onInvestigateSuccess({ state, location: loc(state, 'physicsClassroom'), inv,
    result: { success: true, value: 6, difficulty: 4 }, api })
  assert.equal(inv.clues, 1, '每轮一次：第二次不再触发')
  // 「每轮一次」是每名调查员一次（不是团队共享）：另一名调查员同轮仍可触发。
  const otherRoom = placeFromDefinition(state, 'walterGilmansRoom')
  otherRoom.revealed = true
  otherRoom.clues = 1
  const other = { ...inv, seat: 1, clues: 0, location: 'physicsClassroom' }
  state.investigators.push(other)
  const otherApi = apiStub(state, { choose: () => 'walterGilmansRoom' })
  physicsRoom.locationRule.onInvestigateSuccess({ state, location: loc(state, 'physicsClassroom'), inv: other,
    result: { success: true, value: 6, difficulty: 4 }, api: otherApi })
  assert.equal(state.scenarioFlags.physicsRoundBySeat[1], state.round, '每名调查员独立记录')
})

test('05136 古老者之城：放置未知地点并建立本场冒险持续连接（不被后续揭示重算覆盖）', () => {
  const state = setup(stateFor(1), 117)
  const inv = state.investigators[0]
  const city = placeFromDefinition(state, 'cityOfElderThings', { revealed: false })
  city.revealed = true
  state.extraLocationDecks = { unknownPlaces: { deck: ['twilightAbyss'] } }
  cityRoom.locationRule.onReveal(state, city, apiStub(state, { choose: () => 'takeHorror' }), inv.seat)
  const placed = loc(state, 'twilightAbyss')
  assert.ok(placed)
  assert.equal(inv.horror, 2)
  assert.ok(city.connections.includes('twilightAbyss'))
  assert.ok(placed.connections.includes('cityOfElderThings'))
  // 再揭示另一个未知地点：locationRevealed 按符号重算连线后仍保留持续连接。
  const other = placeFromDefinition(state, 'salemGaol1692', { revealed: false })
  other.revealed = true
  secretName.behavior.locationRevealed(state, other, apiStub(state, {}))
  assert.ok(city.connections.includes('twilightAbyss'), '持续连接不被符号重算覆盖')
  assert.ok(placed.connections.includes('cityOfElderThings'))
})

// ---------------------------------------------------------------------------
// 8. 混乱标记（四难度）
// ---------------------------------------------------------------------------
test('混乱标记：skull 异次元 -3、cultist 再抽、tablet -2/-3、elderthing -3/-4', () => {
  const state = setup(stateFor(1), 127)
  const inv = state.investigators[0]
  assert.deepEqual(
    [secretName.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state)).delta,
      secretName.behavior.resolveChaosToken(state, inv, 'tablet', apiStub(state)).delta,
      secretName.behavior.resolveChaosToken(state, inv, 'elderthing', apiStub(state)).delta],
    [-1, -2, -3])
  const extradimensional = placeFromDefinition(state, 'salemGaol1692')
  inv.location = extradimensional.id
  assert.equal(secretName.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state)).delta, -3)
  const cultist = secretName.behavior.resolveChaosToken(state, inv, 'cultist', apiStub(state))
  assert.equal(cultist.delta, 0)
  assert.equal(cultist.drawAnother, true)
  state.difficulty = 'hard'
  assert.deepEqual(
    [secretName.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state)).delta,
      secretName.behavior.resolveChaosToken(state, inv, 'tablet', apiStub(state)).delta,
      secretName.behavior.resolveChaosToken(state, inv, 'elderthing', apiStub(state)).delta],
    [-4, -3, -4])
})

test('混乱标记失败后果：cultist 弃 3/5 张；tablet 那赫卜攻击；elderthing 猎手移动', () => {
  const state = setup(stateFor(1), 131)
  const inv = state.investigators[0]
  state.encounterDeck = Array.from({ length: 8 }, () => '01166')
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['cultist'], cancelledTokens: [] }, apiStub(state))
  assert.equal(state.encounterDeck.length, 5)
  state.difficulty = 'hard'
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['cultist'], cancelledTokens: [] }, apiStub(state))
  assert.equal(state.encounterDeck.length, 0)

  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', engagedSeat: null }
  state.enemies.push(nahab)
  apiForAttack.length = 0
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['tablet'], cancelledTokens: [] }, apiStub(state))
  assert.equal(apiForAttack.length, 1, '简单模式：那赫卜与调查员同地点时攻击')

  // 那赫卜远离调查员所在地点：elderthing 用引擎单步解算 hunterStep 后由内容执行移动。
  state.enemies[0].hunter = true
  state.enemies[0].location = 'walterGilmansRoom'
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] },
    apiStub(state, { hunterStep: enemy => (enemy.location === 'walterGilmansRoom' ? 'moldyHalls' : null) }))
  assert.equal(state.enemies[0].location, 'moldyHalls', 'elderthing 结算猎手关键词：向调查员移动一步')
})

test('05120 混乱标记与猎手结算：异次元按印刷英文特性判定；交战/横置/immobile 的敌人不结算猎手', () => {
  const state = setup(stateFor(1), 133)
  const inv = state.investigators[0]
  const abyss = placeFromDefinition(state, 'twilightAbyss', { revealed: false })
  abyss.revealed = true
  secretName.behavior.locationRevealed(state, abyss, apiStub(state))
  // 揭示后实例 traits 保持印刷英文特性（不能用 unrevealed.traitsZh 中文，否则 [[Extradimensional]] 判定失效）。
  assert.deepEqual(abyss.traits, ['Extradimensional', 'Otherworld'])
  assert.equal(abyss.name, '暮光深渊')
  inv.location = abyss.id
  assert.equal(secretName.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state)).delta, -3)
  state.difficulty = 'hard'
  assert.equal(secretName.behavior.resolveChaosToken(state, inv, 'skull', apiStub(state)).delta, -4)
  state.difficulty = 'standard'

  // 只在场的 hunter 且未交战、未横置、未 immobile 的敌人才结算猎手关键词。
  const free = { id: 'h1', code: '05090', originalCode: '05090', name: '猎手A', location: 'walterGilmansRoom',
    engagedSeat: null, exhausted: false, hunter: true }
  const engaged = { id: 'h2', code: '05090', originalCode: '05090', name: '猎手B', location: 'walterGilmansRoom',
    engagedSeat: 0, exhausted: false, hunter: true }
  const tired = { id: 'h3', code: '05090', originalCode: '05090', name: '猎手C', location: 'walterGilmansRoom',
    engagedSeat: null, exhausted: true, hunter: true }
  const pinned = { id: 'h4', code: '05149', originalCode: '05149', name: '那赫卜', location: 'walterGilmansRoom',
    engagedSeat: null, exhausted: false, hunter: true, immobile: true }
  state.enemies.push(free, engaged, tired, pinned)
  inv.location = 'moldyHalls'
  const moved = []
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] },
    apiStub(state, {
      hunterStep: enemy => (enemy === free ? 'moldyHalls' : 'moldyHalls'),
      moveEnemy: (enemy, destination) => { moved.push(enemy.id); enemy.location = destination },
    }))
  assert.deepEqual(moved, ['h1'], '只有未交战、未横置、未 immobile 的猎手移动')
})

// ---------------------------------------------------------------------------
// 9. 结局 / Memento / 黑书
// ---------------------------------------------------------------------------
test('结局 1：按幕记 Memento，击败詹金/那赫卜各 +1 奖励，可选黑书入牌组并 +1 骷髅', () => {
  const state = setup(stateFor(2), 137)
  state.actIndex = 2
  state.scenarioFlags.brownJenkinDefeated = true
  state.scenarioFlags.nahabDefeated = true
  const api = apiStub(state, { choose: () => 'seat:1' })
  const result = secretName.behavior.resolution(state, 'resolution1', [], api)
  assert.deepEqual(result, { award: true, bonus: 2 })
  assert.deepEqual(state.campaign.records.mementosDiscovered.sort(), ['gilmensJournal', 'keziahsFormulae'])
  assert.equal(state.campaign.investigators[1].deck.includes(THE_BLACK_BOOK), true)
  assert.equal(state.chaosBag.filter(token => token === 'skull').length, 1)
  assert.equal(state.scenarioFlags.blackBookSeat, 1)

  const early = setup(stateFor(1), 139)
  early.actIndex = 0
  secretName.behavior.resolution(early, 'resolution1', [], apiStub(early))
  assert.equal(early.campaign.records.mementosDiscovered, undefined, '场景 1 不记 Memento')
})

test('结局 2：3 张 Memento + 2 奖励经验；noResolution 走结局 1；未知 key 抛错', () => {
  const state = setup(stateFor(1), 149)
  state.actIndex = 1
  const result = secretName.behavior.resolution(state, 'resolution2', [], apiStub(state))
  assert.deepEqual(result, { award: true, bonus: 2 })
  assert.deepEqual(state.campaign.records.mementosDiscovered.sort(),
    ['gilmensJournal', 'keziahsFormulae', 'wornCrucifix'])

  const fallback = setup(stateFor(1), 151)
  fallback.actIndex = 1
  fallback.scenarioFlags.nahabDefeated = true
  const noResolution = secretName.behavior.resolution(fallback, 'noResolution', [], apiStub(fallback))
  assert.equal(noResolution.bonus, 1, 'noResolution → 结局 1（含那赫卜奖励）')
  assert.throws(() => secretName.behavior.resolution(fallback, 'resolution9', [], apiStub(fallback)))
})

// ---------------------------------------------------------------------------
// 10. 闹鬼 / 古怪图形 / 存档
// ---------------------------------------------------------------------------
test('闹鬼 script：屋主的住处找鼠群生成在发霉的走道；凯夏的房间弃到巫术卡并抽取', () => {
  const state = setup(stateFor(1), 157)
  state.encounterDiscard = [SWARM_OF_RATS]
  const spawned = []
  secretName.behavior.hauntedScript(state,
    { scriptId: 'landlordsQuartersRats', seat: 0 },
    apiStub(state, { spawn: (code, location) => spawned.push({ code, location }) }))
  assert.deepEqual(spawned, [{ code: SWARM_OF_RATS, location: 'moldyHalls' }])

  state.encounterDeck = ['01166', '05092', '05093']
  const drawn = []
  secretName.behavior.hauntedScript(state,
    { scriptId: 'keziahsRoomHex', seat: 0 },
    apiStub(state, { drawEncounter: seat => drawn.push(seat) }))
  assert.deepEqual(drawn, [0], '弃到巫术卡后抽取它')
  assert.equal(state.encounterDiscard.filter(code => code === '05092' || code === '05093').length, 0, '05093 是巫术卡，直接被抽取')
  assert.ok(state.encounterDeck.includes('05092'), '05092 未被弃掉')
})

test('古怪图形：作为遭遇地点放置并移动到其上；调查阶段结束把人抛向线索最多地点', () => {
  const state = setup(stateFor(1), 163)
  const inv = state.investigators[0]
  secretName.behavior.drawLocation(state, 0, STRANGE_GEOMETRY, apiStub(state))
  const geometry = state.locations.find(location => codeOf(location) === STRANGE_GEOMETRY)
  assert.ok(geometry)
  assert.equal(inv.location, geometry.id)

  loc(state, 'moldyHalls').clues = 3
  placeFromDefinition(state, 'landlordsQuarters')
  loc(state, 'landlordsQuarters').clues = 1
  // 参考实现是 PhaseEnds #after #investigation（= 敌人阶段开始）；引擎用 phaseBegan('enemy')。
  secretName.behavior.phaseBegan(state, 'enemy', apiStub(state))
  assert.equal(inv.location, 'moldyHalls')
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  assert.equal(state.locations.some(location => codeOf(location) === STRANGE_GEOMETRY), false)
})

test('同一路线的开始状态在 JSON 往返后完全一致（存档/重放）', () => {
  const build = seed => {
    const state = setup(stateFor(2), seed)
    secretName.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => 'lie' }))
    return state
  }
  const first = build(167)
  const second = build(167)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.extraLocationDecks, first.extraLocationDecks)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.deepEqual(restored.campaign.records, first.campaign.records)
  assert.equal(JSON.parse(JSON.stringify(first)).scenario.id, 'theSecretName', '路径 scenarios/theSecretName/ 的存档')
})

test('enemyStatModifier / tokenMeanings / 剧本数据一致性', () => {
  assert.equal(secretName.behavior.tokenMeanings.standard.skull.delta, -1)
  assert.equal(secretName.behavior.tokenMeanings.hard.cultist.delta, 0)
  assert.deepEqual(secretName.scenario.scriptCards.rules.advanceInvestigatingTheWitchHouse,
    { card: 'act', codes: ['05125'] })
  assert.equal(cityRoom.implemented, true)
  assert.equal(geometryRoom.implemented, true)
})

// ---------------------------------------------------------------------------
// task-42 回归：TSN performEncounterAction 转发共享威胁行动（05093/05094/05146）
// ---------------------------------------------------------------------------
test('05093/05094 崩毁离析/苦痛折磨：TSN 转发共享实现（横置女巫自动成功 + 遭遇弃牌堆）', () => {
  for (const code of ['05093', '05094']) {
    const state = setup(stateFor(1))
    const inv = state.investigators[0]
    inv.threat.push({ id: `threat-${code}`, code, originalCode: code })
    // 同地点横置女巫：卡面「本次检定自动成功」。
    state.enemies.push({ id: `witch-${code}`, code: '05090', originalCode: '05090', name: '女巫',
      traits: ['Witch'], exhausted: true, location: inv.location, engagedSeat: null })
    const move = secretName.behavior.actions(state, inv)
      .concat(secretName.behavior.encounterActions?.(state, inv) || [])
      .find(candidate => String(candidate.threatId) === `threat-${code}`)
    assert.ok(move, `${code} 应在遭遇行动里列出（共享 encounterActions）`)
    let tested = 0
    const api = apiStub(state, {
      test: (seat, skill, difficulty, resolve) => {
        tested += 1
        resolve({ success: true, value: 99, difficulty, skill })
      },
    })
    assert.equal(secretName.behavior.performEncounterAction(state, inv, move, api), true)
    assert.equal(tested, 0, '横置女巫在场：自动成功，不进行检定')
    assert.equal(inv.threat.length, 0, '威胁卡弃掉')
    assert.ok(state.encounterDiscard.includes(code), `${code} 应弃入遭遇弃牌堆（而不是调查员弃牌堆）`)
    assert.ok(!inv.discard.includes(code), `${code} 不应进入调查员弃牌堆`)
  }
})

test('05093 崩毁离析：无横置女巫时检定 意志(3)，成功弃入遭遇弃牌堆', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  inv.threat.push({ id: 'threat-05093', code: '05093', originalCode: '05093' })
  const move = (secretName.behavior.encounterActions?.(state, inv) || [])
    .find(candidate => String(candidate.threatId) === 'threat-05093')
  assert.ok(move)
  let seen = null
  const api = apiStub(state, {
    test: (seat, skill, difficulty, resolve) => {
      seen = { seat, skill, difficulty }
      resolve({ success: true, value: 9, difficulty, skill })
    },
  })
  assert.equal(secretName.behavior.performEncounterAction(state, inv, move, api), true)
  assert.deepEqual(seen, { seat: 0, skill: 'willpower', difficulty: 3 })
  assert.ok(state.encounterDiscard.includes('05093'))
  assert.ok(!inv.discard.includes('05093'))
})

// 第四轮内容侧接线：05133 0 线索可调查、05140 行动限制、05150 支付前减费能力。
test('第四轮接线：05133 investigateWithoutClues / 05140 actionBlocked / 05150 beforePlayCost 条目', async () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  // 05133 凯夏的房间：0 线索也允许标准调查（引擎读点 investigate-empty-location）。
  const keziahsRoom = state.locations.find(location => location.id === 'keziahsRoom')
    || { id: 'keziahsRoom', code: '05133', name: '凯夏的房间' }
  assert.equal(secretName.behavior.investigateWithoutClues(state, inv, keziahsRoom), true)
  assert.equal(secretName.behavior.investigateWithoutClues(state, inv,
    state.locations.find(location => location.id === 'moldyHalls') || { id: 'moldyHalls', code: '05127' }), false)

  // 05140 旧日支配者皇廷：闹鬼生效时，非调查行动被拒；调查行动放行；调查结算后清标记。
  secretName.behavior.hauntedScript(state, { scriptId: 'courtMustInvestigate', seat: inv.seat },
    apiStub(state))
  assert.equal(state.scenarioFlags.mustInvestigateSeat, inv.seat)
  assert.match(secretName.behavior.actionBlocked(state, inv, { action: 'fight' }), /调查/)
  assert.match(secretName.behavior.actionBlocked(state, inv, { action: 'move' }), /调查/)
  assert.equal(secretName.behavior.actionBlocked(state, inv, { action: 'investigate' }), undefined)
  secretName.behavior.investigateResult(state, inv,
    state.locations.find(location => location.id === inv.location) || state.locations[0],
    { success: true, value: 5, difficulty: 2 }, apiStub(state))
  assert.equal(state.scenarioFlags.mustInvestigateSeat, undefined)

  // 05150 黑书：条目声明 beforePlayCost 反应（横置 + 自选 X 恐惧 → context.costReduction）。
  const blackBook = (await import('../src/cards/encounter-entries/theCircleUndone/theSecretName/05150.js')).default
  assert.equal(blackBook.passive.stats.willpower, 1)
  const ability = blackBook.abilities.find(candidate => candidate.trigger === 'beforePlayCost')
  assert.ok(ability, '黑书应有 beforePlayCost 反应')
  assert.equal(ability.cost.exhaust, true)
  const context = { cost: 3, costReduction: 0, cardCode: '01020', seat: inv.seat }
  const api = apiStub(state, { choice: () => '2', horror: () => {}, info: () => {} })
  ability.resolve({ inv: { ...inv, sanity: 6, horror: 1 }, source: { code: '05150' }, context, api })
  assert.equal(context.costReduction, 2)
  assert.equal(ability.criteria[0]({ inv: { ...inv, sanity: 6, horror: 6 }, context }), false,
    '没有剩余恐惧可付时不可发动')
  // 多人局：卡面是「当你打出一张卡牌时」——只有黑书持有者本人打牌时响应，他人打牌不触发
  // （引擎 beforePlayCost 窗口会对每名存活调查员枚举受控卡反应，必须由 criteria 限定座位）。
  assert.equal(ability.criteria[0]({ inv: { ...inv, seat: 0, sanity: 6, horror: 1 },
    context: { ...context, seat: 1 } }), false, '其他调查员打牌时黑书不响应')
  assert.equal(ability.criteria[0]({ inv: { ...inv, seat: 0, sanity: 6, horror: 1 },
    context: { ...context, seat: 0 } }), true, '黑书持有者本人打牌时响应')
})

test('05130/05131 闹鬼 choice 按选项可结算性过滤：无支援只剩恐惧、0 线索只剩放毁灭', () => {
  const runHaunted = ({ locationId, investigator, choices = [] }) => {
    const calls = []
    const log = []
    const haunted = createHaunted({
      reactionWindow: () => {},
      requestChoice: (state, request) => {
        calls.push(request)
        return choices.shift() ?? request.options[0].id
      },
      scenarioBehavior: () => ({ hauntedScript: () => true }),
      cardDef: code => ALL_CARDS[code],
    })
    const inv = { seat: 0, name: '调查员1', location: locationId, horror: 0, clues: 0,
      hand: [], assets: [], threat: [], deck: [], discard: [], ...investigator }
    const state = {
      investigators: [inv],
      locations: [{ ...clone(definition.locations[locationId]), id: locationId, clues: 0 }],
      scenarioFlags: {}, round: 1, phase: 'investigation', currentSeat: 0, log: [],
    }
    const api = {
      info: text => log.push(String(text)),
      cardName: code => ALL_CARDS[code]?.nameZh || code,
      damage: () => {}, horror: (seat, amount) => { inv.horror += amount },
      discardAsset: (seat, assetId) => {
        inv.assets = inv.assets.filter(asset => String(asset.id) !== String(assetId))
      },
      spendClues: (seat, amount) => { inv.clues = Math.max(0, inv.clues - amount) },
      addDoom: amount => { state.doom = (state.doom || 0) + amount },
      doomOn: () => {},
    }
    const result = haunted.resolveHaunted(state, 0, { locationId }, api)
    return { result, inv, state, calls, location: state.locations[0], log }
  }

  // 05130：无支援 → 只剩「受到 1 点恐惧」，自动结算，无选择窗。
  const joeEmpty = runHaunted({ locationId: 'joeMazurewiczsRoom', investigator: {} })
  assert.equal(joeEmpty.inv.horror, 1)
  assert.equal(joeEmpty.calls.length, 0, '唯一可用选项直接结算')

  // 05130：有支援 → 两个选项；选择弃支援后支援被弃、不受恐惧。
  const joeAsset = runHaunted({
    locationId: 'joeMazurewiczsRoom',
    investigator: { assets: [{ id: 'a1', code: '01001' }] },
    choices: ['discardAsset'],
  })
  assert.equal(joeAsset.calls.length, 1)
  assert.deepEqual(joeAsset.calls[0].options.map(option => option.id), ['horror', 'discardAsset'])
  assert.equal(joeAsset.inv.assets.length, 0)
  assert.equal(joeAsset.inv.horror, 0)

  // 05131：0 线索 → 只剩「放 1 个毁灭」，自动结算。
  const frankEmpty = runHaunted({ locationId: 'frankElwoodsRoom', investigator: {} })
  assert.equal(frankEmpty.state.doom, 1)
  assert.equal(frankEmpty.calls.length, 0, '0 线索时候选窗不出「放线索」选项')

  // 05131：1 线索 → 两个选项；选择放线索后消耗自己 1 线索、地点 +1。
  const frankClue = runHaunted({
    locationId: 'frankElwoodsRoom',
    investigator: { clues: 1 },
    choices: ['placeClue'],
  })
  assert.equal(frankClue.calls.length, 1)
  assert.deepEqual(frankClue.calls[0].options.map(option => option.id), ['placeClue', 'agendaDoom'])
  assert.equal(frankClue.inv.clues, 0)
  assert.equal(frankClue.location.clues, 1)
})

// 第四轮 E 收口：章节直接弃遭遇牌库（Walter 房间弃顶 2）把牌库弃空时，必须补触发
// 「遭遇牌库耗尽」强制（05098/05147 类）。
test('第四轮：沃尔特房间弃顶 2 张把遭遇牌库弃空 → 触发 05147 的「遭遇牌库耗尽」强制', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  state.encounterDeck = ['01001', '01002']
  state.encounterDiscard = []
  inv.threat = [{ id: 'threat-05147', code: '05147', originalCode: '05147' }]
  const api = apiStub(state)
  assert.equal(secretName.behavior.hauntedScript(state,
    { scriptId: 'walterGilmansRoomDiscard', seat: inv.seat }, api), true)
  assert.equal(state.encounterDeck.length, 0)
  assert.equal(inv.threat.length, 0, '05147 的强制在牌库耗尽时结算并弃掉自己')
  assert.ok(state.encounterDiscard.includes('05147'))
})

// 第五轮：05150 黑书的减费要参与「打出合法性」判定（引擎 play-cost-interrupt + playCostReductionProvider
// + 受控剧情支援的窗口枚举修复）。用 core-fixture 走真实引擎事务：
// 资源 1、打出 3 费大砍刀 → legalMoves 出现 → beforePlayCost 触发黑书、选 X=2 →
// 费用降为 1、资源归 0、黑书横置、受到 2 点恐惧。
test('05150 黑书：资源不足但减费后够 → 可打出（引擎合法性 + beforePlayCost 反应）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const book = asset(state, '05150')
  inv.resources = 1
  inv.hand.push('01020')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '01020' }), null,
    '引擎把黑书的潜在减费计入打出合法性')
  assert.ok(legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === '01020'))
  move(state, { action: 'play', cardId: '01020' })
  // 第一个窗口：横置黑书（可选反应）；第二个窗口：自选 X（合法性要求至少减到付得起，故从 2 起）。
  let guard = 0
  const seenKinds = []
  while (state.pendingChoice && guard++ < 10) {
    const pending = state.pendingChoice
    seenKinds.push(pending.kind)
    let optionId
    if (pending.kind === 'reaction') {
      optionId = pending.options.find(option => option.id !== 'skip')?.id
      assert.ok(optionId, '应出现黑书的 beforePlayCost 反应选项')
    } else if (pending.kind === 'number') {
      assert.deepEqual(pending.options.map(option => option.id), ['2', '3'],
        'X 的下限是减到付得起（2），上限是剩余恐惧/费用（3）')
      optionId = '2'
    } else {
      optionId = pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
        ?? pending.options[0]?.id
    }
    move(state, { action: 'choose', choiceId: pending.id, optionId })
  }
  const played = state.investigators[0]
  assert.deepEqual(seenKinds, ['reaction', 'number'])
  assert.equal(played.resources, 0, '费用 3 减 2 → 只付 1')
  assert.equal(played.horror, 2, '受到 X=2 点恐惧')
  assert.equal(played.assets.find(card => card.code === '05150')?.exhausted, true, '黑书横置')
  assert.ok(played.assets.some(card => card.code === '01020'), '大砍刀已打出并装备')
  assert.equal(book.id, played.assets.find(card => card.code === '05150')?.id)
})

test('05150 黑书：已横置时不提供潜在减费 → 资源不足仍不能打出', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  asset(state, '05150', { exhausted: true })
  inv.resources = 1
  inv.hand.push('01020')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '01020' }), '资源不足')
  assert.equal(legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === '01020'), false)
})

