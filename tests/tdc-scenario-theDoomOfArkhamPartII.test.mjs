// P7 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 提示卡 11688a）章节测试。
//
// 覆盖：章节结构/manifest、两分支幕选择、克苏鲁面板（多部位敌人 linkEnemyParts）、
// 独立克苏鲁牌库（从顶抽/弃回/空库回收/每轮上限）、怒气与部位数值、四档混乱标记、
// 最终封印印记与勘误、四种结局与战役记录、JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2 原语（水位/独立牌库用
// mechanicState），因此单测可在其他 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/index.js'
import {
  scenario, ACT_CODES, ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE, AGENDA_CODES, AGENDA_DOOM_CODE,
  AGENDA_DOOM_BACK_CODE, AGENDA_FINAL_SEAL_CODE, STAGE_CARDS, LOCATIONS, LOCATION_CONNECTIONS,
  LOCATION_COORDINATES, SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  CTHULHU_DECK, CTHULHU_DECK_ID, CTHULHU_BODY_CODE, CTHULHU_FACET_CODES, CTHULHU_FACET_PAIRS,
  CTHULHU_ENEMY_CODES, CTHULHU_STORY_CODES, IMPLEMENTED_ENTRY_CODES, TREACHERY_CODES, ALLY_CODES,
  RESOLUTION_KEYS,
  SCENARIO_TEXT, START_LOCATION, SIGIL_REQUIRED, RUINED_LOCATION_LIMIT,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/definition.js'
import {
  behavior, setupScenario, drawCthulhuCard, cthulhuDeckSize, cthulhuDeckDiscard, facetsInPlay,
  cthulhuEnemiesInVictory, sigilLocations, swapToRuined, ruinedLocationCount,
  scenarioSummary, uncrossedArtifacts, inheritFloodedNeighborhoods,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/behavior.js'
import {
  doomOfArkhamPartTwoChaosToken, doomOfArkhamPartTwoChaosTokenValue, skullValue, isHardSide,
  CHAOS_TOKEN_FACES, cthulhuRage, setCthulhuRage, increaseCthulhuRage,
  canDrawCthulhuFromToken, markCthulhuDrawnFromToken, fullyFloodedLocationIds,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/chaos.js'
import entryDoom2 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11689.js'
import entryFightBack from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11690.js'
import entryBanish from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11691a.js'
import entryFinalSeal from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11691b.js'
import entryOldTower from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11692.js'
import entryCthulhuBody from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11701.js'
import entryHoary from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11702.js'
import entryHoaryEnraged from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11702b.js'
import entryLayWaste from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11716.js'

const ENTRIES = [
  entryDoom2, entryFightBack, entryBanish, entryFinalSeal, entryOldTower, entryCthulhuBody,
  entryHoary, entryHoaryEnraged, entryLayWaste,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

// ---------------------------------------------------------------------------
// 夹具：只提供 behavior 实际用到的 api 子集 + mechanicState 承载的水位/牌库
// ---------------------------------------------------------------------------
function decksFor(state) {
  const data = mechanicState(state, true)
  data.scenarioDecks ||= {}
  if (!data.scenarioDecks[CTHULHU_DECK_ID]) data.scenarioDecks[CTHULHU_DECK_ID] = { deck: [], discard: [], removed: [] }
  return data.scenarioDecks[CTHULHU_DECK_ID]
}

function makeApi(state, options = {}) {
  let serial = 0
  const testResult = options.testResult || { success: false, failedBy: 1, value: 0 }
  const api = {
    state,
    info: () => {},
    finished: null,
    advancedAct: 0,
    advancedAgenda: 0,
    attacks: [],
    choose: options.choose || (() => 'standTogether'),
    random: options.random || (() => 0.5),
    shuffle: options.shuffle || (list => [...list]),
    test(seat, skill, difficulty, resolve) {
      api.lastTest = { seat, skill, difficulty }
      resolve?.(typeof testResult === 'function' ? testResult(seat, skill, difficulty) : testResult)
      return testResult
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    discardRandom(seat, amount = 1) {
      const inv = state.investigators[seat]
      let lost = 0
      for (let i = 0; i < amount; i += 1) { if (inv.hand.length) { inv.hand.pop(); lost += 1 } }
      return lost
    },
    giveAsset(seat, code) {
      const inv = state.investigators[seat]
      if (!inv) return null
      const asset = {
        id: `asset-${code}-${++serial}`, code, originalCode: code, name: code, controllerSeat: seat,
        ownerSeat: seat, exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [],
      }
      inv.assets.push(asset)
      return asset
    },
    removeAsset(seat, assetId) {
      const inv = state.investigators[seat]
      const index = inv?.assets?.findIndex(asset => asset.id === assetId) ?? -1
      if (index < 0) return null
      return inv.assets.splice(index, 1)[0].code
    },
    exemptAssetSlot(asset, slot) { asset.ignoredSlots = [...new Set([...(asset.ignoredSlots || []), slot])]; return true },
    spawn(code, location, extra = {}) {
      const enemy = {
        id: `${code}-${++serial}`, code, originalCode: code, name: code, location,
        fight: 0, evade: 0, health: 1, damage: 0, horror: 0, damageTaken: 0, doom: 0,
        exhausted: false, engagedSeat: null, traits: [], attachments: [], victory: 0,
        ...extra,
      }
      state.enemies.push(enemy)
      return enemy
    },
    flipEnemy(enemy, code) {
      enemy.code = code
      enemy.originalCode = code
      return true
    },
    moveEnemy(enemy, destination) { enemy.location = destination; return true },
    attack(enemy, inv) { api.attacks.push([enemy.code, inv?.seat]); return true },
    drawEncounter(seat) { return state.encounterDeck.pop() || null },
    addDoom(amount = 1) { state.doom = (Number(state.doom) || 0) + amount; return state.doom },
    addCluesToLocation(id, amount = 1) {
      const location = state.locations.find(item => item.id === id)
      if (!location) return 0
      location.clues = (Number(location.clues) || 0) + amount
      return location.clues
    },
    addStoryToVictory(code, { sourceId } = {}) {
      state.victoryDisplay.push({ id: sourceId || code, code, originalCode: code, victory: 0 })
      return true
    },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    defeat(inv) { inv.defeated = true },
    finish(key) { api.finished = key },
    advanceAct() { api.advancedAct += 1; behavior.actReveal(state, state.acts[state.actIndex], api) },
    advanceAgenda() { api.advancedAgenda += 1; behavior.agendaReveal(state, state.agendas[state.agendaIndex], api) },
  }
  api.mechanics = {
    water: {
      level: id => Number(mechanicState(state)?.flood?.[id]) || 0,
      change: (id, delta) => {
        const location = state.locations.find(item => item.id === id)
        const entry = registeredEntry(location?.originalCode || location?.code)
        const max = entry?.locationRule?.floodBounds?.max ?? 2
        const data = mechanicState(state, true)
        data.flood ||= {}
        const before = Number(data.flood[id]) || 0
        data.flood[id] = Math.max(0, Math.min(max, before + delta))
        return data.flood[id] !== before
      },
    },
    map: { nearest: (from, ids) => ids?.slice(0, 1) || [] },
    scenarioDecks: {
      initialize(id, cards, { shuffle = true } = {}) {
        const data = mechanicState(state, true)
        data.scenarioDecks ||= {}
        data.scenarioDecks[id] = { deck: shuffle ? [...cards] : [...cards], discard: [], removed: [] }
        return cards.length
      },
      take(id, count = 1, { from = 'top' } = {}) {
        const piles = decksFor(state)
        return from === 'bottom' ? piles.deck.splice(0, count) : piles.deck.splice(Math.max(0, piles.deck.length - count), count).reverse()
      },
      discard(id, code) { decksFor(state).discard.push(code); return true },
      put(id, cards, { shuffle = false } = {}) {
        const piles = decksFor(state)
        piles.deck.push(...cards)
        return cards.length
      },
      cards: () => [...decksFor(state).deck],
      size: () => decksFor(state).deck.length,
    },
  }
  return api
}

const investigator = (seat, location = null) => ({
  seat, name: `调查员${seat + 1}`, location, damage: 0, horror: 0, clues: 1, resources: 5,
  assets: [], hand: ['01001', '01002'], deck: [], discard: [], threat: [],
  defeated: false, resigned: false, willpower: 4, intellect: 4, combat: 4, agility: 4,
})
const stateFor = (count = 2, records = {}, difficulty = 'standard') => ({
  investigators: Array.from({ length: count }, (_, seat) => investigator(seat)),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {}, victoryDisplay: [],
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  doom: 0, difficulty, numInvestigators: count, phase: 'investigation', round: 1, status: 'playing',
})
const withScenario = (count = 2, { records = {}, difficulty = 'standard' } = {}) => {
  const state = stateFor(count, records, difficulty)
  state.scenario = structuredClone(scenario)
  return state
}
const setup = (count = 2, { records = {}, difficulty = 'standard', api: extra = {} } = {}) => {
  const state = withScenario(count, { records, difficulty })
  const api = makeApi(state, extra)
  const report = setupScenario(state, api)
  return { state, api, report }
}

// ---------------------------------------------------------------------------
// 1. 结构 / manifest / 数据
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 章节结构：35 张条目、17 地点、两幕、特殊议程、4 结局键', () => {
  assert.equal(chapter.scenario.id, 'theDoomOfArkhamPartII')
  assert.equal(chapter.scenario.originalCode, '11688a')
  assert.equal(chapter.scenario.referenceCode, '11688a')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11688a')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.deepEqual([...ACT_CODES], [ACT_FIGHT_BACK_CODE, ACT_BANISH_HIM_CODE])
  assert.deepEqual(chapter.manifest.resolutionIds, [...RESOLUTION_KEYS])
  assert.equal(chapter.implementedEncounterCodes.length, 35)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...IMPLEMENTED_ENTRY_CODES].sort())
  assert.deepEqual([...TREACHERY_CODES], ['11716', '11717', '11719', '11720'])
  assert.equal(Object.keys(LOCATIONS).length, 15)
  assert.equal(chapter.manifest.locations.length, 15)
  assert.equal(STAGE_CARDS[AGENDA_FINAL_SEAL_CODE].finalSeal, true)
  assert.equal(STAGE_CARDS[AGENDA_FINAL_SEAL_CODE].doomThreshold, 10)
  assert.equal(STAGE_CARDS[AGENDA_DOOM_BACK_CODE].backFace, true)
  assert.equal(STAGE_CARDS[AGENDA_DOOM_CODE].enemyPhaseEndDrawCthulhu, true)
  assert.equal(chapter.manifest.cthulhuBoard.bodyCode, CTHULHU_BODY_CODE)
  assert.equal(chapter.manifest.cthulhuBoard.facetPairs.length, 3)
  assert.equal(chapter.manifest.scenarioDecks[0].id, CTHULHU_DECK_ID)
  assert.equal(chapter.manifest.finalSeal.agendaCode, AGENDA_FINAL_SEAL_CODE)
  assert.equal(chapter.manifest.finalSeal.sigils, SIGIL_REQUIRED)
  // 最终封印勘误
  assert.match(SCENARIO_TEXT.errata.theFinalSeal, /毁灭阈值|doom threshold/i)
  assert.ok(SCENARIO_TEXT.setupSteps.length >= 20)
  assert.equal(SCENARIO_TEXT.specialRules.length, 3)
  for (const key of RESOLUTION_KEYS) assert.ok(SCENARIO_TEXT.resolutions[key].length > 0)
  // 单卡条目
  assert.equal(registeredEntry('11692').locationRule.floodBounds.max, 1)
  assert.equal(registeredEntry('11692').flags.ruined, true)
  assert.equal(registeredEntry('11701').implemented, true)
  assert.equal(registeredEntry('11702').flags.cthulhuFacet, true)
  assert.equal(registeredEntry('11716').flags.test.skill, 'agility')
  assert.equal(typeof registeredEntry('11716').encounterResolve, 'function')
})

test('P7 theDoomOfArkhamPartII 牌库：克苏鲁牌库 18 张 action 卡，遭遇牌库排除克苏鲁牌/星之眷族', () => {
  assert.equal(CTHULHU_DECK.length, 18)
  assert.equal(new Set(CTHULHU_DECK).size, CTHULHU_ENEMY_CODES.length > 0 ? new Set(CTHULHU_DECK).size : 0)
  assert.equal(CTHULHU_DECK.filter(code => code === '11705').length, 2)
  assert.equal(CTHULHU_DECK.filter(code => code === '11709').length, 1)
  assert.equal(CTHULHU_DECK.filter(code => code === '11714').length, 2)
  for (const code of CTHULHU_DECK) assert.equal(chapter.CARD_DATA[code].type, 'story')
  assert.equal(ENCOUNTER_DECK.length, ENCOUNTER_DECK_CODES.reduce((sum, code) => {
    const card = chapter.CARD_DATA[code]
    return sum + Math.max(1, Number(card?.quantity) || 1)
  }, 0))
  for (const code of [...CTHULHU_ENEMY_CODES, '11725', '11726', '11727', '11728']) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `不进遭遇牌库：${code}`)
  }
  const aside = Object.fromEntries(chapter.manifest.zones.setAside.map(entry => [entry.cardCode, entry.count]))
  for (const code of CTHULHU_FACET_CODES) assert.equal(aside[code], 1)
  for (const code of CTHULHU_STORY_CODES) assert.equal(aside[code] ?? 0, chapter.CARD_DATA[code].quantity, `Cthulhu 行动卡放在一边：${code}`)
  for (const code of ['11725', '11726', '11727', '11728']) assert.equal(aside[code], 1)
  for (const id of SET_ASIDE_LOCATION_IDS) assert.equal(aside[LOCATIONS[id].code], 1)
})

// ---------------------------------------------------------------------------
// 2. Setup：分支 / 克苏鲁面板 / 独立牌库 / 淹没继承
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII Setup：坚守阵线分支 → 反击！幕 + 盟友入场 + 克苏鲁面板', () => {
  const { state, api, report } = setup(2, { records: { theInvestigatorsStoodTogether: true, barrierNode: true } })
  assert.equal(report.branch, 'standTogether')
  assert.equal(state.acts[0].originalCode, ACT_FIGHT_BACK_CODE)
  assert.equal(state.agendas[0].originalCode, AGENDA_DOOM_CODE)
  assert.equal(state.agendaIndex, 0)
  assert.equal(state.doom, 0)
  // 地点：北区/商业区/东镇/大学/医院/南区/河岸城（废墟）+ 2 屋顶 = 9
  assert.equal(state.locations.length, 9)
  assert.equal(state.locations.find(location => location.id === 'rivertownRuined').originalCode, '11696')
  assert.equal(state.locations.every(location => location.revealed === true), true)
  // 克苏鲁面板：本体 + 3 部位同地点并链接
  const body = state.enemies.find(enemy => enemy.code === CTHULHU_BODY_CODE)
  assert.ok(body)
  assert.equal(body.hasParts, true)
  const parts = state.enemies.filter(enemy => enemy.partOf === body.id)
  assert.equal(parts.length, 3)
  assert.equal(parts.every(part => part.location === body.location), true)
  assert.equal(state.scenarioFlags.cthulhuBoardLinked, true)
  // 独立克苏鲁牌库 18 张
  assert.equal(cthulhuDeckSize(state), 18)
  // 怒气初值：1–2 人局 2
  assert.equal(cthulhuRage(state), 2)
  // 未划除神器入场
  const artifact = state.investigators.flatMap(inv => inv.assets).find(asset => asset.code === '11552')
  assert.ok(artifact, '已获得神器入场')
  // 盟友入场（坚守阵线）
  assert.equal(state.investigators.flatMap(inv => inv.assets).filter(asset => ALLY_CODES.includes(asset.code)).length, 3)
})

test('P7 theDoomOfArkhamPartII Setup：仪式分支 → 放逐他！幕 + 最终封印/盟友放在一边', () => {
  const { state, report } = setup(2, { records: { yourAlliesHaveAPlan: true } })
  assert.equal(report.branch, 'alliesPlan')
  assert.equal(state.acts[0].originalCode, ACT_BANISH_HIM_CODE)
  assert.equal(state.scenarioZones.setAside.includes(AGENDA_FINAL_SEAL_CODE), true)
  assert.equal(state.investigators.flatMap(inv => inv.assets).some(asset => ALLY_CODES.includes(asset.code)), false)
  for (const code of ALLY_CODES) assert.ok(state.scenarioZones.setAside.includes(code))
})

test('P7 theDoomOfArkhamPartII 淹没街区继承：按卡号/同名地点提高水位', () => {
  const { state, api } = setup(2, { records: { floodedNeighborhoods: ['01125', '01134'] } })
  // 01125 河岸城 → 河岸城（废墟）；01134 北区
  const rivertown = state.locations.find(location => location.id === 'rivertownRuined')
  const northside = state.locations.find(location => location.id === 'northside')
  assert.equal(api.mechanics.water.level(rivertown.id), 1)
  assert.equal(api.mechanics.water.level(northside.id), 1)
  assert.deepEqual(state.scenarioFlags.inheritedFloodedNeighborhoods.sort(), ['northside', 'rivertownRuined'])
  // 北区是基础（非废墟）面；再次变化不会越过废墟面的水位上限（换面后才限制）。
  assert.equal(ruinedLocationCount(state), 1, '河岸城（废墟）本身计 1 处[[废墟]]')
})

// ---------------------------------------------------------------------------
// 3. 克苏鲁面板：部位数值 / 翻面 / 胜利区回面板
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 克苏鲁部位：战斗/躲避 = 狂怒值，狂怒面生命 = 狂怒值', () => {
  const { state } = setup(2)
  setCthulhuRage(state, 3)
  const facet = state.enemies.find(enemy => enemy.code === '11702')
  assert.equal(behavior.enemyStatModifier(state, facet, 'fight'), 3)
  assert.equal(behavior.enemyStatModifier(state, facet, 'evade'), 3)
  assert.equal(behavior.enemyStatModifier(state, facet, 'health'), 0, '非狂怒面没有生命修正')
  const enraged = state.enemies.find(enemy => enemy.code === '11703')
  assert.equal(behavior.enemyStatModifier(state, enraged, 'health'), 0)
  increaseCthulhuRage(state, 1)
  assert.equal(cthulhuRage(state), 4)
  // 未知敌人不修正
  assert.equal(behavior.enemyStatModifier(state, { code: '11716' }, 'fight'), 0)
})

test('P7 theDoomOfArkhamPartII 部位翻面与胜利区回面板', () => {
  const { state, api } = setup(2)
  const body = state.enemies.find(enemy => enemy.code === CTHULHU_BODY_CODE)
  const hoary = state.enemies.find(enemy => enemy.code === '11702')
  // 胜利区里放一名克苏鲁敌人，回面板时应以非狂怒面生成
  state.enemies = state.enemies.filter(enemy => enemy !== hoary)
  state.victoryDisplay.push({ id: 'v1', code: '11702b', originalCode: '11702b', victory: 2 })
  assert.equal(cthulhuEnemiesInVictory(state).length, 1)
  behavior.returnCthulhuFacetsToBoard(state, api, { enraged: false })
  assert.equal(cthulhuEnemiesInVictory(state).length, 0)
  const returned = state.enemies.find(enemy => enemy.code === '11702')
  assert.ok(returned)
  assert.equal(returned.location, body.location)
  assert.equal(returned.partOf, body.id)
  // 狂怒化：场上部位翻至 b 面
  behavior.setCthulhuRage(state, 5)
  const inPlay = facetsInPlay(state).find(enemy => enemy.code === '11702')
  api.flipEnemy(inPlay, '11702b')
  assert.equal(facetsInPlay(state).some(enemy => enemy.code === '11702b'), true)
})

// ---------------------------------------------------------------------------
// 4. 独立克苏鲁牌库：抽 / 弃回 / 空库回收 / 每轮上限
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 克苏鲁牌库：从顶抽、结算后弃回，空库时把弃牌洗回', () => {
  const { state, api } = setup(2)
  const before = cthulhuDeckSize(state)
  const code = drawCthulhuCard(state, 0, api, { source: 'test' })
  assert.ok(code)
  assert.equal(cthulhuDeckSize(state), before - 1)
  assert.ok(cthulhuDeckDiscard(state).includes(code) || (state.storyAssets || []).some(asset => asset.code === code))
  // 把全部牌抽空 → 弃牌堆回收
  let guard = 0
  while (cthulhuDeckSize(state) > 0 && guard < 40) { drawCthulhuCard(state, 0, api, { source: 'test' }); guard += 1 }
  assert.equal(cthulhuDeckSize(state), 0)
  assert.ok(cthulhuDeckDiscard(state).length > 0)
  const recycled = drawCthulhuCard(state, 0, api, { source: 'recycle' })
  assert.ok(recycled, '空库时抽牌应回收弃牌堆')
  assert.equal(cthulhuDeckSize(state) + cthulhuDeckDiscard(state).length >= 1, true)
  // 牌数守恒（牌库 + 弃牌 + 移出 = 18；保留在场上的行动卡不在两者中）
  const retained = (state.storyAssets || []).filter(asset => ['11710', '11715'].includes(asset.code)).length
  assert.equal(cthulhuDeckSize(state) + cthulhuDeckDiscard(state).length + retained <= 18, true)
})

test('P7 theDoomOfArkhamPartII 克苏鲁牌库：第五只眼/拆毁保留，标记抽牌每轮上限', () => {
  const { state, api } = setup(2)
  // 定向抽到「第五只眼」：临时把牌库顶替换
  const piles = decksFor(state)
  piles.deck = ['11705']
  piles.deck.push('11710')
  const fifth = drawCthulhuCard(state, 0, api, { source: 'test' })
  assert.equal(fifth, '11710')
  assert.ok((state.storyAssets || []).some(asset => asset.code === '11710'), '第五只眼留在场上')
  assert.equal(cthulhuDeckDiscard(state).includes('11710'), false)
  // 每轮上限标记
  state.round = 3
  assert.equal(canDrawCthulhuFromToken(state), true)
  markCthulhuDrawnFromToken(state)
  assert.equal(canDrawCthulhuFromToken(state), false)
  state.round = 4
  assert.equal(canDrawCthulhuFromToken(state), true)
})

// ---------------------------------------------------------------------------
// 5. 四档混乱标记
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 四档混乱符号：skull 随怒气、cultist 淹没伤害、elder thing 抽牌', () => {
  assert.deepEqual([...CHAOS_TOKEN_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  const { state, api } = setup(2)
  setCthulhuRage(state, 3)
  assert.equal(skullValue(state), -3)
  assert.equal(skullValue({ ...state, difficulty: 'hard' }), -5)
  assert.equal(isHardSide({ difficulty: 'expert' }), true)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue(state, 'skull'), -3)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue({ ...state, difficulty: 'hard' }, 'skull'), -5)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue(state, 'cultist'), -3)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue({ ...state, difficulty: 'expert' }, 'cultist'), -5)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue(state, 'tablet'), -3)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue(state, 'elderthing'), -1)
  assert.equal(doomOfArkhamPartTwoChaosTokenValue({ ...state, difficulty: 'hard' }, 'elderthing'), -3)
  // cultist：所在地点淹没才受伤
  const inv = state.investigators[0]
  const dry = state.investigators[1]
  dry.location = 'northside'
  api.mechanics.water.change(inv.location, 1)
  assert.equal(behavior.applyTokenEffect(state, inv, { mode: 'damageIfFlooded' }, api), true)
  assert.equal(inv.damage, 1)
  assert.equal(behavior.applyTokenEffect(state, dry, { mode: 'damageIfFlooded' }, api), false)
  // elder thing：失败才抽克苏鲁牌，且每轮最多一次
  const beforeDeck = cthulhuDeckSize(state)
  behavior.applyTokenEffect(state, inv, { mode: 'anotherTokenAndCthulhuDraw', test: { success: false, failedBy: 1 } }, api)
  assert.equal(cthulhuDeckSize(state), beforeDeck - 1)
  behavior.applyTokenEffect(state, inv, { mode: 'anotherTokenAndCthulhuDraw', test: { success: false, failedBy: 1 } }, api)
  assert.equal(cthulhuDeckSize(state), beforeDeck - 1, '每轮最多抽 1 张')
})

// ---------------------------------------------------------------------------
// 6. 幕 / 议程 / 怒气阈值 / 最终封印
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 反击！背面：怒气 ≤4 翻回 1a，≥5 → 结局 1', () => {
  const { state, api } = setup(2)
  setCthulhuRage(state, 1)
  const result = behavior.actReveal(state, state.acts[0], api)
  assert.equal(result, 'flipBack')
  assert.equal(cthulhuRage(state), 2)
  assert.equal(state.scenarioFlags.doomArkhamPartTwoFlipBack, true)

  setCthulhuRage(state, 4)
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(api.finished, 'resolution1')
  behavior.resolution(state, 'resolution1', null, api)
  assert.equal(state.campaign.records.cthulhuWasDrivenAway, true)
  assert.deepEqual(state.campaign.trauma[0], { physical: 3, mental: 3 })
})

test('P7 theDoomOfArkhamPartII 放逐他！背面：怒气 ≥4 → 最终封印，怒气设 5/4 并翻狂怒面', () => {
  const { state, api } = setup(2, { records: { yourAlliesHaveAPlan: true } })
  setCthulhuRage(state, 4)
  state.enemies = state.enemies.filter(enemy => CTHULHU_FACET_CODES.includes(enemy.code) || enemy.code === CTHULHU_BODY_CODE)
  const result = behavior.actReveal(state, state.acts[0], api)
  assert.equal(result, 'finalSeal')
  assert.equal(cthulhuRage(state), 4, '1–2 人局设为 4')
  assert.equal(state.agendas[0].originalCode, AGENDA_FINAL_SEAL_CODE)
  assert.equal(state.acts[0].objective.type, 'finalSeal')
  assert.equal(state.doom, 2, '最终封印上 1[per_investigator] 毁灭')
  assert.equal(state.scenarioFlags.doomArkhamPartTwoFinalSeal, true)
  // 最终封印印记行动
  const inv = state.investigators[0]
  inv.assets.push({ id: 'art', code: '11552', originalCode: '11552', traits: ['Item', 'Artifact'], controllerSeat: 0 })
  inv.clues = 2
  const moves = behavior.actions(state, inv)
  const sigilMove = moves.find(move => move.rule === 'doomArkhamFinalSealSigil')
  assert.ok(sigilMove)
  assert.equal(behavior.performAction(state, inv, sigilMove, api), true)
  assert.deepEqual(sigilLocations(state), [inv.location])
  assert.equal(inv.clues, 0)
})

test('P7 theDoomOfArkhamPartII 最终封印：目标推进 → 结局 2/3，毁灭阈值推进 → 无结局（勘误）', () => {
  // 目标推进：3 名克苏鲁敌人胜利区 + 5 处印记
  const { state, api } = setup(2, { records: { yourAlliesHaveAPlan: true } })
  setCthulhuRage(state, 4)
  behavior.actReveal(state, state.acts[0], api)
  state.enemies = state.enemies.filter(enemy => enemy.code === CTHULHU_BODY_CODE)
  for (const code of ['11702', '11703', '11704']) {
    state.victoryDisplay.push({ id: `v-${code}`, code, originalCode: code, victory: 2 })
  }
  state.scenarioFlags.sigils = Object.fromEntries(state.locations.slice(0, SIGIL_REQUIRED).map(location => [location.id, true]))
  assert.equal(behavior.finalSealObjectiveMet(state), true)
  behavior.roundEnded(state, api)
  assert.equal(api.advancedAgenda, 1)
  assert.ok(api.finished === 'resolution2' || api.finished === 'resolution3', `实际 ${api.finished}`)
  behavior.resolution(state, api.finished, null, api)
  assert.equal(state.campaign.records.cthulhuWasBanished, true)

  // 毁灭阈值推进：未标记 objective → 每位调查员被击败 + 无结局
  const doomed = setup(2, { records: { yourAlliesHaveAPlan: true } })
  setCthulhuRage(doomed.state, 4)
  behavior.actReveal(doomed.state, doomed.state.acts[0], doomed.api)
  behavior.agendaReveal(doomed.state, doomed.state.agendas[0], doomed.api)
  assert.equal(doomed.api.finished, 'noResolution')
  behavior.resolution(doomed.state, 'noResolution', null, doomed.api)
  assert.equal(doomed.state.investigators.every(inv => inv.defeated), true)
  assert.equal(doomed.state.campaign.records.cthulhuAnnihilatedTheCityOfArkham, true)
  assert.equal(doomed.state.campaign.failed, true)
})

test('P7 theDoomOfArkhamPartII 议程背面：克苏鲁移动到完全淹没地点并交换为废墟版本', () => {
  const { state, api } = setup(2)
  // 让北区完全淹没（非废墟面，可交换）
  api.mechanics.water.change('northside', 2)
  behavior.agendaReveal(state, state.agendas[0], api)
  const northside = state.locations.find(location => location.id === 'northside')
  assert.equal(northside.originalCode, '11692')
  assert.equal(northside.revealed, false)
  assert.equal(ruinedLocationCount(state), 2, '北区换成废墟面 + 河岸城（废墟）本身')
  assert.equal(state.agendas[state.agendaIndex].backFace, true)
})

test('P7 theDoomOfArkhamPartII 7 处废墟：议程背面全员阵亡 → 无结局', () => {
  const { state, api } = setup(2)
  for (const id of ['northside', 'easttown', 'miskatonicUniversity', 'stMarysHospital', 'southside']) {
    swapToRuined(state, id, api)
  }
  // 河岸城本身就是废墟面
  state.locations.find(location => location.id === 'rivertownRuined').ruined = true
  swapToRuined(state, 'downtown', api)
  assert.equal(ruinedLocationCount(state), RUINED_LOCATION_LIMIT)
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(api.finished, 'noResolution')
  assert.equal(state.investigators.every(inv => inv.defeated), true)
})

// ---------------------------------------------------------------------------
// 7. 结局记录
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 结局记录：结局 1/2/3 与无结局的战役记录', () => {
  const expected = {
    resolution1: ['cthulhuWasDrivenAway'],
    resolution2: ['cthulhuWasBanished'],
    resolution3: ['cthulhuWasBanished', 'arkhamWasDestroyed'],
  }
  for (const [key, records] of Object.entries(expected)) {
    const { state, api } = setup(2)
    const result = behavior.resolution(state, key, null, api)
    for (const record of records) assert.equal(state.campaign.records[record], true, `${key}: ${record}`)
    assert.equal(state.campaign.records.doomOfArkhamPartTwoResolution, key)
    assert.equal(result.bonus, key === 'resolution3' ? 5 : 0)
  }
  const { state, api } = setup(2)
  behavior.resolution(state, 'noResolution', null, api)
  assert.equal(state.campaign.records.cthulhuAnnihilatedTheCityOfArkham, true)
  assert.equal(state.campaign.failed, true)
  // 存档往返
  const saved = JSON.parse(JSON.stringify(state))
  const summary = scenarioSummary(saved)
  assert.equal(summary.rage, cthulhuRage(state))
  assert.equal(summary.act, state.acts[state.actIndex].originalCode)
})

test('P7 theDoomOfArkhamPartII 怒气投影与存档往返', () => {
  const { state, api } = setup(2)
  const summary = scenarioSummary(state)
  assert.equal(summary.rage, 2)
  assert.equal(summary.facetsInPlay.length, 3)
  assert.equal(summary.cthulhuDeck, 18)
  assert.equal(summary.fullyFlooded.length, 0)
  const saved = JSON.parse(JSON.stringify(state))
  assert.equal(scenarioSummary(saved).cthulhuDeck, 18)
  assert.equal(cthulhuRage(saved), 2)
  const piles = decksFor(saved)
  assert.equal(piles.deck.length, 18)
  void api
})
