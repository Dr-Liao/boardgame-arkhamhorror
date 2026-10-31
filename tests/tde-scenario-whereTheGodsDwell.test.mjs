// 神居之所（whereTheGodsDwell · 06286）章节测试（P8 worker w-p8-e）。
//
// 两层证据：
//   1. 章节钩子（behavior）——setup/区域、混乱标记与失败后果、幕/议程推进、Grand Design、真形合成、
//      塔行动、结局/记录、存档往返；
//   2. 单卡条目（encounter-entries）——直接 import 单卡文件并注册进条目注册表，
//      验证 actRule/agendaRule/locationRule/enemyScript/flags 的规则行为。
//      （索引由 Lead 合并后重建；测试里用 registerCardAbilities 临时注册，等价于重建后的读点。）
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
// 引擎装配点注册能力层与内容注册表。
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/index.js'
import {
  scenario as definition, RECORDS, FORSAKEN_TOWER_IDS, NYARLATHOTEP_COPIES, HIGH_PRIEST,
  ONYX_CASTLE, ONYX_GATES, MONASTERY_OF_LENG, COLD_WASTES, SET_ASIDE_CODES, MYRIAD_FORMS,
  THE_CRAWLING_MIST, WHISPERING_CHAOS,
} from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/definition.js'

// 单卡条目注册：索引重建后（Lead 合并时）条目已在注册表里，直接使用；
// 索引还没包含本章时（本地早期运行）临时注册，两种状态都可跑。
const entryDir = new URL('../src/cards/encounter-entries/theDreamEaters/whereTheGodsDwell/', import.meta.url)
const entryModules = await Promise.all(readdirSync(entryDir)
  .filter(name => name.endsWith('.js'))
  .map(name => import(new URL(name, entryDir).href)))
const unregistered = entryModules
  .map(module => module.default)
  .filter(entry => entry && !registeredEntry(entry.code))
if (unregistered.length) registerCardAbilities(unregistered)

const clone = value => structuredClone(value)

function stateFor(count = 2) {
  const state = {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'plateauOfLeng',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], hiddenCards: [], assets: [], threat: [],
      engaged: [], deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', '-1', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)
const inv = (state, seat = 0) => state.investigators[seat]

// 与引擎 placeLocation 相同的语义：复制 definition 里的地点入场。
function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(entry => entry.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
}

// 隐藏手牌原语桩：与 src/engine/scenario-runtime.js 的 api.hiddenCards 同语义。
function hiddenCardsStub(state) {
  const people = () => state.investigators
  const removeMarker = (owner, code) => {
    owner.hiddenCards ||= []
    const index = owner.hiddenCards.indexOf(code)
    if (index >= 0) owner.hiddenCards.splice(index, 1)
  }
  return {
    list: seat => [...(people()[seat]?.hiddenCards || [])],
    has: (seat, code = null) => (people()[seat]?.hiddenCards || [])
      .some(hidden => code == null || hidden === code),
    place: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      owner.hand.push(code)
      owner.hiddenCards ||= []
      owner.hiddenCards.push(code)
      return true
    },
    discard: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      const index = owner.hand.indexOf(code)
      if (index < 0 || !(owner.hiddenCards || []).includes(code)) return false
      owner.hand.splice(index, 1)
      removeMarker(owner, code)
      state.encounterDiscard.push(code)
      return true
    },
    take: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      const index = owner.hand.indexOf(code)
      if (index < 0 || !(owner.hiddenCards || []).includes(code)) return false
      owner.hand.splice(index, 1)
      removeMarker(owner, code)
      return true
    },
    removeMarker: (seat, code) => {
      const owner = people()[seat]
      if (!owner) return false
      removeMarker(owner, code)
      return true
    },
    transfer: (seat, targetSeat, code) => {
      const from = people()[seat]
      const to = people()[targetSeat]
      if (!from || !to) return false
      const index = from.hand.indexOf(code)
      if (index < 0 || !(from.hiddenCards || []).includes(code)) return false
      from.hand.splice(index, 1)
      removeMarker(from, code)
      to.hand.push(code)
      to.hiddenCards ||= []
      to.hiddenCards.push(code)
      return true
    },
  }
}

function apiStub(state, overrides = {}) {
  const api = {
    info: () => {},
    choose: () => 'skip',
    random: () => 0.5,
    shuffle: items => [...items],
    damage: (seat, amount) => { inv(state, seat).damage += amount },
    horror: (seat, amount) => { inv(state, seat).horror += amount },
    loseActions: (seat, amount) => { inv(state, seat).actionsLeft = Math.max(0, inv(state, seat).actionsLeft - amount) },
    addDoom: amount => { state.doom += amount },
    doomOn: (card, amount = 1) => { if (card) card.doom = (card.doom || 0) + amount },
    cardReveal: code => { api.revealed.push(code) },
    revealed: [],
    hiddenCards: hiddenCardsStub(state),
    moveCard: spec => {
      const owner = state.investigators[spec.ownerSeat ?? 0]
      if (spec.from === 'hand') {
        const index = owner.hand.indexOf(spec.code)
        if (index < 0) return false
        owner.hand.splice(index, 1)
      }
      if (spec.to === 'victoryDisplay') {
        state.victoryDisplay.push({ id: `vd-${state.victoryDisplay.length + 1}`, code: spec.code, originalCode: spec.code, victory: 2 })
      }
      return true
    },
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty + 1, difficulty, skill }),
    spawn: (code, locationId, seat = null) => {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location: locationId, engagedSeat: seat, damageTaken: 0, exhausted: false, traits: [],
        fight: definition.enemies[code]?.fight ?? 0, evade: definition.enemies[code]?.evade ?? 0,
        health: definition.enemies[code]?.health ?? 1, victory: definition.enemies[code]?.victory ?? 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    spawnStoryEnemy: (code, locationId, stats = {}, extra = {}) => {
      const enemy = {
        id: `story-enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: stats.name || code, location: locationId, engagedSeat: null, damageTaken: 0,
        exhausted: false, ...stats, ...extra,
      }
      state.enemies.push(enemy)
      return enemy
    },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(entry => entry.id === enemyId)
      if (!enemy) return 0
      enemy.damageTaken = (enemy.damageTaken || 0) + amount
      return amount
    },
    moveInvestigator: (seat, locationId) => { inv(state, seat).location = locationId },
    place: id => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
      state.locations.push({ ...clone(base), id, revealed: false, clues: 0, maxClues: clues, doom: 0 })
      return loc(state, id)
    },
    reveal: id => {
      const location = loc(state, id)
      if (!location) return null
      location.revealed = true
      location.clues = location.maxClues || 0
      if (location.unrevealedActualName) {
        location.name = location.unrevealedActualName
        delete location.unrevealedActualName
      }
      return location
    },
    removeLocationFromGame: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
      return index >= 0
    },
    addCluesToLocation: (id, amount) => {
      const location = loc(state, id)
      if (!location) return 0
      location.clues = (location.clues || 0) + amount
      return location.clues
    },
    discardEncounterTop: (count = 1) => {
      const discarded = []
      for (let index = 0; index < count && state.encounterDeck.length; index += 1) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); return state.encounterDeck.length },
    shuffleDiscard: () => {
      state.encounterDeck.push(...state.encounterDiscard)
      state.encounterDiscard = []
    },
    takeFromSetAside: code => {
      const aside = state.scenarioZones?.setAside || []
      const index = aside.indexOf(code)
      if (index < 0) return false
      aside.splice(index, 1)
      return true
    },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags[key] = value },
    spendClues: (seat, amount) => { inv(state, seat).clues -= amount },
    payClues: (amount, locationId = null) => {
      let remaining = amount
      for (const entry of state.investigators) {
        if (locationId && entry.location !== locationId) continue
        const spend = Math.min(entry.clues, remaining)
        entry.clues -= spend
        remaining -= spend
      }
    },
    advanceAct: () => { state.actIndex += 1 },
    finish: key => { state.resolutionKey = key },
    locationDistance: (from, targets) => (targets.includes(from) ? 0 : 1),
    stepToward: (from, to) => to,
    moveEnemy: (enemy, locationId) => { enemy.location = locationId },
    attack: (enemy, investigator) => {
      investigator.damage += Number(enemy.damage || 0)
      investigator.horror += Number(enemy.horror || 0)
    },
    ...overrides,
  }
  return api
}

function setup(state, seed = 1) {
  chapter.behavior.setupLocations(state, [], {})
  placeLocations(state, ['plateauOfLeng', 'coldWastes', 'monasteryOfLeng', 'onyxGates', 'theOnyxCastle'])
  chapter.behavior.afterDeckSetup(state, [], {})
  return state
}

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('06286 章节清单：development、原卡、地点/幕/议程/结局数量与依赖', () => {
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.id, 'whereTheGodsDwell')
  assert.equal(chapter.manifest.referenceCode, '06286')
  assert.equal(chapter.scenario.originalCode, '06286')
  assert.equal(chapter.manifest.locations.length, 11, '5 个固定地点 + 6 座被遗忘的高塔')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4', 'act5'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
  assert.equal(chapter.manifest.startLocationId, 'plateauOfLeng')
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'tdeCampaign']) // 印刷包由 tdeCampaign cardRanges 覆盖
  assert.deepEqual(chapter.manifest.requiredEncounterGroupIds,
    ['whereTheGodsDwell', 'agentsOfNyarlathotep', 'dreamersCurse', 'whispersOfHypnos', 'darkCult'])
  assert.equal(chapter.manifest.catalogReferenceOnly, undefined)
})

test('身份登记：11 地点 / 5 幕 / 3 议程 / 敌人 / 诡计都有原卡身份且 mapped', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries']) {
    const entries = chapter.identities[category] || {}
    assert.ok(Object.keys(entries).length > 0, `${category} 身份为空`)
    for (const [id, identity] of Object.entries(entries)) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped', `${category}/${id} 未 mapped`)
    }
  }
  assert.equal(chapter.identities.locations.theOnyxCastle.originalCode, ONYX_CASTLE)
  assert.equal(chapter.identities.enemies[HIGH_PRIEST].originalCode, HIGH_PRIEST)
})

// ---------------------------------------------------------------------------
// 2. setup / 区域
// ---------------------------------------------------------------------------
test('setup：5 个地点入场、13 张遭遇卡放在一边、6 座塔声明为 set aside 地点', () => {
  const state = setup(stateFor(2))
  assert.deepEqual(state.locations.map(location => location.id).sort(),
    ['coldWastes', 'monasteryOfLeng', 'onyxGates', 'plateauOfLeng', 'theOnyxCastle'].sort())
  const aside = state.scenarioZones.setAside
  assert.equal(aside.length, 13)
  assert.equal(aside.filter(code => NYARLATHOTEP_COPIES.includes(code)).length, 5)
  assert.equal(aside.filter(code => WHISPERING_CHAOS.includes(code)).length, 4)
  assert.equal(aside.filter(code => code === MYRIAD_FORMS).length, 2, '万千化身两张都放在一边')
  assert.equal(aside.filter(code => code === HIGH_PRIEST).length, 1)
  assert.equal(aside.filter(code => code === THE_CRAWLING_MIST).length, 1)
  assert.deepEqual([...SET_ASIDE_CODES].sort(), [...aside].sort())
  assert.deepEqual(state.scenario.setAsideLocations, FORSAKEN_TOWER_IDS)
  // manifest 的 setAside 区域把 6 座塔也算进去（13 + 6 = 19 张）。
  const asideCount = chapter.manifest.zones.setAside.reduce((sum, entry) => sum + entry.count, 0)
  assert.equal(asideCount, 19)
})

test('setup：缟玛瑙城堡未揭示面朝上（缟玛瑙城堡），揭示后变「大礼堂」', () => {
  const state = setup(stateFor(1))
  const castle = loc(state, 'theOnyxCastle')
  assert.equal(castle.revealed, false)
  assert.equal(castle.name, '缟玛瑙城堡')
  assert.equal(castle.unrevealedActualName, '大礼堂')
  assert.ok(chapter.behavior.moveError(state, inv(state), castle).includes('不能进入'), '未揭示的缟玛瑙城堡不能进入')
  assert.equal(chapter.behavior.movementError(state, inv(state), castle), chapter.behavior.moveError(state, inv(state), castle))
  // 未揭示的隐修院同样不能进入；揭示后放行。
  const monastery = loc(state, 'monasteryOfLeng')
  assert.ok(chapter.behavior.moveError(state, inv(state), monastery))
  monastery.revealed = true
  assert.equal(chapter.behavior.moveError(state, inv(state), monastery), null)
})

// ---------------------------------------------------------------------------
// 3. 混乱标记
// ---------------------------------------------------------------------------
test('混乱标记取值：skull 随幕/密谋编号、tablet -4/-6、cultist 再抽、elderthing 0/-1', () => {
  const state = stateFor(2)
  state.actIndex = 2 // 第 3 幕
  state.agendaIndex = 1 // 第 2 密谋
  const standard = apiStub(state)
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'skull'), { delta: -3 })
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'tablet'), { delta: -4 })
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'cultist'), { delta: 0, drawAnother: true })
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'elder_thing'), { delta: 0 })
  state.difficulty = 'hard'
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'skull'), { delta: -5 })
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'tablet'), { delta: -6 })
  assert.deepEqual(chapter.behavior.resolveChaosToken(state, inv(state), 'elder_thing'), { delta: -1 })
  assert.equal(chapter.behavior.resolveChaosToken(state, inv(state), '+1'), null)
  assert.ok(standard)
})

test('[cultist] 失败：普通只放 1 毁灭；困难放毁灭且检查推进；afterTest 幂等', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const result = { success: false, value: 0, difficulty: 2, drawn: ['cultist'], cancelledTokens: [] }
  chapter.behavior.afterTest(state, inv(state), result, api)
  assert.equal(state.agendas[0].doom, 1, '普通难度：毁灭放在当前密谋上')
  assert.equal(state.doom, 0)
  chapter.behavior.afterTest(state, inv(state), result, api)
  assert.equal(state.agendas[0].doom, 1, 'afterTest 被调两次也只结算一次')
  const hard = setup(stateFor(1))
  hard.difficulty = 'hard'
  chapter.behavior.afterTest(hard, inv(hard),
    { success: false, value: 0, difficulty: 2, drawn: ['cultist'], cancelledTokens: [] }, apiStub(hard))
  assert.equal(hard.doom, 1, '困难难度：走 api.addDoom（放毁灭并检查推进）')
})

test('[tablet] 失败：揭示手中一张奈亚拉托提普并攻击后洗回遭遇牌库', () => {
  const state = setup(stateFor(1))
  inv(state).hand.push('06306')
  inv(state).hiddenCards.push('06306')
  state.encounterDeck = ['06312']
  const api = apiStub(state)
  chapter.behavior.afterTest(state, inv(state),
    { success: false, value: 0, difficulty: 4, drawn: ['tablet'], cancelledTokens: [] }, api)
  assert.equal(inv(state).damage, 0)
  assert.equal(inv(state).horror, 1, '06306 的印刷恐惧 1')
  assert.equal(inv(state).hand.includes('06306'), false)
  assert.equal(inv(state).hiddenCards.includes('06306'), false)
  assert.ok(state.encounterDeck.includes('06306'), '复制品洗回遭遇牌库')
  assert.deepEqual(api.revealed, ['06306'])
})

test('冰封荒土：调查时揭示骷髅标记 → 选择受伤或失去行动', () => {
  const state = setup(stateFor(1))
  const coldWastes = loc(state, 'coldWastes')
  coldWastes.revealed = true
  inv(state).location = coldWastes.id
  const apiDamage = apiStub(state, { choose: () => 'damage' })
  chapter.behavior.afterTest(state, inv(state), {
    success: false, value: 1, difficulty: 3, drawn: ['skull'], cancelledTokens: [],
    source: { label: '调查', code: COLD_WASTES },
  }, apiDamage)
  assert.equal(inv(state).damage, 1)
  assert.equal(inv(state).actionsLeft, 3)
  const state2 = setup(stateFor(1))
  loc(state2, 'coldWastes').revealed = true
  inv(state2).location = 'coldWastes'
  chapter.behavior.afterTest(state2, inv(state2), {
    success: false, value: 1, difficulty: 3, drawn: ['elder_thing'], cancelledTokens: [],
    source: { label: '调查', code: COLD_WASTES },
  }, apiStub(state2, { choose: () => 'loseAction' }))
  assert.equal(inv(state2).damage, 0)
  assert.equal(inv(state2).actionsLeft, 2)
})

// ---------------------------------------------------------------------------
// 4. 幕 / 议程
// ---------------------------------------------------------------------------
test('议程 06287 背面：act 4 时给塔补线索、揭示手中复制品、未持有者受伤或恐惧', () => {
  const state = setup(stateFor(2))
  state.actIndex = 3 // act 4
  // 4 座塔入场（带线索值）。
  for (const id of FORSAKEN_TOWER_IDS.slice(0, 4)) {
    const base = state.scenario.locations[id]
    state.locations.push({ ...clone(base), id, revealed: true, clues: 0, maxClues: 1, doom: 0 })
  }
  inv(state, 0).hand.push('06306')
  inv(state, 0).hiddenCards.push('06306')
  const choices = ['damage', 'shuffled']
  const api = apiStub(state, { choose: () => choices.shift() || 'damage' })
  chapter.behavior.agendaReveal(state, state.agendas[0], api)
  for (const id of FORSAKEN_TOWER_IDS.slice(0, 4)) {
    assert.equal(loc(state, id).clues, 1, '每座塔的线索补到线索值')
  }
  assert.deepEqual(api.revealed, ['06306'], '揭示持有者手中的复制品')
  assert.equal(inv(state, 1).damage, 1, '未持有复制品的调查员受到 1 伤害')
  assert.equal(inv(state, 0).hand.includes('06306'), false)
  assert.ok(state.encounterDeck.includes('06306'), '选择洗回 → 复制品进遭遇牌库')
})

test('幕 1（06290）背面：揭示冷原隐修院并从 set aside 生成大祭司', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  chapter.behavior.actReveal(state, state.acts[0], api)
  assert.equal(loc(state, 'monasteryOfLeng').revealed, true)
  assert.equal(state.scenarioZones.setAside.includes(HIGH_PRIEST), false)
  const priest = state.enemies.find(enemy => enemy.code === HIGH_PRIEST)
  assert.ok(priest, '大祭司生成')
  assert.equal(priest.location, 'monasteryOfLeng')
})

test('幕 3（06292）背面：Grand Design —— 揭示大礼堂、全员移入、移除其它地点、洗入复制品、放 4 座塔', () => {
  const state = setup(stateFor(2))
  state.actIndex = 2
  state.campaign.records[RECORDS.randolphSurvivedTheVoyage] = true
  state.campaign.records[RECORDS.blackCatAtYourSide] = true
  state.encounterDiscard.push('06087')
  const api = apiStub(state)
  chapter.behavior.actReveal(state, state.acts[2], api)
  assert.equal(loc(state, 'theOnyxCastle').revealed, true)
  assert.equal(loc(state, 'theOnyxCastle').name, '大礼堂')
  for (const investigator of state.investigators) assert.equal(investigator.location, 'theOnyxCastle')
  assert.equal(state.locations.length, 1 + 4, '只剩大礼堂 + 4 座塔')
  assert.equal(state.locations.filter(location => location.id !== 'theOnyxCastle').length, 4)
  const copyCount = 1 + state.numInvestigators
  assert.deepEqual(state.scenarioFlags.towerCompass && Object.keys(state.scenarioFlags.towerCompass).length, 4)
  assert.equal(state.encounterDeck.filter(code => NYARLATHOTEP_COPIES.includes(code)).length, copyCount,
    '1+人数 张复制品洗入遭遇牌库')
  assert.equal(state.scenarioZones.setAside.filter(code => NYARLATHOTEP_COPIES.includes(code)).length, 0,
    '全部复制品离开 set aside（洗入或移出游戏）')
  assert.ok(state.encounterDeck.includes(MYRIAD_FORMS))
  assert.ok(state.encounterDeck.includes(THE_CRAWLING_MIST))
  assert.equal(state.scenarioFlags.removedTowers.length, 2)
  assert.ok(Object.values(state.scenarioFlags.towerCompass).every(direction =>
    ['north', 'east', 'south', 'west'].includes(direction)))
})

test('幕 4（06293）背面：记录齐全时把胜利区复制品合成真形（数值取最高/总和），否则进入结局 1', () => {
  const state = setup(stateFor(2))
  state.actIndex = 3
  state.campaign.records[RECORDS.blackCatKnowsTheTruth] = true
  state.campaign.records[RECORDS.silverKey] = true
  state.victoryDisplay.push(
    { id: 'a', code: '06306', originalCode: '06306', victory: 2 },
    { id: 'b', code: '06307', originalCode: '06307', victory: 2 },
  )
  const api = apiStub(state)
  chapter.behavior.actReveal(state, state.acts[3], api)
  const trueShape = state.enemies.find(enemy => enemy.scenarioEnemyRole === 'nyarlathotepTrueShape')
  assert.ok(trueShape, '真形生成')
  assert.equal(trueShape.location, 'theOnyxCastle')
  assert.equal(trueShape.fight, 5, '攻击取最高（06306 的 5）')
  assert.equal(trueShape.evade, 3, '躲避取最高（06307 的 3）')
  assert.equal(trueShape.health, 8, '生命取总和（5 + 3）')
  assert.equal(trueShape.damage, 1)
  assert.equal(trueShape.horror, 1)
  assert.equal(trueShape.victory, 4)
  assert.equal(trueShape.hunter, true)
  assert.equal(trueShape.retaliate, true)
  assert.equal(state.scenarioFlags.trueShapeSpawned, true)

  const miss = setup(stateFor(2))
  miss.actIndex = 3
  miss.victoryDisplay.push({ id: 'a', code: '06306', originalCode: '06306', victory: 2 })
  chapter.behavior.actReveal(miss, miss.acts[3], apiStub(miss))
  assert.equal(miss.resolutionKey, 'resolution1', '缺记录/银钥匙 → 结局 1')
})

test('幕 5（06294）背面：真形被击败 → 结局 2；真形生命按团队线索 -1', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  chapter.behavior.actReveal(state, state.acts[4], api)
  assert.equal(state.resolutionKey, 'resolution2')
  // 食梦者正面：真形生命 -1/团队线索。
  state.actIndex = 4
  inv(state, 0).clues = 2
  inv(state, 1).clues = 1
  const shape = { id: 'shape', scenarioEnemyRole: 'nyarlathotepTrueShape', health: 8 }
  assert.equal(chapter.behavior.enemyStatModifier(state, shape, 'health'), -3)
  assert.equal(chapter.behavior.enemyStatModifier(state, { id: 'x' }, 'health'), 0)
})

// ---------------------------------------------------------------------------
// 5. 塔 / 隐藏手牌 / 敌人
// ---------------------------------------------------------------------------
function towerState() {
  const state = setup(stateFor(1))
  const towerId = FORSAKEN_TOWER_IDS[0]
  const base = state.scenario.locations[towerId]
  state.locations.push({ ...clone(base), id: towerId, revealed: true, clues: 1, maxClues: 1, doom: 0 })
  state.scenarioFlags.towerCompass = { [towerId]: 'north' }
  inv(state).location = towerId
  return { state, towerId }
}

test('塔行动：需要「同方向混沌低语 + 手中奈亚拉托提普」，成功进胜利区、失败洗回', () => {
  const { state, towerId } = towerState()
  assert.equal(chapter.behavior.actions(state, inv(state))
    .some(move => String(move.rule).startsWith('forsakenTower:')), false, '缺低语时无可执行行动')
  inv(state).hand.push('06314')
  inv(state).hiddenCards.push('06314')
  assert.equal(chapter.behavior.actions(state, inv(state))
    .some(move => String(move.rule).startsWith('forsakenTower:')), false, '缺复制品时无可执行行动')
  inv(state).hand.push('06306')
  inv(state).hiddenCards.push('06306')
  const move = chapter.behavior.actions(state, inv(state))
    .find(entry => entry.rule === `forsakenTower:${towerId}`)
  assert.ok(move, '齐全时出现塔行动')
  const success = apiStub(state)
  chapter.behavior.performAction(state, inv(state), move, success)
  assert.equal(state.victoryDisplay.some(card => String(card.code) === '06306'), true, '成功 → 复制品进胜利区')
  assert.equal(state.encounterDiscard.includes('06314'), true, '成功 → 混沌低语被弃掉')
  assert.equal(inv(state).hand.includes('06306'), false)

  const failedState = towerState().state
  inv(failedState).hand.push('06314', '06306')
  inv(failedState).hiddenCards.push('06314', '06306')
  const failMove = chapter.behavior.actions(failedState, inv(failedState))
    .find(entry => entry.rule.startsWith('forsakenTower:'))
  chapter.behavior.performAction(failedState, inv(failedState), failMove,
    apiStub(failedState, { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }) }))
  assert.equal(failedState.encounterDeck.includes('06306'), true)
  assert.equal(failedState.encounterDeck.includes('06314'), true)
})

test('隐藏手牌入口：5 形态的通用 fightHidden/evadeHidden 被关闭（只能经塔/幕揭示）', () => {
  const state = setup(stateFor(1))
  for (const code of NYARLATHOTEP_COPIES) {
    assert.equal(chapter.behavior.canFightHidden(state, inv(state), code), false)
    assert.equal(chapter.behavior.canEvadeHidden(state, inv(state), code), false)
  }
  assert.equal(chapter.behavior.canFightHidden(state, inv(state), '06314'), undefined, '非复制品交回共享层默认')
})

test('大祭司（06311）：不能趁乱攻击；打晕后攻击值 -3 直到本场冒险结束', () => {
  const state = setup(stateFor(1))
  const priest = { id: 'priest', code: HIGH_PRIEST, fight: 5 }
  assert.equal(chapter.behavior.canOpportunityAttack(state, priest), false)
  assert.equal(chapter.behavior.enemyStatModifier(state, priest, 'fight'), 0, '未打晕时不修正')
  state.scenarioFlags.stunnedThePriest = true
  assert.equal(chapter.behavior.enemyStatModifier(state, priest, 'fight'), -3)
})

test('无面欺诈者（06313）：手牌有混沌低语时攻击 +2 伤害并揭示该卡', () => {
  const state = setup(stateFor(1))
  const liar = { id: 'liar', code: '06313' }
  assert.deepEqual(chapter.behavior.enemyAttackModifier(state, liar, inv(state)), {})
  inv(state).hand.push('06315')
  inv(state).hiddenCards.push('06315')
  assert.deepEqual(chapter.behavior.enemyAttackModifier(state, liar, inv(state)), { damage: 2 })
  const api = apiStub(state)
  chapter.behavior.enemyAttackStarted(state, liar, inv(state), api)
  assert.deepEqual(api.revealed, ['06315'])
})

// ---------------------------------------------------------------------------
// 6. 结局 / 记录
// ---------------------------------------------------------------------------
test('结局 1/2/3/4/5/noResolution：记录、精神创伤、胜利区复制品经验与后续去向', () => {
  const build = () => {
    const state = setup(stateFor(1))
    state.victoryDisplay.push({ id: 'a', code: '06306', originalCode: '06306', victory: 2 })
    return state
  }
  const first = build()
  const firstResult = chapter.behavior.resolution(first, 'resolution1', [], {
    choose: () => 'wakeUp', addTrauma: (state, seat, kind, amount) => { state.campaign.records[`trauma:${seat}:${kind}`] = amount },
  })
  assert.deepEqual(firstResult, { award: true, bonus: 2 }, '胜利区复制品胜利点数进入经验')
  assert.equal(first.campaign.records.theDreamersEscapedFromNyarlathotepsGrasp, true)
  assert.equal(first.campaign.records.theDreamersAwoke, true)
  assert.equal(first.campaign.records['trauma:0:mental'], 2)

  const second = build()
  const secondResult = chapter.behavior.resolution(second, 'resolution2', [], {
    choose: () => 'remainOnSurface', addTrauma: () => {},
  })
  assert.deepEqual(secondResult, { award: true, bonus: 7 }, '结局 2：+5 奖励经验 + 胜利区复制品')
  assert.equal(second.campaign.records.theDreamersBanishedNyarlathotep, true)
  assert.equal(second.campaign.records.theDreamersStayedInTheDreamlandsForever, true)

  for (const [key, record] of [
    ['resolution3', 'theDreamersAwoke'],
    ['resolution4', 'theDreamersStayedInTheDreamlandsForever'],
    ['resolution5', 'theDreamersTraveledBeneathTheMonastery'],
  ]) {
    const state = setup(stateFor(1))
    assert.deepEqual(chapter.behavior.resolution(state, key, [], apiStub(state)), { award: false })
    assert.equal(state.campaign.records[record], true)
  }
  const none = setup(stateFor(1))
  assert.deepEqual(chapter.behavior.resolution(none, 'noResolution', [], apiStub(none)), { award: false })
  assert.equal(none.campaign.records.nyarlathotepsInvasionHasBegun, true)
  assert.throws(() => chapter.behavior.resolution(setup(stateFor(1)), 'resolution9', [], apiStub(setup(stateFor(1)))))
})

// ---------------------------------------------------------------------------
// 7. 隐藏手牌 [fast] 行动（06319–06321）
// ---------------------------------------------------------------------------
test('无眠之旅：手牌中时提供 [fast] 弃牌检定，失败在当前密谋放 1 毁灭', () => {
  const state = setup(stateFor(1))
  inv(state).hand.push('06319')
  inv(state).hiddenCards.push('06319')
  const fast = chapter.behavior.fastActions(state, inv(state))
    .find(move => move.rule === 'restlessJourney:06319')
  assert.ok(fast, '手牌中的无眠之旅提供 [fast] 行动')
  chapter.behavior.performAction(state, inv(state), fast,
    apiStub(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, skill }) }))
  assert.equal(inv(state).hand.includes('06319'), false)
  assert.equal(state.encounterDiscard.includes('06319'), true)
  assert.equal(state.doom, 1, '失败放毁灭并检查推进（api.addDoom）')
})

// ---------------------------------------------------------------------------
// 8. 存档往返 / 确定性
// ---------------------------------------------------------------------------
test('同一路线的开始状态在 JSON 往返后完全一致（存档/重放/往返）', () => {
  const build = () => {
    const state = setup(stateFor(2))
    chapter.behavior.preScenarioSetup(state, [], apiStub(state))
    chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同一种子/同一路线必须完全一致')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.encounterDeck, first.encounterDeck)
  assert.deepEqual(restored.encounterDiscard, first.encounterDiscard)
  assert.deepEqual(restored.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.equal(restored.scenario.id, 'whereTheGodsDwell', '路径 scenarios/whereTheGodsDwell/ 的存档')
  assert.equal(JSON.parse(JSON.stringify(first)).scenario.id, definition.id)
})
