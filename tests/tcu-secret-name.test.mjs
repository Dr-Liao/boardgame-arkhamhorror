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
    drawCards: (seat, n) => { state.investigators[seat].hand.push(...Array(n).fill('01001')) },
    discardRandom: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
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
test('setup：未知地点牌库 7 张（底部巫宅遗址 + 3 随机，顶部 3 随机），放一边 9 张', () => {
  const state = setup(stateFor(2), 5)
  const deck = state.extraLocationDecks.unknownPlaces.deck
  assert.equal(deck.length, 7)
  assert.equal(new Set(deck).size, 7)
  assert.ok(deck.slice(0, 4).includes('witchHouseRuins'), '巫宅遗址在牌库底部 4 张里')
  assert.deepEqual([...[...UNKNOWN_PLACES, 'witchHouseRuins']].sort(), [...deck].sort())
  const aside = state.scenarioZones.setAside
  for (const code of [NAHAB, BROWN_JENKIN, THE_BLACK_BOOK, GHOSTLY_PRESENCE, GHOSTLY_PRESENCE, '05141', '05133', STRANGE_GEOMETRY, STRANGE_GEOMETRY]) {
    assert.ok(aside.includes(code), `放一边缺少 ${code}`)
  }
  assert.deepEqual(state.investigators.map(inv => inv.location), ['moldyHalls', 'moldyHalls'])
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
test('act1 背面：换成凯夏的房间、移除其他地点、黑书归属、洗入 2 张古怪图形', () => {
  const state = setup(stateFor(2), 23)
  state.encounterDeck = []
  const api = apiStub(state)
  act1.actRule.onReveal(state, state.acts[0], api)
  assert.deepEqual(state.locations.map(location => location.id), ['keziahsRoom'])
  assert.ok(state.investigators.every(inv => inv.location === 'keziahsRoom'))
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
  const taken = []
  const api = apiStub(state, { spawn: (code, location) => { taken.push({ code, location }); return null } })
  act2.actRule.onReveal(state, state.acts[1], api)
  assert.ok(loc(state, 'siteOfTheSacrifice'))
  assert.deepEqual(taken.map(entry => entry.code), [NAHAB, BROWN_JENKIN])
  assert.equal(taken[0].location, 'siteOfTheSacrifice')
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
test('agenda1 背面：布朗·詹金在场时把鼠群生成在他所在地点；≥3 人再在巫宅地点生成一只', () => {
  const state = setup(stateFor(3), 43)
  placeFromDefinition(state, 'witchHouseRuins')
  state.enemies.push({ id: 'bj', code: BROWN_JENKIN, originalCode: BROWN_JENKIN, name: '布朗·詹金', location: 'moldyHalls', engagedSeat: null })
  state.encounterDiscard = ['01166', SWARM_OF_RATS]
  const spawned = []
  const api = apiStub(state, { spawn: (code, location) => { spawned.push({ code, location }); return null } })
  hermit.agendaRule.onReveal(state, state.agendas[0], api)
  assert.equal(spawned.filter(entry => entry.code === SWARM_OF_RATS).length, 2)
  assert.equal(spawned[0].location, 'moldyHalls')
})

test('agenda2 背面：按幕放置那赫卜、洗入 2 张鬼影骤现、布朗·詹金放到那赫卜地点', () => {
  const state = setup(stateFor(2), 47)
  state.encounterDeck = []
  const api = apiStub(state)
  familiar.agendaRule.onReveal(state, state.agendas[1], api)
  assert.ok(state.enemies.some(enemy => codeOf(enemy) === NAHAB && enemy.location === 'walterGilmansRoom'))
  assert.equal(state.encounterDeck.filter(code => code === GHOSTLY_PRESENCE).length, 2)
  const jenkin = state.enemies.find(enemy => codeOf(enemy) === BROWN_JENKIN)
  const nahab = state.enemies.find(enemy => codeOf(enemy) === NAHAB)
  assert.equal(jenkin.location, nahab.location)
})

test('agenda3 背面：幕 1/2 把那赫卜放回场外并为密谋 4a 预留 4 毁灭；幕 3 放 1 毁灭', () => {
  const early = setup(stateFor(1), 53)
  early.agendaIndex = 2
  early.enemies.push({ id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls', doom: 0, engagedSeat: null })
  witchLight.agendaRule.onReveal(early, early.agendas[2], apiStub(early))
  assert.equal(early.enemies.some(enemy => codeOf(enemy) === NAHAB), false)
  assert.equal(early.agendas[3].doom, 4)

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

test('act3：那赫卜被击败时不弃掉，改为治愈/横置/解除交战并给击败者奖励线索', () => {
  const state = setup(stateFor(2), 67)
  state.actIndex = 2
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls',
    doom: 2, exhausted: false, engagedSeat: 0, damageTaken: 3, defeatedBy: 0, traits: ['Witch'] }
  state.investigators[0].engaged = ['n1']
  state.enemies.push(nahab)
  const blocked = secretName.behavior.enemyCanBeDefeated(state, nahab, null, 0)
  assert.equal(blocked, false)
  assert.equal(nahab.damageTaken, 0)
  assert.equal(nahab.exhausted, true)
  assert.equal(nahab.engagedSeat, null)
  assert.equal(state.investigators[0].clues, 1, '2 人时奖励 1 线索（≥3 人才是 2）')
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
test('05143 好事魔宠：布朗·詹金不在场时找出他并造成 1 伤', () => {
  const state = setup(stateFor(1), 73)
  state.scenarioZones.setAside.push(BROWN_JENKIN)
  const api = apiStub(state)
  meddlesome.encounterResolve(state, state.investigators[0], { code: '05143' }, api)
  assert.equal(state.enemies.some(enemy => codeOf(enemy) === BROWN_JENKIN), true)
  assert.equal(state.investigators[0].damage, 1)
})

test('05144 鬼影骤现：那赫卜不在场时生成在你地点；在场时重整并攻击同地点调查员', () => {
  const first = setup(stateFor(1), 79)
  first.scenarioZones.setAside.push(NAHAB)
  ghostly.encounterResolve(first, first.investigators[0], { code: '05144' }, apiStub(first))
  assert.ok(first.enemies.some(enemy => codeOf(enemy) === NAHAB && enemy.location === first.investigators[0].location))

  const second = setup(stateFor(2), 79)
  const nahab = { id: 'n1', code: NAHAB, originalCode: NAHAB, name: '那赫卜', location: 'moldyHalls',
    exhausted: true, engagedSeat: null, hunter: true, doom: 0, traits: ['Witch'] }
  second.enemies.push(nahab)
  apiForAttack.length = 0
  ghostly.encounterResolve(second, second.investigators[0], { code: '05144' }, apiStub(second))
  assert.equal(nahab.exhausted, false)
  assert.equal(apiForAttack.length, 2, '攻击同地点每位调查员')
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

test('05146 群星牵引：进入威胁区；本回合未移动则回合结束受 2 恐惧', () => {
  const state = setup(stateFor(1), 89)
  const inv = state.investigators[0]
  const api = apiStub(state)
  pulledByStars.encounterResolve(state, inv, { code: '05146' }, api)
  assert.equal(inv.threat.length, 1)
  inv.tcuMovedThisTurn = false
  secretName.behavior.turnEnded(state, inv, api)
  assert.equal(inv.horror, 2)
  assert.equal(pulledByStars.threatAction.rule, 'discardPulledByTheStars')
})

test('05147 不安的梦：意志(5)失败放入威胁区；回合结束弃遭遇牌库顶', () => {
  const state = setup(stateFor(1), 97)
  const inv = state.investigators[0]
  const api = apiStub(state)
  disquieting.encounterResolve(state, inv, { code: '05147' }, api)
  assert.equal(inv.threat.length, 1)
  state.encounterDeck = ['01166', '05092']
  secretName.behavior.turnEnded(state, inv, api)
  assert.equal(state.encounterDeck.length, 1)
  assert.equal(state.encounterDiscard.length, 1)
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

test('05134 今晚早些时候：向过去的自己求助把弃牌堆顶返回手牌并记住', () => {
  const state = setup(stateFor(1), 107)
  const inv = state.investigators[0]
  placeFromDefinition(state, 'moldyHallsEarlierTonight')
  inv.location = 'moldyHallsEarlierTonight'
  inv.discard = ['01001']
  earlierTonight.locationRule.performAction(state, inv, { rule: 'requestPastSelf' },
    apiStub(state, { choose: () => 'request' }))
  assert.equal(inv.hand.length, 1)
  assert.deepEqual(state.scenarioFlags.meddledWithThePast, [inv.name])
})

test('05137/05138/05141/05142 的行动：治愈/移动/移除毁灭/离开古怪图形', () => {
  const state = setup(stateFor(1), 109)
  const inv = state.investigators[0]
  placeFromDefinition(state, 'witchHouseRuins')
  inv.location = 'witchHouseRuins'
  inv.horror = 3
  ruinsRoom.locationRule.performAction(state, inv, { rule: 'investigateRuins' },
    apiStub(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 5, difficulty, skill }) }))
  assert.equal(inv.horror, 1)

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

  // 那赫卜远离调查员所在地点：elderthing 应真的把它沿连接移动一步（旧实现只调用纯计算 hunterStep）。
  state.enemies[0].hunter = true
  state.enemies[0].location = 'walterGilmansRoom'
  secretName.behavior.afterTest(state, inv,
    { success: false, value: 0, difficulty: 2, drawn: ['elderthing'], cancelledTokens: [] }, apiStub(state))
  assert.equal(state.enemies[0].location, 'moldyHalls', 'elderthing 结算猎手关键词：向调查员移动一步')
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
  secretName.behavior.phaseBegan(state, 'mythos', apiStub(state))
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
