// 验收测试：06-a 食梦者 · 分片 4（sfk 06133–06154）
// 覆盖 25 张既有测试标题不含卡号的卡（06133/06133b/06134/06135/06135b/06136/06136b/06137b/
// 06138b/06139/06139b/06140/06140b/06141/06141b/06142b/06143/06143b/06144/06146/06148/
// 06149/06150/06151/06152）：标题含卡号，走单卡条目 + 章节 behavior 的真实代码路径并断言状态。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredCodes } from '../src/engine/ability.js'
import { playCost } from '../src/engine/engine.js'
import { flipVeiledLocation } from '../src/engine/veiled.js'
import { swarmCountOf } from '../src/engine/swarm.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import { scenario as definition } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/definition.js'
import { assetRuleFor, enemyRuleFor, locationRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const behavior = chapter.behavior

// 本章单卡条目注册（与既有章节测试同一过渡办法：不依赖已重建的索引）。
const here = dirname(fileURLToPath(import.meta.url))
const ENTRY_DIR = resolve(here, '../src/cards/encounter-entries/theDreamEaters/theSearchForKadath')
const ENTRIES = []
for (const name of readdirSync(ENTRY_DIR).filter(name => name.endsWith('.js')).sort()) {
  const module = await import(pathToFileURL(resolve(ENTRY_DIR, name)).href)
  if (module.default) ENTRIES.push(module.default)
}
const alreadyRegistered = new Set(registeredCodes())
const pendingEntries = ENTRIES.filter(entry => !alreadyRegistered.has(entry.code))
if (pendingEntries.length) registerCardAbilities(pendingEntries)

const clone = value => structuredClone(value)

function makeState({ numInvestigators = 2, difficulty = 'standard', records = {} } = {}) {
  const scenario = clone(definition)
  return {
    scenario,
    difficulty,
    numInvestigators,
    investigators: Array.from({ length: numInvestigators }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, code: `0100${seat + 1}`, location: 'ulthar',
      damage: 0, horror: 0, clues: 0, resources: 5, actionsLeft: 3,
      hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
      defeated: false, resigned: false,
    })),
    campaign: { leadSeat: 0, records: { ...records }, investigators: [] },
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [...scenario.encounterDeck],
    encounterDiscard: [],
    doom: 0,
    round: 1,
    phase: 'investigation',
    currentSeat: 0,
    turnSerial: 0,
    markerCounts: {},
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    chaosBag: [],
    status: 'playing',
  }
}

function addLocation(state, id, extra = {}) {
  const base = state.scenario.locations[id]
  assert.ok(base, `缺少地点定义 ${id}`)
  const location = {
    ...clone(base), id, revealed: true,
    clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    ...extra,
  }
  state.locations.push(location)
  return location
}

function makeApi(state, overrides = {}) {
  const calls = {
    info: [], healHorror: [], healDamage: [], drawCards: [], gainResources: [], damage: [], horror: [],
    tests: [], spawns: [], banished: [], moved: [], markers: [], discardedEnemies: [], attacks: [],
    skipped: [], setAside: [], restored: [], gaveAssets: [], drewDiscard: [], discardedHand: [], placed: [],
  }
  const choices = [...(overrides.choices || [])]
  const outcomes = [...(overrides.outcomes || [])]
  const api = {
    calls,
    info: text => calls.info.push(String(text)),
    present: text => calls.info.push(String(text)),
    choose: request => (choices.length ? choices.shift() : (request?.options?.[0]?.id ?? 'skip')),
    random: () => 0.5,
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    campaignRecord: key => state.campaign.records?.[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    markers: {
      get: (id = 'reference') => Number(state.markerCounts?.[id]) || 0,
      add: (id = 'reference', delta = 1) => {
        state.markerCounts ||= {}
        state.markerCounts[id] = Math.max(0, (Number(state.markerCounts[id]) || 0) + delta)
        calls.markers.push({ id, delta })
        return state.markerCounts[id]
      },
      set: (id, value) => { state.markerCounts ||= {}; state.markerCounts[id] = value; return value },
    },
    cardName: code => definition.storyFaces?.[code]?.name || ALL_CARDS[code]?.nameZh || `卡${code}`,
    cardTraits: code => (definition.storyFaces?.[code]?.traits || ALL_CARDS[code]?.traits || []).slice(),
    cardType: code => ALL_CARDS[code]?.type || null,
    cardSanity: () => 4,
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside
      if (!Array.isArray(list)) return false
      const index = list.indexOf(String(code))
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...(Array.isArray(codes) ? codes : [codes])) },
    shuffleEncounterDeck: () => {},
    shuffleDiscard: () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] },
    discardEncounterCard: (code, options = {}) => {
      const index = state.encounterDeck.lastIndexOf(String(code))
      if (index >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0]); return true }
      if (options.includeDiscard !== true) return false
      const discardIndex = state.encounterDiscard.lastIndexOf(String(code))
      if (discardIndex < 0) return false
      state.encounterDiscard.splice(discardIndex, 1)
      return true
    },
    takeEncounterDiscard: (code, options = {}) => {
      const index = state.encounterDiscard.lastIndexOf(String(code))
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      if (options.toDeck) state.encounterDeck.push(String(code))
      return true
    },
    spawn: (code, locationId) => {
      const enemy = {
        id: `enemy-${calls.spawns.length + 1}`, originalCode: code, code, location: locationId,
        engagedSeat: null, damageTaken: 0, doom: 0, swarmCards: [],
      }
      state.enemies.push(enemy)
      calls.spawns.push({ code, locationId })
      return enemy
    },
    place: id => {
      const base = state.scenario.locations?.[id]
      if (!base) return null
      if (state.locations.some(location => location.id === id)) return null
      const location = {
        ...clone(base), id, revealed: true,
        clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
      }
      state.locations.push(location)
      calls.placed.push(id)
      return location
    },
    removeLocationFromGame: (id, options = {}) => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index < 0) return null
      const [removed] = state.locations.splice(index, 1)
      if (options.discardEnemies !== false) {
        state.enemies = state.enemies.filter(enemy => enemy.location !== id)
      }
      return removed
    },
    moveInvestigator: (seat, locationId) => {
      state.investigators[seat].location = locationId
      calls.moved.push({ seat, locationId })
    },
    moveEnemy: (enemy, locationId) => { enemy.location = locationId },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push({ seat, amount }) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push({ seat, amount }) },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount); calls.healDamage.push({ seat, amount }) },
    healHorror: (seat, amount) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount); calls.healHorror.push({ seat, amount }) },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount; calls.gainResources.push({ seat, amount }) },
    loseResources: (seat, amount) => { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount) },
    drawCards: (seat, amount) => { calls.drawCards.push({ seat, amount }) },
    loseActions: (seat, amount = 99) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount) },
    endTurn: seat => { state.investigators[seat].turnEnded = true },
    addDoom: amount => { state.doom += amount },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    damageEnemy: (enemy, amount) => { enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    healEnemy: (enemy, amount) => { enemy.damageTaken = Math.max(0, (enemy.damageTaken || 0) - amount) },
    exhaustEnemy: enemy => { enemy.exhausted = true },
    readyEnemy: enemy => { enemy.exhausted = false },
    discardEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      calls.discardedEnemies.push(enemy.originalCode || enemy.code)
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      const index = (inv.assets || []).findIndex(asset => asset.id === assetId)
      if (index < 0) return null
      const [asset] = inv.assets.splice(index, 1)
      ;(inv.discard ||= []).push(asset.code)
      return asset
    },
    damageAsset: () => {},
    healAsset: () => {},
    giveAsset: (asset, seat) => {
      const from = state.investigators.find(inv => (inv.assets || []).some(item => item.id === asset.id))
      if (from) from.assets = from.assets.filter(item => item.id !== asset.id)
      const target = state.investigators[seat]
      if (!target) return false
      ;(target.assets ||= []).push(asset)
      calls.gaveAssets.push({ seat, code: asset.code || asset.originalCode })
      return true
    },
    swarm: {
      place: (host, count) => {
        host.swarmCards ||= []
        for (let index = 0; index < count; index++) host.swarmCards.push({ id: `${host.id}-swarm-${index}` })
        return host.swarmCards
      },
      countOf: host => swarmCountOf(host),
    },
    banish: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      state.victoryDisplay ||= []
      state.victoryDisplay.push({ id: `enemy:${enemy.id}`, code: enemy.originalCode || enemy.code, victory: enemy.victory || 0 })
      calls.banished.push(enemy.originalCode || enemy.code)
      return true
    },
    setEnemyAside: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      const snapshot = { id: `aside-${calls.setAside.length + 1}`, code: enemy.originalCode || enemy.code }
      calls.setAside.push(snapshot)
      return snapshot.id
    },
    restoreEnemyFromAside: (snapshotId, locationId) => {
      const snapshot = calls.setAside.find(item => item.id === snapshotId)
      if (!snapshot) return null
      const enemy = { id: `restored-${calls.restored.length + 1}`, originalCode: snapshot.code, code: snapshot.code, location: locationId, damageTaken: 0 }
      state.enemies.push(enemy)
      calls.restored.push({ code: snapshot.code, locationId })
      return enemy
    },
    attack: (enemy, inv) => { calls.attacks.push({ enemy: enemy.originalCode || enemy.code, seat: inv.seat }) },
    skipEnemyAttackThisRound: enemy => { calls.skipped.push(enemy.originalCode || enemy.code) },
    discoverClue: (seat, amount) => { state.investigators[seat].clues += amount },
    drawEncounter: () => {},
    finish: () => {},
    advanceAct: () => { calls.advanced = (calls.advanced || 0) + 1 },
    test: (seat, skill, difficulty, resolve) => {
      calls.tests.push({ seat, skill, difficulty })
      const success = outcomes.length ? outcomes.shift() : true
      resolve({ success, value: success ? difficulty + 1 : Math.max(0, difficulty - 1), difficulty, skill, drawn: [] })
    },
    flipLocation: id => {
      const location = state.locations.find(item => item.id === id)
      behavior.locationFlipped(state, location, api, state.currentSeat)
    },
    detachLocationAttachment: (locationId, attachmentId) => {
      const location = state.locations.find(item => item.id === locationId)
      if (!location?.attachments) return null
      const index = location.attachments.findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return location.attachments.splice(index, 1)[0]
    },
    attachEncounterToLocation: (code, locationId) => {
      const location = state.locations.find(item => item.id === locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `locatt-${location.id}-${location.attachments.length + 1}`, code }
      location.attachments.push(attachment)
      return attachment
    },
    discardFromHand: (seat, cardCode) => {
      const inv = state.investigators[seat]
      const index = (inv.hand || []).indexOf(cardCode)
      if (index < 0) return false
      inv.hand.splice(index, 1)
      ;(inv.discard ||= []).push(cardCode)
      calls.discardedHand.push({ seat, code: cardCode })
      return true
    },
    drawDiscard: (seat, index) => {
      const inv = state.investigators[seat]
      const [code] = inv.discard.splice(index, 1)
      inv.hand.push(code)
      calls.drewDiscard.push({ seat, code })
      return code
    },
    ...overrides.api,
  }
  return api
}

function findCard(predicate) {
  return Object.keys(ALL_CARDS).find(code => predicate(ALL_CARDS[code]))
}

// ===========================================================================
// 地点 / 翻转面 06133–06143b
// ===========================================================================

test('06133 伊莱克-瓦达：每轮第一张法术/仪式/遗物卡费用 -1（引擎 playCost 读点）', () => {
  const spell = findCard(card => (card.cost || 0) > 0
    && (card.traits || []).some(trait => ['spell', 'ritual', 'relic'].includes(String(trait).toLowerCase())))
  assert.ok(spell, '需要一张带法术/仪式/遗物特性且有费用的卡')
  const state = makeState()
  addLocation(state, 'ilekVad')
  const inv = state.investigators[0]
  inv.location = 'ilekVad'
  const base = Number(ALL_CARDS[spell].cost) || 0
  assert.equal(playCost(state, inv, ALL_CARDS[spell]), base - 1, '本轮第一张匹配卡 -1')
  const matchedTrait = (ALL_CARDS[spell].traits || [])
    .map(trait => String(trait).toLowerCase())
    .find(trait => ['spell', 'ritual', 'relic'].includes(trait))
  assert.ok(matchedTrait)
  inv.playedCardsHistory = { round: state.round, traits: [matchedTrait] }
  assert.equal(playCost(state, inv, ALL_CARDS[spell]), base, '本轮已经打过匹配卡后不再减费')
  // 不匹配的卡不享受折扣。
  const other = findCard(card => (card.cost || 0) > 0
    && !(card.traits || []).some(trait => ['spell', 'ritual', 'relic'].includes(String(trait).toLowerCase())))
  assert.ok(other)
  const state2 = makeState()
  addLocation(state2, 'ilekVad')
  state2.investigators[0].location = 'ilekVad'
  assert.equal(playCost(state2, state2.investigators[0], ALL_CARDS[other]), Number(ALL_CARDS[other].cost) || 0)
})

test('06133b 彩虹宫殿：位于伊莱克-瓦达的每位调查员治愈 2 恐惧并抽 2 张牌', () => {
  const state = makeState({ numInvestigators: 3 })
  const location = addLocation(state, 'ilekVad')
  state.investigators[0].location = 'ilekVad'
  state.investigators[1].location = 'ilekVad'
  state.investigators[2].location = 'ulthar'
  for (const inv of state.investigators) inv.horror = 3
  const api = makeApi(state)
  assert.equal(assetRuleFor('06133b').resolve(state, api, { location, inv: state.investigators[0] }), undefined)
  assert.deepEqual(api.calls.healHorror, [{ seat: 0, amount: 2 }, { seat: 1, amount: 2 }])
  assert.deepEqual(api.calls.drawCards, [{ seat: 0, amount: 2 }, { seat: 1, amount: 2 }])
  assert.equal(state.investigators[2].horror, 3, '不在该地点的调查员不受影响')
})

test('06134 禁闭之地：战斗(1)→敏捷(2)→意志(3) 全成功翻面读故事，任一失败受 1 伤害', () => {
  const state = makeState()
  const location = addLocation(state, 'forbiddenLands')
  const inv = state.investigators[0]
  inv.location = 'forbiddenLands'
  const rule = locationRuleFor('06134')
  const moves = []
  rule.actions({ moves, state, inv, location })
  assert.equal(moves.some(move => move.rule === 'forbiddenLandsRitual'), true)
  state.scenarioZones.setAside = ['06150']
  const api = makeApi(state, { outcomes: [true, true, true] })
  rule.performAction(state, inv, { rule: 'forbiddenLandsRitual' }, api)
  assert.deepEqual(api.calls.tests.map(entry => [entry.skill, entry.difficulty]),
    [['combat', 1], ['agility', 2], ['willpower', 3]])
  assert.equal(state.markerCounts.reference || 0, 1, '06134b：发现 1 个神迹')
  assert.equal(state.encounterDeck.filter(code => code === '06150').length, 1, '06134b：黑暗夜魇洗入遭遇牌库')
  assert.equal(state.scenarioFlags['storyRead:forbiddenLands'], true)
  // 已翻面后不再提供行动。
  const after = []
  rule.actions({ moves: after, state, inv, location })
  assert.equal(after.length, 0)
  // 失败分支：受到 1 点伤害、不翻面。
  const failed = makeState()
  const failedLocation = addLocation(failed, 'forbiddenLands')
  const failedInv = failed.investigators[0]
  failedInv.location = 'forbiddenLands'
  const failedApi = makeApi(failed, { outcomes: [false] })
  locationRuleFor('06134').performAction(failed, failedInv, { rule: 'forbiddenLandsRitual' }, failedApi)
  assert.equal(failedInv.damage, 1)
  assert.equal(failed.scenarioFlags['storyRead:forbiddenLands'], undefined)
  void failedLocation
})

test('06135 祖兰-提克：轮末按在此的调查员数给夜色怪群加蜂拥卡', () => {
  const state = makeState()
  const location = addLocation(state, 'zulanThek')
  const horde = { id: 'horde', code: '06147', originalCode: '06147', location: 'forbiddenLands', swarmCards: [] }
  state.enemies.push(horde)
  state.investigators[0].location = 'zulanThek'
  state.investigators[1].location = 'forbiddenLands'
  behavior.roundEnded(state, makeApi(state))
  assert.equal(swarmCountOf(horde), 1, '每个在此的调查员 +1 张蜂拥卡')
  state.investigators[1].location = 'zulanThek'
  behavior.roundEnded(state, makeApi(state))
  assert.equal(swarmCountOf(horde), 3, '轮末再 +2')
  void location
})

test('06135b 祖兰-提克的地穴：发现 1 神迹并把夜色怪群加入胜利牌区', () => {
  const state = makeState()
  state.scenarioZones.setAside = ['06150']
  const horde = { id: 'horde', code: '06147', originalCode: '06147', location: 'zulanThek', victory: 1, swarmCards: [] }
  state.enemies.push(horde)
  const api = makeApi(state)
  assetRuleFor('06135b').resolve(state, api, {})
  assert.equal(state.markerCounts.reference || 0, 1)
  assert.deepEqual(api.calls.banished, ['06147'], '夜色怪群被放逐到胜利展示区')
  assert.equal(state.enemies.includes(horde), false)
})

test('06136 巴哈那港：掩藏地点翻面读故事并记录「在巴哈那港口获取补给」', () => {
  const state = makeState()
  behavior.setupLocations(state, [], {})
  const location = addLocation(state, 'baharna', { clues: 0, veiled: true })
  const inv = state.investigators[0]
  inv.location = 'baharna'
  const flipped = flipVeiledLocation(state, 'baharna')
  assert.equal(flipped.changed, true)
  assert.equal(flipped.storyCode, '06136b')
  behavior.veiledFlipped(state, inv, 'baharna', flipped, makeApi(state))
  assert.equal(state.scenarioFlags['storyRead:baharna'], true)
  assert.equal(state.scenarioFlags.obtainedSuppliesFromBaharna, true)
  assert.equal(location.veiledRevealed, true)
})

test('06136b 巴哈那港的货物：弃牌堆的[[道具]]/[[供给]]返回手牌并记录补给', () => {
  const item = findCard(card => (card.traits || []).some(trait => ['item', 'supply'].includes(String(trait).toLowerCase())))
  assert.ok(item, '需要一张道具/供给卡')
  const state = makeState()
  addLocation(state, 'baharna')
  const inv = state.investigators[0]
  inv.location = 'baharna'
  inv.discard.push(item)
  inv.hand = []
  const api = makeApi(state, { choices: ['0'] })
  assetRuleFor('06136b').resolve(state, api, { location: state.locations[0] })
  assert.equal(inv.hand.includes(item), true, '道具/供给回到手牌')
  assert.equal(state.scenarioFlags.obtainedSuppliesFromBaharna, true)
  // 不返回时只记录补给。
  const skipState = makeState()
  addLocation(skipState, 'baharna')
  const skipInv = skipState.investigators[0]
  skipInv.location = 'baharna'
  skipInv.discard.push(item)
  const skipApi = makeApi(skipState, { choices: ['skip'] })
  assetRuleFor('06136b').resolve(skipState, skipApi, { location: skipState.locations[0] })
  assert.equal(skipInv.hand.includes(item), false)
  assert.equal(skipState.scenarioFlags.obtainedSuppliesFromBaharna, true)
})

test('06137b 远古诸神的面容：发现 1 神迹并洗入 1 张放在一边的黑暗夜魇', () => {
  const state = makeState()
  state.scenarioZones.setAside = ['06150', '06150']
  const api = makeApi(state)
  assetRuleFor('06137b').resolve(state, api, {})
  assert.equal(state.markerCounts.reference || 0, 1)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06150').length, 1)
  assert.equal(state.encounterDeck.filter(code => code === '06150').length, 1)
})

test('06138b 特尔菲亚的废墟：发现 1 个神迹', () => {
  const state = makeState()
  const api = makeApi(state)
  assetRuleFor('06138b').resolve(state, api, {})
  assert.equal(state.markerCounts.reference || 0, 1)
})

test('06139 塞勒菲斯：翻面读「王之良言」，记录向王祈求帮助并洗入黑暗夜魇', () => {
  const state = makeState()
  behavior.setupLocations(state, [], {})
  state.scenarioZones.setAside = ['06150']
  addLocation(state, 'celephais', { clues: 0, veiled: true })
  const inv = state.investigators[0]
  inv.location = 'celephais'
  const flipped = flipVeiledLocation(state, 'celephais')
  assert.equal(flipped.storyCode, '06139b')
  behavior.veiledFlipped(state, inv, 'celephais', flipped, makeApi(state))
  assert.equal(state.scenarioFlags.beseechedTheKing, true)
  assert.equal(state.encounterDeck.includes('06150'), true)
})

test('06139b 王之良言：记录「向王祈求帮助」并把黑暗夜魇洗入遭遇牌库', () => {
  const state = makeState()
  state.scenarioZones.setAside = ['06150']
  const api = makeApi(state)
  assetRuleFor('06139b').resolve(state, api, {})
  assert.equal(state.scenarioFlags.beseechedTheKing, true)
  assert.equal(state.encounterDeck.includes('06150'), true)
})

test('06140 塞拉尼安：进入/离开必须弃 1 张手牌作为额外费用，没有手牌则不能移动', () => {
  const state = makeState()
  addLocation(state, 'celephais')
  const serannian = addLocation(state, 'serannian')
  const inv = state.investigators[0]
  inv.location = 'celephais'
  inv.hand = ['01020', '01021']
  const api = makeApi(state)
  behavior.beforeMove(state, inv, serannian, api)
  assert.equal(api.calls.discardedHand.length, 1, '进入塞拉尼安弃 1 张手牌')
  assert.equal(inv.hand.length, 1)
  // 没有手牌时返回 false（不能支付额外费用）。
  const empty = makeState()
  addLocation(empty, 'celephais')
  const emptyTarget = addLocation(empty, 'serannian')
  const emptyInv = empty.investigators[0]
  emptyInv.location = 'celephais'
  emptyInv.hand = []
  assert.equal(behavior.beforeMove(empty, emptyInv, emptyTarget, makeApi(empty)), false)
})

test('06140b 永恒美景：位于塞拉尼安的每位调查员治愈 2 伤害、获得 2 资源并发现 1 神迹', () => {
  const state = makeState({ numInvestigators: 2 })
  const location = addLocation(state, 'serannian')
  for (const inv of state.investigators) { inv.location = 'serannian'; inv.damage = 2 }
  const api = makeApi(state)
  assetRuleFor('06140b').resolve(state, api, { location })
  assert.deepEqual(api.calls.healDamage, [{ seat: 0, amount: 2 }, { seat: 1, amount: 2 }])
  assert.deepEqual(api.calls.gainResources, [{ seat: 0, amount: 2 }, { seat: 1, amount: 2 }])
  assert.equal(state.markerCounts.reference || 0, 1)
})

test('06141 哈祖斯-克列格：翻面读「无以达愿」，把无以达愿之庙放入场', () => {
  const state = makeState()
  behavior.setupLocations(state, [], {})
  state.scenarioZones.setAside = ['06142']
  addLocation(state, 'hazuthKleg', { clues: 0, veiled: true })
  const inv = state.investigators[0]
  inv.location = 'hazuthKleg'
  const flipped = flipVeiledLocation(state, 'hazuthKleg')
  assert.equal(flipped.storyCode, '06141b')
  behavior.veiledFlipped(state, inv, 'hazuthKleg', flipped, makeApi(state))
  assert.equal(state.locations.some(location => location.id === 'templeOfUnattainableDesires'), true)
  assert.equal(state.scenarioZones.setAside.includes('06142'), false)
})

test('06141b 无以达愿：把放在一边的无以达愿之庙放置入场', () => {
  const state = makeState()
  state.scenarioZones.setAside = ['06142']
  const api = makeApi(state)
  assetRuleFor('06141b').resolve(state, api, {})
  assert.equal(state.locations.some(location => location.id === 'templeOfUnattainableDesires'), true)
  assert.equal(state.scenarioZones.setAside.includes('06142'), false)
})

test('06142b 城中之城：把放在一边的地图未见之城放置入场', () => {
  const state = makeState()
  state.scenarioZones.setAside = ['06143']
  const api = makeApi(state)
  assetRuleFor('06142b').resolve(state, api, {})
  assert.equal(state.locations.some(location => location.id === 'cityWhichAppearsOnNoMap'), true)
  assert.equal(state.scenarioZones.setAside.includes('06143'), false)
})

test('06143 地图未见之城：隐藏值随千面祭司 -1；调查失败后检索生成千面祭司并洗回', () => {
  const state = makeState()
  const location = addLocation(state, 'cityWhichAppearsOnNoMap')
  const inv = state.investigators[0]
  inv.location = 'cityWhichAppearsOnNoMap'
  state.enemies.push({ id: 'priest-1', code: '06149', originalCode: '06149', location: 'cityWhichAppearsOnNoMap', swarmCards: [] })
  assert.equal(behavior.locationShroudModifier(state, location, inv), -1)
  state.enemies = state.enemies.filter(enemy => enemy.id !== 'priest-1')
  assert.equal(behavior.locationShroudModifier(state, location, inv), 0)
  // 调查失败：从遭遇牌库取出一张千面祭司并生成在此。
  state.encounterDeck.push('06149')
  const api = makeApi(state)
  locationRuleFor('06143').afterTest(state, location, inv, { success: false, source: { label: '调查', code: '06143' } }, api)
  assert.deepEqual(api.calls.spawns, [{ code: '06149', locationId: 'cityWhichAppearsOnNoMap' }])
  // 成功调查不触发。
  const successState = makeState()
  addLocation(successState, 'cityWhichAppearsOnNoMap')
  successState.encounterDeck.push('06149')
  const successApi = makeApi(successState)
  locationRuleFor('06143').afterTest(successState, successState.locations[0], successState.investigators[0],
    { success: true, source: { label: '调查', code: '06143' } }, successApi)
  assert.equal(successApi.calls.spawns.length, 0)
})

test('06143b 凶星：发现 2 神迹、弃掉本地敌人、把调查员移到神庙并把地点加入胜利区', () => {
  const state = makeState({ numInvestigators: 2 })
  behavior.setupLocations(state, [], {})
  state.scenarioZones.setAside = ['06142']
  addLocation(state, 'cityWhichAppearsOnNoMap', { clues: 0, veiled: true })
  addLocation(state, 'templeOfUnattainableDesires')
  const invs = state.investigators
  for (const inv of invs) inv.location = 'cityWhichAppearsOnNoMap'
  state.enemies.push({ id: 'e1', code: '06149', originalCode: '06149', location: 'cityWhichAppearsOnNoMap', swarmCards: [] })
  const flipped = flipVeiledLocation(state, 'cityWhichAppearsOnNoMap')
  assert.equal(flipped.storyCode, '06143b')
  const api = makeApi(state)
  behavior.veiledFlipped(state, invs[0], 'cityWhichAppearsOnNoMap', flipped, api)
  assert.equal(state.markerCounts.reference || 0, 2, '发现两个神迹')
  assert.equal(state.enemies.some(enemy => enemy.location === 'cityWhichAppearsOnNoMap'), false)
  assert.equal(invs.every(inv => inv.location === 'templeOfUnattainableDesires'), true)
  const victory = state.victoryDisplay.find(card => (card.code || card.originalCode) === '06143')
  assert.ok(victory, '地图未见之城加入胜利牌区')
  assert.equal(victory.victory, 2)
})

// ===========================================================================
// 剧情资产 / 敌人 06144–06152
// ===========================================================================

test('06144 维吉尔·格雷：发现神迹后反应（抽牌/资源/治愈）并在多人局转移控制权；离场移出游戏', () => {
  const state = makeState({ numInvestigators: 2 })
  behavior.setupLocations(state, [], {})
  const virgil = { id: 'virgil', code: '06144', originalCode: '06144', horror: 0 }
  state.investigators[0].assets.push(virgil)
  // 通过 06138b 故事结算获得 1 神迹，触发维吉尔反应（选抽牌）。
  const location = addLocation(state, 'namelessRuins', { clues: 0, veiled: true })
  state.investigators[0].location = 'namelessRuins'
  const api = makeApi(state, { choices: ['draw'] })
  const flipped = flipVeiledLocation(state, 'namelessRuins')
  behavior.veiledFlipped(state, state.investigators[0], 'namelessRuins', flipped, api)
  assert.equal(api.calls.drawCards.some(entry => entry.seat === 0 && entry.amount === 1), true)
  assert.equal(api.calls.gaveAssets.length, 1, '多人局把控制权交给另一位调查员')
  assert.equal(state.investigators[1].assets.some(asset => asset.id === 'virgil'), true)
  // 离场 → 移出游戏。
  behavior.assetLeftPlay(state, state.investigators[1], virgil, api)
  assert.equal(state.removedFromGame.includes('06144'), true)
  void location
})

test('06146 跟踪的蝎狮：成功躲避后解除交战但不横置，本阶段不能再与其交战', () => {
  const state = makeState()
  const enemy = { id: 'manticore', code: '06146', originalCode: '06146', location: 'ulthar', exhausted: true, engagedSeat: 0, swarmCards: [] }
  state.enemies.push(enemy)
  const inv = state.investigators[0]
  const api = makeApi(state)
  behavior.afterEvade(state, inv, enemy, { success: true }, api)
  assert.equal(enemy.exhausted, false, '不要横置它')
  assert.equal(behavior.canEngageEnemy(state, inv, enemy), false, '本阶段不能与该调查员交战')
  state.phase = 'enemy'
  assert.equal(behavior.canEngageEnemy(state, inv, enemy), undefined, '阶段结束后恢复')
})

test('06148 伊伯生物：敌人攻击步骤改为攻击其地点的每位调查员并跳过正常攻击', () => {
  const state = makeState({ numInvestigators: 2 })
  const ib = { id: 'ib', code: '06148', originalCode: '06148', location: 'ruinsOfIb', engagedSeat: 0, swarmCards: [] }
  state.enemies.push(ib)
  for (const inv of state.investigators) inv.location = 'ruinsOfIb'
  const api = makeApi(state)
  behavior.enemyPhaseAfterHunters(state, api)
  assert.deepEqual(api.calls.attacks, [{ enemy: '06148', seat: 0 }, { enemy: '06148', seat: 1 }])
  assert.deepEqual(api.calls.skipped, ['06148'])
})

test('06149 千面祭司：2/4/6 个神迹分别 +1 攻/躲、+2 生命、+1 伤害', () => {
  const state = makeState()
  const priest = { id: 'priest', code: '06149', originalCode: '06149', location: 'ulthar', swarmCards: [] }
  assert.equal(behavior.enemyStatModifier(state, priest, 'fight'), 0)
  state.markerCounts.reference = 2
  assert.equal(behavior.enemyStatModifier(state, priest, 'fight'), 1)
  assert.equal(behavior.enemyStatModifier(state, priest, 'evade'), 1)
  state.markerCounts.reference = 4
  assert.equal(behavior.enemyStatModifier(state, priest, 'health'), 2)
  state.markerCounts.reference = 6
  assert.deepEqual(behavior.enemyAttackModifier(state, priest, state.investigators[0]), { damage: 1 })
})

test('06150 黑暗夜魇：区域设置时放在一边（保留标记），设置后回到一个[[城市]]地点', () => {
  const state = makeState()
  behavior.setupLocations(state, [], {})
  const nightgaunt = { id: 'nightgaunt-1', code: '06150', originalCode: '06150', location: 'ulthar', damageTaken: 2, doom: 1 }
  state.enemies.push(nightgaunt)
  state.investigators[0].location = 'ulthar'
  state.actIndex = 1
  // 06123「去哪里？」：选北方的禁闭之地；随后黑暗夜魇放回 ilekVad（城市）。
  const api = makeApi(state, { choices: ['forbiddenLands', 'ilekVad'] })
  behavior.actReveal(state, state.acts[state.actIndex], api)
  assert.equal(api.calls.setAside.some(item => item.code === '06150'), true, '区域设置时放在一边')
  assert.equal(api.calls.restored.length, 1, '设置后放回场上')
  const restored = state.enemies.find(enemy => enemy.id.startsWith('restored-')) || null
  assert.ok(restored, '黑暗夜魇回到场上')
  assert.equal(restored.location, 'ilekVad', '放回一个[[城市]]地点')
})

test('06151 一群乌尼斯：头领没有附属蜂拥卡时攻击值+2、躲避值+2', () => {
  const state = makeState()
  const voonith = { id: 'voonith', code: '06151', originalCode: '06151', location: 'skaiRiver', swarmCards: [] }
  assert.equal(behavior.enemyStatModifier(state, voonith, 'fight'), 2)
  assert.equal(behavior.enemyStatModifier(state, voonith, 'evade'), 2)
  voonith.swarmCards.push({ id: 'swarm-1', code: '06151' })
  assert.equal(behavior.enemyStatModifier(state, voonith, 'fight'), 0)
  assert.equal(behavior.enemyStatModifier(state, voonith, 'evade'), 0)
})

test('06152 夜骑：头领无蜂拥卡时躲避值-3；成功躲避后弃掉', () => {
  const state = makeState()
  const nightrider = { id: 'nightrider', code: '06152', originalCode: '06152', location: 'mtNgranek', swarmCards: [] }
  state.enemies.push(nightrider)
  assert.equal(behavior.enemyStatModifier(state, nightrider, 'evade'), -3)
  nightrider.swarmCards.push({ id: 'swarm-1', code: '06152' })
  assert.equal(behavior.enemyStatModifier(state, nightrider, 'evade'), 0)
  const api = makeApi(state)
  behavior.afterEvade(state, state.investigators[0], nightrider, { success: true }, api)
  assert.deepEqual(api.calls.discardedEnemies, ['06152'], '躲避夜骑后弃掉它')
})
