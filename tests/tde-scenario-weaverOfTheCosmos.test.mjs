// 《编织宇宙》（Weaver of the Cosmos · 06333）章节测试（P8 worker w-p8-f）。
//
// 两层证据：
//   1. 章节钩子（behavior）：setup 区域/幕展开与推进/神话旋转/混乱标记/结局记录/存档往返；
//   2. 单卡条目（encounter-entries）：逐卡 locationRule / enemyScript / modifiers / threatAction /
//      encounterResolve 的规则行为。索引由 Lead 合并后重建，测试里手动 registerCardAbilities
//      注册本章条目，再直接 import 单卡文件验证（不依赖 implementedFor）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { registerNonPlayerEntries } from '../src/cards/encounter-entries/_lookup.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/index.js'
import {
  scenario as definition, WEB, RING, EXPANSION, LEGS_HOME,
  ATLACH_NACHA, LEGS, SPINNER, WEB_SPINNER, ACT_CODES, AGENDA_CODES,
} from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/definition.js'
import { weaverChaosToken } from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/chaos.js'

// 单卡条目（章节组）
import agendaTheBridgeOfWebs from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06334.js'
import agendaATrailOfTwists from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06335.js'
import agendaRealitiesInterwoven from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06336.js'
import actJourneyAcrossTheBridge from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06337.js'
import actTheWeaverOfTheCosmos from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06338.js'
import actTheSchemesDemise from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06339.js'
import webStairs from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06340.js'
import cosmicWeb from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06341.js'
import tangledWeb from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06342.js'
import prisonOfCocoons from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06343.js'
import vastWeb from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06344.js'
import webWovenIsland from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06345.js'
import atlachNacha from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06346.js'
import legs1 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06347.js'
import legs4 from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06350.js'
import webSpinner from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06351.js'
import spinner from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06352.js'
import caughtInAWeb from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06353.js'
import endlessWeaving from '../src/cards/encounter-entries/theDreamEaters/weaverOfTheCosmos/06354.js'
// 共享组条目（12 个跨章组）
import greyWeaver from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_atlach_nacha/06084.js'
import willOfTheSpiderMother from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_atlach_nacha/06085.js'
import spiderOfLeng from '../src/cards/encounter-entries/theDreamEaters/_shared/spiders/06101.js'
import swarmOfSpiders from '../src/cards/encounter-entries/theDreamEaters/_shared/spiders/06102.js'
import sickeningWebs from '../src/cards/encounter-entries/theDreamEaters/_shared/spiders/06103.js'
import lumbingGug from '../src/cards/encounter-entries/theDreamEaters/_shared/creatures_of_the_underworld/06092.js'
import crawlerEntry from '../src/cards/encounter-entries/theDreamEaters/_shared/agents_of_nyarlathotep/06086.js'
import dholeTunnel from '../src/cards/encounter-entries/theDreamEaters/_shared/terror_of_the_vale/06272.js'
import zoogBurrow from '../src/cards/encounter-entries/theDreamEaters/_shared/zoogs/06109.js'

import whispersOfHypnos from '../src/cards/encounter-entries/theDreamEaters/_shared/whispers_of_hypnos/06090.js'

const MY_ENTRIES = [
  agendaTheBridgeOfWebs, agendaATrailOfTwists, agendaRealitiesInterwoven,
  actJourneyAcrossTheBridge, actTheWeaverOfTheCosmos, actTheSchemesDemise,
  webStairs, cosmicWeb, tangledWeb, prisonOfCocoons, vastWeb, webWovenIsland,
  atlachNacha, legs1, legs4, webSpinner, spinner, caughtInAWeb, endlessWeaving,
  greyWeaver, willOfTheSpiderMother, spiderOfLeng, swarmOfSpiders, sickeningWebs, whispersOfHypnos, crawlerEntry,
  dholeTunnel, zoogBurrow,
]
// 索引重建后引擎已注册全部条目；只有索引尚未重建（Lead 合并前）时才手动补注册。
const missingEntries = MY_ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) {
  registerCardAbilities(missingEntries)
  registerNonPlayerEntries(missingEntries)
}

const clone = value => structuredClone(value)
const loc = (state, id) => state.locations.find(location => location.id === id)

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
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const target = Math.floor(randomValue() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'theGreatWeb1',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3, agility: 3, combat: 3, willpower: 3, intellect: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, records: {},
      investigators: Array.from({ length: count }, () => ({
        deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', '-1', '-2', 'autofail', 'eldersign'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

// 与引擎 placeLocation 相同的语义。
function placeLocations(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    if (!base || loc(state, id)) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    state.locations.push({
      ...clone(base), id, revealed: true, clues, maxClues: clues, doom: 0,
      connections: [...(base.connections || [])],
    })
  }
}

function setupState(count = 2, seed = 1) {
  const state = stateFor(count)
  const ids = chapter.behavior.setupLocations(state, [], setupApi(seed))
  placeLocations(state, ids)
  for (const inv of state.investigators) inv.location = 'theGreatWeb1'
  return state
}

function apiStub(state, overrides = {}) {
  const doomApi = {
    get: location => Number(location?.doom) || 0,
    add: (location, amount = 1) => { location.doom = (Number(location?.doom) || 0) + amount; return location.doom },
    remove: (location, amount = 1) => {
      const removed = Math.min(amount, Number(location?.doom) || 0)
      location.doom = (Number(location?.doom) || 0) - removed
      return removed
    },
    total: () => state.locations.reduce((sum, location) => sum + (Number(location.doom) || 0), 0),
    highest: () => state.locations.reduce((max, location) => Math.max(max, Number(location.doom) || 0), 0),
  }
  return {
    info: () => {},
    present: () => {},
    choose: () => 'skip',
    random: () => 0.5,
    shuffle: items => [...items],
    tokenLabel: token => String(token),
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    trauma: (seat, kind, amount = 1) => { state.campaign.records[`trauma:${seat}:${kind}`] = amount },
    defeat: (inv, cause = null) => { inv.defeated = true; inv.defeatCause = cause },
    spawn: (code, location) => {
      const card = definition.enemies[code] || {}
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.name || code, location: location || null, engagedSeat: null,
        damageTaken: 0, exhausted: false, traits: [...(card.traits || [])],
        health: card.health || 1, fight: card.fight || 0, evade: card.evade || 0,
        massive: card.massive === true, attachments: [],
      }
      state.enemies.push(enemy)
      return enemy
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    healEnemy: (enemy, amount = 1) => {
      const before = enemy.damageTaken || 0
      enemy.damageTaken = Math.max(0, before - amount)
      return before - enemy.damageTaken
    },
    attack: (enemy, inv) => { inv.damage = (inv.damage || 0) + (enemy.damage || 0) },
    damageEnemy: (enemy, amount) => { enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    readyEnemy: enemy => { enemy.exhausted = false },
    exhaustEnemy: enemy => { enemy.exhausted = true },
    skipEnemyAttackThisRound: enemy => { enemy.skipAttackRound = state.round },
    detachEnemyAttachment: (enemyId, attachmentId) => {
      const enemy = state.enemies.find(entry => String(entry.id) === String(enemyId))
      const index = (enemy?.attachments || []).findIndex(attachment => attachment.id === attachmentId)
      if (index < 0) return null
      return enemy.attachments.splice(index, 1)[0]
    },
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value == null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
    },
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    addChaosToken: (token, amount = 1) => {
      state.chaosBag.push(...Array(amount).fill(token))
      state.campaign.chaosBag.push(...Array(amount).fill(token))
    },
    place: id => {
      placeLocations(state, [id])
      const location = loc(state, id)
      if (location) location.revealed = false
      return location
    },
    remove: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
    },
    locationDoom: doomApi,
    threat: (seat, code) => state.investigators[seat].threat.push({ id: `threat-${code}`, code }),
    removeThreat: card => {
      for (const inv of state.investigators) inv.threat = inv.threat.filter(entry => entry !== card)
    },
    attachStoryAssetToEnemy: (code, enemyId, extra = {}) => {
      const enemy = state.enemies.find(entry => String(entry.id) === String(enemyId))
      if (!enemy) return null
      enemy.attachments ||= []
      const attachment = { id: `att-${code}`, code, originalCode: code, ...extra }
      enemy.attachments.push(attachment)
      return attachment
    },
    preventEnemyReady: (enemy, rounds = 1) => {
      enemy.preventReady = { from: state.round, rounds }
      return true
    },
    detachLocationAttachment: (locationId, attachmentId) => {
      const location = loc(state, locationId)
      const index = (location?.attachments || []).findIndex(attachment => attachment.id === attachmentId)
      if (index < 0) return null
      return location.attachments.splice(index, 1)[0]
    },
    attachToLocation: (locationId, fields = {}) => {
      const location = loc(state, locationId)
      if (!location) return null
      location.attachments ||= []
      location.attachments.push({ id: `locatt-${fields.code}`, ...fields })
      return location.attachments.at(-1)
    },
    attachToAgenda: (code, extra = {}) => {
      const agenda = state.agendas[state.agendaIndex]
      agenda.attachments ||= []
      agenda.attachments.push({ id: `agatt-${code}`, code, ...extra })
      return agenda.attachments.at(-1)
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes) },
    shuffleEncounterDeck: () => {},
    shuffleDiscard: () => {
      state.encounterDeck.push(...state.encounterDiscard)
      state.encounterDiscard = []
    },
    discardEncounterCard: code => {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0])
      return true
    },
    takeEncounterDiscard: code => {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      return true
    },
    swarm: {
      countOf: host => (host?.swarmCards || []).filter(card => !card.defeated).length,
      place: (host, count) => {
        host.swarmCards ||= []
        const added = []
        for (let index = 0; index < count; index += 1) {
          const code = state.encounterDeck.shift()
          if (!code) break
          const card = { id: `swarm-${index}-${host.id}`, code, hostId: host.id, defeated: false }
          host.swarmCards.push(card)
          added.push(card)
        }
        return added
      },
      clear: host => {
        for (const card of host?.swarmCards || []) card.defeated = true
      },
      cardsOf: host => (host?.swarmCards || []).filter(card => !card.defeated),
    },
    advanceAct: () => { state.actIndex += 1 },
    finish: key => { state.finishedWith = key },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    loseActions: (seat, n) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - n) },
    discardChosen: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    test: (seat, skill, difficulty, resolve) => {
      const override = state.__testResults?.shift()
      const result = override || { success: true, value: difficulty + 1, difficulty, skill, drawn: [], cancelledTokens: [] }
      resolve(result)
      return result
    },
    applyPenalty: (seat, fail, failedBy) => {
      state.__penalties ||= []
      state.__penalties.push({ seat, fail, failedBy })
      if (fail?.kind === 'damageAndHorror') {
        state.investigators[seat].damage += fail.damage || 0
        state.investigators[seat].horror += fail.horror || 0
      }
    },
    verticalChain: {
      order: () => RING.map(id => loc(state, id)).filter(Boolean),
    },
    ...overrides,
  }
}

const finish = (state, key) => { state.finishedWith = key }

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('06333 章节清单：development、原卡、地点/幕/议程/结局数量', () => {
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.contentVersion, '1.0.0')
  assert.equal(chapter.manifest.referenceCode, '06333', '剧本参考卡以 referenceCode 记录落点')
  assert.equal(chapter.scenario.originalCode, '06333')
  assert.equal(chapter.manifest.locations.length, 11)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
  assert.equal(chapter.manifest.startLocationId, 'theGreatWeb1')
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds].sort(),
    ['agentsOfAtlachNacha', 'ancientEvils', 'chillingCold', 'spiders', 'weaverOfTheCosmos'])
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'tdeCampaign']) // 印刷包由 tdeCampaign cardRanges 覆盖
})

test('身份登记：地点/幕/议程/敌人/诡计都有原卡身份且 mapped', () => {
  const categories = chapter.identities
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries']) {
    for (const [id, identity] of Object.entries(categories[category])) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(categories.enemies[ATLACH_NACHA].originalCode, '06346')
  assert.equal(categories.treacheries[SPINNER].originalCode, '06352')
})

test('布局：坐标为全部地点覆盖，layout.edges 与 connections 双向一致', () => {
  const locationIds = Object.keys(definition.locations).sort()
  assert.deepEqual(Object.keys(chapter.layout.locations).sort(), locationIds)
  for (const edge of chapter.layout.edges) {
    assert.ok(definition.locations[edge.from].connections.includes(edge.to),
      `${edge.from}→${edge.to} 不是规则连接`)
  }
  const expected = Object.values(definition.locations)
    .flatMap(location => location.connections.map(to => `${location.id}>${to}`)).sort()
  assert.deepEqual(chapter.layout.edges.map(edge => `${edge.from}>${edge.to}`).sort(), expected)
})

// ---------------------------------------------------------------------------
// 2. setup / 区域守恒
// ---------------------------------------------------------------------------
test('setup：4 张巨网入场、7 张放一边、阿特拉克与四条腿/织网者全在一边', () => {
  const state = stateFor(2)
  const ids = chapter.behavior.setupLocations(state, [], setupApi(3))
  assert.deepEqual(ids, [...WEB])
  assert.deepEqual(state.scenarioZones.setAside,
    [ATLACH_NACHA, ...LEGS, SPINNER, SPINNER])
  assert.equal(chapter.manifest.zones.setAside.reduce((sum, entry) => sum + entry.count, 0), 14,
    '7 张展开巨网 + 8 张敌人/织网者')
})

test('afterChaosBagSetup：三张议程毁灭阈值 +2×调查员数（printed 7/9/11）', () => {
  const state = stateFor(3)
  chapter.behavior.afterChaosBagSetup(state)
  assert.equal(state.agendas[0].doomThreshold, 7 + 2 * 3)
  assert.equal(state.agendas[1].doomThreshold, 9 + 2 * 3)
  assert.equal(state.agendas[2].doomThreshold, 11 + 2 * 3)
})

test('afterDeckSetup：Steps of the Bridge 的 tally 数换算成最下方巨网的毁灭', () => {
  const cases = [[0, 0], [2, 0], [3, 1], [6, 2], [9, 3], [12, 4]]
  for (const [tally, doom] of cases) {
    const state = setupState(2)
    state.campaign.records.stepsOfTheBridge = tally
    chapter.behavior.afterDeckSetup(state, [], { info: () => {} })
    assert.equal(loc(state, 'theGreatWeb4').doom, doom, `tally ${tally}`)
  }
})

// ---------------------------------------------------------------------------
// 3. 幕 1 展开 + 四条腿 + 旋转
// ---------------------------------------------------------------------------
test('幕 1 背面：移除 1-3、展开 7 张、四条腿出现在 11/5/9/7、2 张织网者洗入遭遇牌库', () => {
  const state = setupState(2)
  state.encounterDeck = ['06101']
  const api = apiStub(state)
  chapter.behavior.actLeftPlay(state, state.acts[0], api)
  assert.equal(state.locations.length, 8, '保留 theGreatWeb4 + 新放 7 张')
  for (const id of WEB.slice(0, 3)) assert.equal(loc(state, id), undefined, `${id} 已移除`)
  for (const id of EXPANSION) assert.ok(loc(state, id), `${id} 已入场`)
  const legs = state.enemies.filter(enemy => LEGS.includes(enemy.originalCode))
  assert.equal(legs.length, 4)
  for (const [code, locationId] of Object.entries(LEGS_HOME)) {
    const enemy = legs.find(entry => entry.originalCode === code)
    assert.equal(enemy.location, locationId, `${code} 应在 ${locationId}`)
  }
  assert.equal(state.encounterDeck.filter(code => code === SPINNER).length, 2)
  assert.equal(state.scenarioFlags.atlachCenter.assembled, true)
  assert.equal(state.scenarioFlags.atlachNachaEnemySide, undefined, '幕 2 前中心牌未翻面')
})

test('神话阶段旋转：负修正标记把四条腿沿 8 段环顺时针移动 X 格', () => {
  const state = setupState(2)
  chapter.behavior.actLeftPlay(state, state.acts[0], apiStub(state))
  state.actIndex = 1
  state.chaosBag = ['-2']
  const api = apiStub(state)
  const before = Object.fromEntries(LEGS.map(code => [code,
    state.enemies.find(enemy => enemy.originalCode === code).location]))
  chapter.behavior.phaseBegan(state, 'mythos', api)
  for (const code of LEGS) {
    const enemy = state.enemies.find(entry => entry.originalCode === code)
    const index = RING.indexOf(before[code])
    assert.equal(enemy.location, RING[(index + 2) % RING.length], `${code} 顺时针 2 格`)
  }
  assert.equal(state.scenarioFlags.atlachRotation, 90)
})

test('调查阶段结束（神话开始时）06342 缠结之网：有调查员的巨网各放 1 毁灭', () => {
  const state = setupState(2)
  chapter.behavior.actLeftPlay(state, state.acts[0], apiStub(state))
  state.investigators[0].location = 'theGreatWeb9'
  state.investigators[1].location = 'theGreatWeb9'
  chapter.behavior.phaseBegan(state, 'mythos', apiStub(state))
  assert.equal(loc(state, 'theGreatWeb9').doom, 1)
  assert.equal(loc(state, 'theGreatWeb10').doom, 0)
})

// ---------------------------------------------------------------------------
// 4. 幕 2/3 推进与结局
// ---------------------------------------------------------------------------
test('幕 2 背面：阿特拉克·纳克亚在毁灭最多的地点以敌人面生成', () => {
  const state = setupState(2)
  const api = apiStub(state)
  chapter.behavior.actLeftPlay(state, state.acts[0], api)
  loc(state, 'theGreatWeb9').doom = 3
  loc(state, 'theGreatWeb5').doom = 1
  chapter.behavior.actLeftPlay(state, state.acts[1], api)
  const atlach = state.enemies.find(enemy => enemy.originalCode === ATLACH_NACHA)
  assert.ok(atlach, '阿特拉克·纳克亚已生成')
  assert.equal(atlach.location, 'theGreatWeb9')
  assert.equal(state.scenarioFlags.atlachNachaEnemySide, true)
})

test('幕 3 推进：按战役记录选择 R3/R4/R5（无记录 → R5）', () => {
  const cases = [
    [{}, 'resolution5'],
    [{ theInvestigatorsAreTrappedInAtlachNachasRealm: true }, 'resolution4'],
    [{ theInvestigatorsFoundAWayOutOfTheUnderworld: true }, 'resolution3'],
  ]
  for (const [records, expected] of cases) {
    const state = setupState(2)
    Object.assign(state.campaign.records, records)
    const api = apiStub(state)
    chapter.behavior.actLeftPlay(state, state.acts[2], api)
    assert.equal(state.finishedWith, expected)
    assert.equal(state.scenarioFlags.finaleResolution, expected)
  }
})

test('checkObjectives：幕 1 全员在最下方 + 团队 3/人线索 → advanceAct', () => {
  const state = setupState(2)
  const api = apiStub(state)
  state.investigators.forEach(inv => { inv.location = 'theGreatWeb4'; inv.clues = 3 })
  chapter.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 1)
})

test('checkObjectives：幕 2 胜利区 4 条腿 → advanceAct；幕 3 atlachNachaDefeated → advanceAct', () => {
  const state = setupState(2)
  const api = apiStub(state)
  state.actIndex = 1
  state.victoryDisplay = LEGS.map(code => ({ code, originalCode: code }))
  chapter.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2)
  state.scenarioFlags.atlachNachaDefeated = true
  chapter.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 3)
})

// ---------------------------------------------------------------------------
// 5. 议程 / 混乱标记 / 结局记录
// ---------------------------------------------------------------------------
test('议程推进：06334/35 把遭遇弃牌堆洗回；06336 推进 → 结局 2', () => {
  const state = setupState(2)
  state.encounterDiscard = ['06101', '06103']
  const api = apiStub(state)
  chapter.behavior.agendaAdvancing(state, state.agendas[0], api)
  assert.deepEqual(state.encounterDeck, ['06101', '06103'])
  assert.deepEqual(state.encounterDiscard, [])
  chapter.behavior.agendaAdvancing(state, state.agendas[2], api)
  assert.equal(state.finishedWith, 'resolution2')
})

test('混乱标记数值：skull 标准=最高地点毁灭、困难=地点毁灭总数；tablet/elderthing 分档', () => {
  const state = setupState(2)
  loc(state, 'theGreatWeb1').doom = 2
  loc(state, 'theGreatWeb2').doom = 1
  assert.equal(weaverChaosToken(state, null, 'skull', null), -2)
  state.difficulty = 'hard'
  assert.equal(weaverChaosToken(state, null, 'skull', null), -3)
  assert.equal(weaverChaosToken(state, null, 'tablet', null), -1)
  assert.equal(weaverChaosToken(state, null, 'elderthing', null), -4)
  state.difficulty = 'standard'
  assert.equal(weaverChaosToken(state, null, 'tablet', null), 0)
  assert.equal(weaverChaosToken(state, null, 'elderthing', null), -3)
})

test('afterTest：elderthing 在对蜘蛛敌人的攻击失败 → 该敌人地点 +1 毁灭（只结算一次）', () => {
  const state = setupState(2)
  const spider = apiStub(state).spawn('06102', 'theGreatWeb1')
  spider.traits = ['Creature', 'Spider']
  const result = {
    success: false, value: 1, difficulty: 3, drawn: ['elderthing'], cancelledTokens: [],
    source: { action: 'fight' }, target: { enemy: spider },
  }
  chapter.behavior.afterTest(state, state.investigators[0], result, apiStub(state))
  assert.equal(loc(state, 'theGreatWeb1').doom, 1)
  chapter.behavior.afterTest(state, state.investigators[0], result, apiStub(state))
  assert.equal(loc(state, 'theGreatWeb1').doom, 1, '同一 result 幂等')
})

test('结局记录与创伤：resolution5 记录仍在幻梦境 + 2 物理创伤', () => {
  const state = stateFor(2)
  const api = apiStub(state)
  const result = chapter.behavior.resolution(state, 'resolution5', [], api)
  assert.equal(state.campaign.records.theInvestigatorsAreStillInTheDreamlands, true)
  assert.equal(state.campaign.records['trauma:0:physical'], 2)
  assert.deepEqual(result, { award: true, bonus: 5 })
})

// ---------------------------------------------------------------------------
// 6. 章节数据分派（spawnLocation / 行动 / 移动限制 / 攻击加值）
// ---------------------------------------------------------------------------
test('spawnLocation：06351 织网者生成在任意无人地点', () => {
  const state = setupState(2)
  state.investigators[0].location = 'theGreatWeb1'
  state.investigators[1].location = 'theGreatWeb1'
  chapter.behavior.actLeftPlay(state, state.acts[0], apiStub(state))
  state.locations.forEach(location => { location.revealed = true })
  const api = apiStub(state)
  const id = chapter.behavior.spawnLocation(state, WEB_SPINNER, null, null, api)
  assert.ok(id, '返回了生成地点')
  const empty = state.locations.filter(location =>
    !state.investigators.some(inv => inv.location === location.id))
  assert.ok(empty.some(location => location.id === id), '生成点无人')
})

test('幕行动：花费 1 线索对所在地点[[古神]]敌人造成 3 点伤害', () => {
  const state = setupState(2)
  chapter.behavior.actLeftPlay(state, state.acts[0], apiStub(state))
  state.actIndex = 1
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb5'
  inv.clues = 2
  const api = apiStub(state)
  const enemy = api.spawn('06346', 'theGreatWeb5')
  const moves = chapter.behavior.actions(state, inv)
  const move = moves.find(entry => entry.rule === 'spendClueDamageAncientOne')
  assert.ok(move, '合法行动里有「花费线索造成伤害」')
  chapter.behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 1)
  const damaged = state.enemies.filter(entry => entry.location === 'theGreatWeb5'
    && (entry.traits || []).includes('Ancient One'))
  assert.equal(damaged.reduce((sum, entry) => sum + (entry.damageTaken || 0), 0), 3,
    '对所在地点的一个[[古神]]敌人造成 3 点伤害')
  void enemy
})

test('moveError：陷入网中（06353）每轮只允许 1 次移动', () => {
  const state = setupState(2)
  const inv = state.investigators[0]
  inv.threat = [{ id: 'threat-06353', code: '06353' }]
  assert.equal(chapter.behavior.moveError(state, inv, 'theGreatWeb2'), undefined, '第一次移动允许')
  const api = apiStub(state)
  chapter.behavior.locationEntered(state, inv, loc(state, 'theGreatWeb1'), api)
  assert.match(chapter.behavior.moveError(state, inv, 'theGreatWeb2'), /最多 1 次移动/)
})

test('enemyAttackModifier：黑暗中的织网者附属的古神敌人 +1 伤害/+1 恐惧', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const enemy = api.spawn('06084', 'theGreatWeb1')
  assert.equal(chapter.behavior.enemyAttackModifier(state, enemy), undefined)
  api.attachStoryAssetToEnemy(SPINNER, enemy.id, { originalCode: SPINNER })
  assert.deepEqual(chapter.behavior.enemyAttackModifier(state, enemy), { damage: 1, horror: 1 })
})

// ---------------------------------------------------------------------------
// 7. 单卡条目直接验证
// ---------------------------------------------------------------------------
test('地点条目：06340 揭示放毁灭、06342 调查阶段末放毁灭、06344 正对面移动', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const stairs = loc(state, 'theGreatWeb1')
  stairs.doom = 0
  webStairs.locationRule.onReveal(state, stairs, api)
  assert.equal(stairs.doom, 1)

  const tangled = loc(state, 'theGreatWeb3')
  state.investigators[0].location = 'theGreatWeb3'
  tangled.doom = 0
  tangledWeb.locationRule.onInvestigationPhaseEnd(state, tangled, api)
  assert.equal(tangled.doom, 1)

  chapter.behavior.actLeftPlay(state, state.acts[0], api)
  state.actIndex = 1
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb4'
  const moves = []
  vastWeb.locationRule.actions({ moves, state, inv, location: loc(state, 'theGreatWeb4') })
  const move = moves.find(entry => entry.rule === 'greatWebAcrossMove')
  assert.ok(move)
  vastWeb.locationRule.performAction(state, inv, move, api)
  assert.equal(inv.location, 'theGreatWeb8', '8 段环的正对面（4 → 8）')
})

test('地点条目：06341/06343 进入检定失败后二选一（放毁灭 / 弃牌 / 失去行动）', () => {
  const state = setupState(2)
  const api = apiStub(state, { choose: () => 'doom' })
  const failed = { success: false, value: 1, difficulty: 3, skill: 'willpower', drawn: [], cancelledTokens: [] }
  state.__testResults = [failed]
  const location = loc(state, 'theGreatWeb1')
  cosmicWeb.locationRule.onEnter.effect(state, location, api, state.investigators[0])
  assert.equal(location.doom, 1)
  assert.equal(state.investigators[0].hand.length, 0, '选择放毁灭时不弃牌')

  const state2 = setupState(2)
  state2.investigators[0].hand = ['01001', '01002', '01003']
  const api2 = apiStub(state2, { choose: () => 'discard' })
  state2.__testResults = [{ ...failed, skill: 'willpower' }]
  const cosmic = loc(state2, 'theGreatWeb1')
  cosmicWeb.locationRule.onEnter.effect(state2, cosmic, api2, state2.investigators[0])
  assert.equal(state2.investigators[0].hand.length, 1, '失败 2 点弃 2 张手牌')

  const state3 = setupState(2)
  const api3 = apiStub(state3, { choose: () => 'actions' })
  state3.__testResults = [{ ...failed, skill: 'agility' }]
  const cocoons = loc(state3, 'theGreatWeb1')
  const actionsBefore = state3.investigators[0].actionsLeft
  prisonOfCocoons.locationRule.onEnter.effect(state3, cocoons, api3, state3.investigators[0])
  assert.equal(state3.investigators[0].actionsLeft, actionsBefore - 2, '失败 2 点失去 2 个行动')
})

test('敌人条目：06346 离开地点时（无调查员）放毁灭；06347 修正 = 地点遮蔽值且不能借机攻击', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const atlach = api.spawn(ATLACH_NACHA, 'theGreatWeb5')
  chapter.behavior.actLeftPlay(state, state.acts[0], api)
  chapter.behavior.actLeftPlay(state, state.acts[1], api)
  atlach.location = 'theGreatWeb6'
  state.investigators.forEach(inv => { inv.location = 'theGreatWeb4' })
  atlachNacha.enemyScript.onMoved(state, atlach, 'theGreatWeb5', api)
  assert.equal(loc(state, 'theGreatWeb5').doom, 1, '离开的旧地点没有调查员 → 放毁灭')

  const fightModifier = legs4.modifiers.find(modifier => modifier.target === 'enemyFight')
  const legsEnemy = { code: '06350', originalCode: '06350', location: 'theGreatWeb5' }
  // 06347-350 的印刷 fight 是 X 占位 -2；修正后净值 = 地点遮蔽值。
  const shroud = Number(loc(state, 'theGreatWeb5').shroud || 0)
  assert.equal(-2 + fightModifier.amount({ state, entity: legsEnemy }), shroud)
  assert.ok(legs4.modifiers.some(modifier => modifier.target === 'cannot:opportunityAttack'))
})

test('敌人条目：06346 躲避替代 = 不横置 + 本轮不攻击；06351 轮末重整则放毁灭', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const atlach = api.spawn(ATLACH_NACHA, 'theGreatWeb1')
  atlach.exhausted = true
  atlachNacha.enemyScript.onEvade(state, state.investigators[0], atlach, { success: true }, api)
  assert.equal(atlach.exhausted, false, '不横置')
  assert.equal(atlach.skipAttackRound, state.round, '本轮不攻击')
  assert.equal(state.scenarioFlags.atlachNachaEvadeProtected.round, state.round)

  const spinnerEnemy = api.spawn(WEB_SPINNER, 'theGreatWeb1')
  spinnerEnemy.exhausted = false
  webSpinner.enemyScript.onRoundEnd(state, spinnerEnemy, api)
  assert.equal(loc(state, 'theGreatWeb1').doom, 1, '重整状态 → 所在地点放毁灭')
})

test('诡计条目：06353 进威胁区 + 敏捷修正；06354 场上无蜘蛛时从牌库生成一张', () => {
  const state = setupState(2)
  const api = apiStub(state)
  caughtInAWeb.encounterResolve(state, state.investigators[0], { code: '06353' }, api)
  assert.equal(state.investigators[0].threat.length, 1)
  assert.deepEqual(caughtInAWeb.modifiers, [{ target: 'skill:agility', amount: -1 }])
  assert.equal(caughtInAWeb.threatAction.difficulty, 3)

  state.encounterDeck = ['06102', '06103']
  endlessWeaving.encounterResolve(state, state.investigators[0], { code: '06354' }, api)
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '06102'), '从遭遇牌库抽出了蛛群')
})

test('共享组条目：06090 本轮所选技能 -2（共享 statModifier 读 scenarioFlags）', () => {
  const state = setupState(2)
  const api = apiStub(state, { choose: () => 'willpower' })
  whispersOfHypnos.encounterResolve(state, state.investigators[0], { code: '06090' }, api)
  assert.equal(chapter.behavior.statModifier(state, state.investigators[0], 'willpower'), -2)
  assert.equal(chapter.behavior.statModifier(state, state.investigators[0], 'agility'), 0)
  assert.equal(state.scenarioFlags.whispersOfHypnos.round, state.round)
})

test('共享组条目：06086 攻击/躲避难度按手牌遭遇卡数（enemyStatRule 数据契约）', () => {
  // 数据契约：共享 enemyStatModifier 的 per.source='encounterCardsInHand'（Lead 已实现）。
  // 06086 属于 agents_of_nyarlathotep 组（不在本章遭遇牌库），条目数据仍按跨章共享组维护。
  const entry = crawlerEntry
  assert.deepEqual(entry.enemyRule, { prey: 'mostCardsInHand' })
  const sources = entry.enemyStatRule.per.map(row => `${row.stat}:${row.source}:${row.amount}`)
  assert.deepEqual(sources, ['fight:encounterCardsInHand:1', 'evade:encounterCardsInHand:1'])
})

test('共享组条目：06092 横置后下一个补给阶段不再重整（api.preventEnemyReady）', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const gug = api.spawn('06092', 'theGreatWeb1')
  lumbingGug.enemyScript.onAttackResolved(state, gug, state.investigators[0], api)
  assert.deepEqual(gug.preventReady, { from: state.round, rounds: 1 })
})

test('共享组条目：06103 恶心蛛网的蜘蛛关键词/移动封锁/摆脱行动（章节 behavior 接线）', () => {
  const state = setupState(2)
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = 'theGreatWeb1'
  sickeningWebs.encounterResolve(state, inv, { code: '06103' }, api)
  const spider = api.spawn('06102', 'theGreatWeb1')
  chapter.behavior.phaseBegan(state, 'mythos', api)
  assert.equal(spider.retaliate, true)
  assert.equal(spider.alert, true)
  assert.match(chapter.behavior.moveError(state, inv, 'theGreatWeb2'), /不能移动离开/)
  const moves = chapter.behavior.actions(state, inv)
  const discardMove = moves.find(entry => String(entry.rule).startsWith('discardSickeningWebs:'))
  assert.ok(discardMove, '地点附属的摆脱行动已列出')
  // 摆脱成功 → 附属移除并进遭遇弃牌堆。
  state.__testResults = [{ success: true, value: 4, difficulty: 3, skill: 'combat', drawn: [], cancelledTokens: [] }]
  const api2 = apiStub(state, { choose: () => 'combat' })
  chapter.behavior.performAction(state, inv, discardMove, api2)
  assert.equal((loc(state, 'theGreatWeb1').attachments || []).length, 0)
  assert.ok(state.encounterDiscard.includes('06103'))
})

test('共享组条目：06084 猎物覆盖、06102 躲避值 = 地点蛛群数、06272 附属地点或推进巨噬蠕虫', () => {
  assert.deepEqual(greyWeaver.enemyRule, { prey: 'lowestAgility' })
  const evadeModifier = swarmOfSpiders.modifiers.find(modifier => modifier.target === 'enemyEvade')
  const state = setupState(2)
  const api = apiStub(state)
  const host = api.spawn('06102', 'theGreatWeb1')
  host.swarmCards = [{ id: 's1', code: '06102', defeated: false }]
  const count = evadeModifier.amount({ state, entity: host })
  assert.equal(-2 + count, 2, '印刷占位 -2 + (1 个头领 + 1 蜂拥 + 2) = 2')

  const tunnelState = setupState(2)
  const tunnelApi = apiStub(tunnelState)
  const agent = tunnelState.investigators[0]
  agent.location = 'theGreatWeb1'
  dholeTunnel.encounterResolve(tunnelState, agent, { code: '06272' }, tunnelApi)
  assert.ok(tunnelState.locations.some(location =>
    (location.attachments || []).some(attachment => attachment.code === '06272')),
  '巨噬蠕虫隧道附属到某个地点')
})

test('共享组条目：06085 失败后本轮不能攻击/调查（共享 restrictionActive 读 scenarioFlags.failRestricts）', () => {
  const state = setupState(2)
  const api = apiStub(state)
  state.__testResults = [{ success: false, value: 1, difficulty: 3, skill: 'willpower', drawn: [], cancelledTokens: [] }]
  willOfTheSpiderMother.encounterResolve(state, state.investigators[0], { code: '06085' }, api)
  assert.equal(state.scenarioFlags.failRestricts[0].round, state.round)
  // 章节 behavior 展开共享 encounterRules：canFightEnemy / investigationError 直接生效。
  assert.equal(chapter.behavior.canFightEnemy(state, state.investigators[0]), false)
  assert.match(chapter.behavior.investigationError(state, state.investigators[0]), /无法调查/)
})

// ---------------------------------------------------------------------------
// 8. 存档 / 回放 / 往返
// ---------------------------------------------------------------------------
test('存档往返：章节 setup 后的状态 JSON.stringify 两次相等，parse 后各区域一致', () => {
  const state = setupState(3)
  chapter.behavior.afterChaosBagSetup(state)
  state.campaign.records.stepsOfTheBridge = 7
  chapter.behavior.afterDeckSetup(state, [], { info: () => {} })
  const first = JSON.stringify(state)
  const second = JSON.stringify(state)
  assert.equal(first, second)
  const parsed = JSON.parse(first)
  assert.deepEqual(parsed.locations.map(entry => entry.id), state.locations.map(entry => entry.id))
  assert.deepEqual(parsed.agendas.map(entry => entry.doomThreshold), state.agendas.map(entry => entry.doomThreshold))
  assert.equal(parsed.campaign.records.stepsOfTheBridge, 7)
  assert.deepEqual([...new Set(parsed.enemies.map(entry => entry.originalCode))].sort(),
    [...new Set(state.enemies.map(entry => entry.originalCode))].sort())
})
