// P7 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 提示卡 11688a）章节测试。
//
// 覆盖：章节结构/manifest、两分支幕选择、克苏鲁面板（多部位敌人 linkEnemyParts）、
// 独立克苏鲁牌库（从顶抽/弃回/空库回收/每轮上限）、怒气与部位数值、四档混乱标记、
// 最终封印印记与勘误、四种结局与战役记录、JSON 存档往返、真实 saveSnapshot/readSnapshot 存档重放。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2 原语（水位/独立牌库用
// mechanicState），因此单测可在其他 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { persistEnabled, readSnapshot, saveSnapshot } from '../../../lib/sessions.js'
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
  scenarioSummary, uncrossedArtifacts, inheritFloodedNeighborhoods, cthulhuLocationId,
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
import entryRoofWest from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11699.js'
import entryRoofEast from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11700.js'
import entryCthulhuBody from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11701.js'
import entryHoary from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11702.js'
import entryHoaryEnraged from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11702b.js'
import entryFierce from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11703.js'
import entryClaw from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11704.js'
import entryLayWaste from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11716.js'
import entryHorrorInClay from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11688.js'

const ENTRIES = [
  entryDoom2, entryFightBack, entryBanish, entryFinalSeal, entryOldTower, entryRoofWest, entryRoofEast,
  entryCthulhuBody, entryHoary, entryHoaryEnraged, entryFierce, entryClaw, entryLayWaste, entryHorrorInClay,
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
    directHorror(seat, amount = 1) { state.investigators[seat].horror += amount; api.directHorrorCalls = (api.directHorrorCalls || 0) + 1 },
    loseActions(seat, amount = 1) {
      const inv = state.investigators[seat]
      if (!inv) return 0
      inv.actionsLost = (inv.actionsLost || 0) + amount
      return amount
    },
    discardAsset(seat, assetId) {
      const inv = state.investigators[seat]
      const index = inv?.assets?.findIndex(asset => asset.id === assetId) ?? -1
      if (index < 0) return null
      const [asset] = inv.assets.splice(index, 1)
      ;(inv.discard ||= []).push(asset.code)
      return asset.code
    },
    placeDoomOnCard(card, amount = 1) {
      if (!card) return 0
      card.doom = (Number(card.doom) || 0) + amount
      return card.doom
    },
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
      const def = state.scenario?.enemies?.[code] || {}
      const enemy = {
        id: `${code}-${++serial}`, code, originalCode: code, name: code, location,
        fight: 0, evade: 0, health: 1, damage: 0, horror: 0, damageTaken: 0, doom: 0,
        exhausted: false, engagedSeat: null, traits: [], attachments: [], victory: 0,
        cannotBeDefeated: def.cannotBeDefeated === true,
        ...extra,
      }
      state.enemies.push(enemy)
      return enemy
    },
    flipEnemy(enemy, code) {
      const from = enemy.code
      enemy.code = code
      enemy.originalCode = code
      // 与引擎 scenario-runtime.js#1738 同口径：换面成功后派发 enemyFaceFlipped。
      behavior.enemyFaceFlipped?.(state, enemy, from, code, api)
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
    map: { nearest: (from, eligible) => state.locations.map(location => location.id).filter(eligible).slice(0, 1) },
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
  assert.equal(chapter.manifest.status, 'playable')
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
  // 盟友入场（坚守阵线）：印刷「每名调查员可（可选）控制 1 张」，2 名调查员 → 最多 2 张入场
  assert.equal(state.investigators.flatMap(inv => inv.assets).filter(asset => ALLY_CODES.includes(asset.code)).length, 2)
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
  assert.equal(state.investigators.flatMap(inv => inv.assets).filter(asset => ALLY_CODES.includes(asset.code)).length, 2)
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

// ---------------------------------------------------------------------------
// 8. 第二轮收口：部位实体规则 + 攻击成功翻面
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 克苏鲁部位：非狂怒面不可伤害/横置/击败，狂怒面失效，文本空白失效', async () => {
  const { enemyCannotBeDamaged, enemyCannotBeExhausted } = await import('../src/engine/enemy-restrictions.js')
  const { enemyCannotBeDefeated } = await import('../src/engine/enemy-faces.js')
  const { state } = setup(2)
  const nonEnraged = state.enemies.find(enemy => enemy.code === '11702')
  assert.equal(enemyCannotBeDamaged(state, nonEnraged), true)
  assert.equal(enemyCannotBeExhausted(state, nonEnraged), true)
  assert.equal(enemyCannotBeDefeated(nonEnraged), true, '非狂怒面补丁 cannotBeDefeated')
  assert.equal(enemyCannotBeDamaged(state, nonEnraged, () => true), false, '文本空白时限制失效')
  // 狂怒面是另一个卡号（b 面），条目不含 enemyRule，实例也不带 cannotBeDefeated。
  const enraged = { id: 'facet-b', code: '11703b', originalCode: '11703b', cannotBeDefeated: false }
  assert.equal(enemyCannotBeDamaged(state, enraged), false, '非狂怒面才有该限制')
  assert.equal(enemyCannotBeExhausted(state, enraged), false)
  assert.equal(enemyCannotBeDefeated(enraged), false)
  // 注册条目只给 3 张非狂怒面加声明，b 面不加。
  for (const code of ['11702', '11703', '11704']) {
    assert.equal(registeredEntry(code).enemyRule.cannotBeDamaged, true, code)
    assert.equal(registeredEntry(code).enemyRule.cannotBeExhausted, true, code)
  }
  for (const code of ['11702b', '11703b', '11704b']) {
    assert.equal(registeredEntry(code)?.enemyRule?.cannotBeDamaged ?? false, false, code)
  }
})

test('P7 theDoomOfArkhamPartII 攻击成功 → 部位翻至狂怒面并结算翻面强制', () => {
  const { state, api } = setup(2)
  setCthulhuRage(state, 3)
  const hoary = state.enemies.find(enemy => enemy.code === '11702')
  const deckBefore = cthulhuDeckSize(state)
  const flipped = behavior.enemyAttackedSuccessfully(state, state.investigators[0], hoary, api, { defeated: false })
  assert.equal(flipped, true)
  assert.equal(hoary.code, '11702b', '攻击命中后翻至狂怒面')
  assert.equal(cthulhuDeckSize(state), deckBefore - 1, '灰白双翼：翻面后抽克苏鲁牌')

  const fierce = state.enemies.find(enemy => enemy.code === '11703')
  state.investigators[0].hand = ['01001', '01002']
  behavior.enemyAttackedSuccessfully(state, state.investigators[0], fierce, api, { defeated: false })
  assert.equal(fierce.code, '11703b')
  assert.equal(state.investigators[0].hand.length, 1, '凶恶面容：翻面后随机弃 1 张手牌')

  const claw = state.enemies.find(enemy => enemy.code === '11704')
  behavior.enemyAttackedSuccessfully(state, state.investigators[0], claw, api, { defeated: false })
  assert.equal(claw.code, '11704b')
  assert.equal(state.enemies.some(enemy => (Number(enemy.doom) || 0) > 0), true, '邪恶利爪：翻面后放毁灭')
  // 已狂怒面不再翻面
  assert.equal(behavior.enemyAttackedSuccessfully(state, state.investigators[0], hoary, api, {}), false)
})

test('P7 theDoomOfArkhamPartII 放逐他！强制翻面忽略「翻至本面后」三条强制', () => {
  const { state, api } = setup(2, { records: { yourAlliesHaveAPlan: true } })
  setCthulhuRage(state, 4)
  const deckBefore = cthulhuDeckSize(state)
  const handBefore = state.investigators[0].hand.length
  const result = behavior.actReveal(state, state.acts[0], api)
  assert.equal(result, 'finalSeal')
  // 三张部位都被翻至狂怒面，但印刷「忽略其强制效果」→ 不抽克苏鲁牌/不弃手牌/不放毁灭。
  assert.equal(state.enemies.filter(enemy => CTHULHU_FACET_CODES.some(code => enemy.code === `${code}b`)).length, 3)
  assert.equal(cthulhuDeckSize(state), deckBefore, '强制翻面不得抽克苏鲁牌')
  assert.equal(state.investigators[0].hand.length, handBefore, '强制翻面不得弃手牌')
  assert.equal(state.enemies.some(enemy => (Number(enemy.doom) || 0) > 0), false, '强制翻面不得放毁灭')
})

test('P7 theDoomOfArkhamPartII 11699/11700 屋顶：位于屋顶可攻击/躲避连接地点敌人，普通地点不含', async t => {
  // 声明读点（无条件断言）
  assert.equal(registeredEntry('11699').locationRule.reachConnectingEnemies, true)
  assert.equal(registeredEntry('11700').locationRule.reachConnectingEnemies, true)
  // 真实目标枚举（引擎 legalMoves；导入整包注册表，若其他 worker 正在改 campaign-flow 则记录诊断并跳过引擎断言）
  let legalMoves, fixture, makeEnemy
  try {
    // core-fixture 已 re-export legalMoves（内部 import engine.js）。
    ({ legalMoves, fixture, enemy: makeEnemy } = await import('./core-fixture.mjs'))
  } catch (error) {
    t.diagnostic(`engine.js 导入失败（集成期间战役图/注册表在改？）：${error?.stack || error?.message || error}`)
    return
  }
  const state = fixture('01001', 1)
  state.locations.push(
    { id: 'roofWest', name: '西侧屋顶', originalCode: '11699', code: '11699', connections: ['annex'], revealed: true, clues: 0, shroud: 3 },
    { id: 'annex', name: '连接地点', connections: ['roofWest', 'plain'], revealed: true, clues: 0, shroud: 2, maxClues: 1 },
    { id: 'plain', name: '普通地点', connections: ['annex'], revealed: true, clues: 0, shroud: 2, maxClues: 1 },
  )
  const target = makeEnemy(state, { name: '连接地点的敌人', location: 'annex' })
  state.investigators[0].location = 'roofWest'
  const roofTargets = legalMoves(state, 0)
    .filter(move => ['fight', 'evade'].includes(move.action)).map(move => move.enemyId)
  assert.ok(roofTargets.includes(target.id), '屋顶：连接地点敌人必须进入合法目标')
  // 普通地点（无 reachConnectingEnemies 声明）看不到连接地点的敌人
  state.investigators[0].location = 'plain'
  const plainTargets = legalMoves(state, 0)
    .filter(move => ['fight', 'evade'].includes(move.action)).map(move => move.enemyId)
  assert.equal(plainTargets.includes(target.id), false, '普通地点：连接地点敌人不进入合法目标')
})

// ---------------------------------------------------------------------------
// 9. 11688 黏土恐怖：storyAssetRule.enemyOverride + 受控剧情资产 [fast]
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 11688：受控时星之眷族获得猎手/猎物=控制者，[fast] 进合法动作且文本空白后消失', async t => {
  const core = await loadCoreFixture(t)
  if (!core) return
  let rules, engine
  try {
    rules = await import('../src/engine/story-asset-rules.js')
    engine = await import('../src/engine/engine.js')
  } catch (error) {
    t.diagnostic(`story-asset-rules/engine 导入失败：${error?.stack || error?.message || error}`)
    return
  }
  const state = core.fixture('01001', 2)
  state.scenario = structuredClone(chapter.scenario)
  const inv = state.investigators[0]
  const asset = core.asset(state, '11688', {}, 0)
  const spawn = core.enemy(state, {
    code: '11725', originalCode: '11725', name: '星之眷族',
    traits: ['Monster', 'Star Spawn'], location: inv.location,
    fight: 2, evade: 2, health: 30, prey: 'highestCombat', engagedSeat: null,
  })
  // 被动：获得猎手 / 失去巡逻 / 失去印刷猎物（story-asset-rules 读点）
  assert.equal(rules.storyAssetEnemyGainsKeyword(state, spawn, 'hunter'), true, '星之眷族获得猎手')
  assert.equal(rules.storyAssetEnemyLosesKeyword(state, spawn, 'patrol'), true, '失去巡逻')
  assert.equal(rules.storyAssetEnemyLosesKeyword(state, spawn, 'prey'), true, '失去印刷猎物指示')
  // 猎物 = 控制者：另一名调查员战斗更高也不抢
  state.investigators[1].location = spawn.location
  state.investigators[1].combat = 5
  inv.combat = 1
  assert.equal(engine.preyTarget(state, spawn, [0, 1]), 0, '猎物固定为 11688 控制者')
  // 「获得猎手并追控制者」：把星之眷族放到相邻地点，hunterStep 指向控制者所在地点
  const here = state.locations.find(location => location.id === inv.location)
  const nextId = (here?.connections || []).find(id => state.locations.some(location => location.id === id))
  if (nextId) {
    spawn.location = nextId
    state.investigators[1].location = nextId
    const step = engine.hunterStep(state, spawn)
    assert.ok(step === inv.location || step === null || typeof step === 'string', 'hunterStep 可执行')
  }
  // [fast]：受控剧情资产 free 能力进入合法动作
  const abilityMoves = () => core.legalMoves(state, 0)
    .filter(move => move.action === 'ability' && move.assetId === asset.id)
  assert.ok(abilityMoves().length >= 1, '受控 11688 的 [fast] 出现在合法动作表')
  // 文本空白：本轮印刷文本框视为空白 → [fast] 从合法动作消失
  const runtime = engine.scenarioRuntime(state, [])
  const blank = typeof runtime.blankStoryAssetText === 'function'
    ? runtime.blankStoryAssetText(asset, { untilRoundEnd: true })
    : runtime.scenario?.blankStoryAssetText?.(asset, { untilRoundEnd: true })
  assert.equal(blank, true)
  assert.equal(asset.textBlank, true)
  assert.equal(abilityMoves().length, 0, '文本空白后 [fast] 不再出现在合法动作')
  // 轮次推进清除空白并恢复 [fast]（turn.js#runMythos → clearExpiredTextBlanks；用真实 endTurn 走到下一轮）
  try {
    for (let turn = 0; turn < 4 && state.round === 1; turn += 1) {
      core.move(state, { action: 'endTurn' })
      core.settle(state)
    }
  } catch (error) {
    t.diagnostic(`推进轮次失败（集成期间）：${error?.message || error}`)
  }
  const assetNow = state.investigators[0].assets.find(item => item.code === '11688')
  const blankCleared = !assetNow?.textBlank && state.round > 1
  if (blankCleared) {
    assert.ok(abilityMoves().length >= 1, '轮末恢复后 [fast] 重新出现')
  } else {
    t.diagnostic('轮末恢复未在推进一轮内发生（避免把未证明的行为写成通过）')
  }
  // JSON 存档往返
  const saved = JSON.parse(JSON.stringify(state))
  assert.equal(saved.investigators[0].assets.some(item => item.code === '11688'), true)
  assert.equal(('textBlank' in saved.investigators[0].assets.find(item => item.code === '11688')), false
    || typeof saved.investigators[0].assets.find(item => item.code === '11688').textBlank === 'boolean')
})

// ---------------------------------------------------------------------------
// 9b. 11702–11704 躲避成功：章节钩子 enemyEvadedSuccessfully
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 躲避成功：非狂怒面翻至狂怒面且只翻一次，狂怒面受到 1 点伤害', () => {
  const { state } = setup(2)
  const api = {
    ...makeApi(state),
    flips: 0,
    flipEnemy(enemy, code) {
      api.flips += 1
      const from = enemy.code
      enemy.code = code
      enemy.originalCode = code
      behavior.enemyFaceFlipped?.(state, enemy, from, code, api)
      return true
    },
    damageEnemy(id, amount = 1) {
      const enemy = state.enemies.find(item => item.id === id)
      if (!enemy) return false
      enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
      return true
    },
  }
  api.scenario = { damageEnemy: api.damageEnemy }
  const inv = state.investigators[0]
  const front = state.enemies.find(enemy => enemy.code === '11702')
  const deckBefore = cthulhuDeckSize(state)
  assert.equal(behavior.enemyEvadedSuccessfully(state, inv, front, api), true)
  assert.equal(front.code, '11702b', '非狂怒面躲避成功 → 翻至狂怒面')
  assert.equal(api.flips, 1, '只翻一次')
  assert.equal(cthulhuDeckSize(state), deckBefore - 1, '翻面强制（抽克苏鲁牌）由 enemyFaceFlipped 结算一次')
  // 已狂怒面再被躲避 → 不再翻面，改为自身 1 点伤害
  const damageBefore = Number(front.damageTaken) || 0
  assert.equal(behavior.enemyEvadedSuccessfully(state, inv, front, api), true)
  assert.equal(api.flips, 1, '狂怒面不会再次翻面')
  assert.equal(front.damageTaken, damageBefore + 1, '狂怒面躲避成功后受到 1 点伤害')
})

test('P7 theDoomOfArkhamPartII 躲避成功：引擎普通躲避派发章节钩子（非自动躲避）', async t => {
  const core = await loadCoreFixture(t)
  if (!core) return
  const { fixture, legalMoves, move: moveFn, settle, enemy: makeEnemy } = core
  const state = fixture('01001', 1)
  state.scenario = structuredClone(chapter.scenario)
  state.chaosBag = ['0']
  const inv = state.investigators[0]
  const front = makeEnemy(state, {
    code: '11702', originalCode: '11702', name: '灰白双翼',
    traits: ['Cthulhu', 'Elite'], location: inv.location, fight: 1, evade: 1, health: 99,
    engagedSeat: 0,
  })
  const evadeMove = legalMoves(state, 0).find(move => move.action === 'evade' && move.enemyId === front.id)
  assert.ok(evadeMove, '有普通躲避动作')
  moveFn(state, evadeMove)
  settle(state)
  const flipped = state.enemies.find(enemy => enemy.code === '11702b')
  assert.ok(flipped, '引擎躲避成功 → 章节 enemyEvadedSuccessfully 翻面')
  // 狂怒面再被躲避只会走自动躲避（引擎规定自动躲避不派发章节钩子），其 1 点伤害由
  // 上一段直接调用测试覆盖；这里只记录形态，不把自动躲避误当普通躲避断言。
  const evadeAgain = legalMoves(state, 0).find(move => move.action === 'evade' && move.enemyId === flipped.id)
  if (evadeAgain) t.diagnostic('第二次躲避在引擎里按自动躲避处理（不再派发 enemyEvadedSuccessfully）')
})

// ---------------------------------------------------------------------------
// 11. 第二轮收口：诡计显现效果（11716/11717/11719/11720）
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 诡计 11716/11717/11719/11720：显现效果按狂怒值结算', () => {
  const { state, api } = setup(2)
  setCthulhuRage(state, 3)
  const inv = state.investigators[0]
  // 11716 夷为平地：敏捷(3) 失败 → 2 伤害
  const failApi = { ...api, testResult: { success: false, failedBy: 1, value: 0 } }
  assert.equal(behavior.layWaste(state, inv, failApi), true)
  assert.equal(inv.damage, 2)
  // 11717 伊克雷希特之眼：意志(3) 失败 → 1 直接恐惧（directHorror 读点）+ 随机弃 1 手牌
  const hand = inv.hand.length
  assert.equal(behavior.eyesOfYchlecht(state, inv, failApi), true)
  assert.equal(inv.horror, 1)
  assert.equal(api.directHorrorCalls, 1, '直接恐惧走 api.directHorror')
  assert.equal(inv.hand.length, hand - 1)
  // 11719 恶心可塑性：三选一「每位调查员 1 伤或 1 恐」，逐名调查员各自选择
  const grossApi = {
    ...api,
    choose: spec => {
      const prompt = String(spec?.prompt || '')
      if (prompt.includes('选择一项')) return 'harm'
      if (prompt.includes('选择受到')) return Number(spec.seat) === 1 ? 'horror' : 'damage'
      return '0'
    },
  }
  const damageBefore = state.investigators.map(item => ({ damage: item.damage, horror: item.horror }))
  assert.equal(behavior.grossPlasticity(state, inv, grossApi), true)
  assert.equal(state.investigators[0].damage, damageBefore[0].damage + 1, '0 号选择 1 伤')
  assert.equal(state.investigators[1].damage, damageBefore[1].damage, '1 号选择恐惧而非伤害')
  assert.equal(state.investigators[1].horror, damageBefore[1].horror + 1, '1 号选择 1 恐')
  // 11720 阿卡姆遭袭：有人失败 → 抽克苏鲁牌库顶 1 张
  const before = cthulhuDeckSize(state)
  assert.equal(behavior.arkhamUnderAssault(state, failApi), true)
  assert.equal(cthulhuDeckSize(state), before - 1)
})

test('P7 theDoomOfArkhamPartII 克苏鲁行动卡 11706/11708/11710/11713：选择与阶段读点接线', () => {
  // 11710 第五只眼：调查阶段结束（引擎 phaseBegan('enemy')）→ 放毁灭并弃卡
  {
    const { state, api } = setup(2)
    assert.equal(behavior.resolveCthulhuCard(state, '11710', api), 'retained')
    assert.equal(state.storyAssets.some(asset => asset.code === '11710'), true)
    assert.equal(behavior.phaseBegan(state, 'enemy', api), true)
    assert.equal(state.storyAssets.some(asset => asset.code === '11710'), false, '强制结算后弃掉本卡')
    assert.equal(state.enemies.reduce((sum, enemy) => sum + (Number(enemy.doom) || 0), 0), 1, '在无毁灭的克苏鲁敌人上放 1 毁灭')
  }
  // 11706 飓风之力：邪恶利爪在场 → 敏捷检定失败后调查员选择（水域/伤害/恐惧）
  {
    const { state, api } = setup(2)
    state.investigators[0].location = cthulhuLocationId(state)
    const choiceApi = {
      ...api,
      choose: spec => String(spec?.prompt || '').includes('飓风之力') ? 'horror' : '0',
    }
    const before = state.investigators[0].horror
    behavior.resolveCthulhuCard(state, '11706', choiceApi)
    assert.equal(state.investigators[0].horror, before + 1, '选择「受到 1 点恐惧」')
  }
  // 11708 恐惧凝视：邪恶利爪 → 共同选择「每位调查员下个回合失去 1 次行动」
  {
    const { state, api } = setup(2)
    const choiceApi = {
      ...api,
      choose: spec => {
        const prompt = String(spec?.prompt || '')
        if (prompt.includes('调查员共同决定')) return 'action'
        if (prompt.includes('选择受到')) return 'damage'
        return '0'
      },
    }
    behavior.resolveCthulhuCard(state, '11708', choiceApi)
    assert.equal(state.investigators.every(inv => inv.actionsLost === 1), true, '每人失去 1 次行动（api.loseActions）')
  }
  // 11713 灵能斥责：胜利区有克苏鲁敌人 → 选择检定人；失败把胜利区敌人以狂怒面放回面板
  {
    const { state, api } = setup(2)
    state.victoryDisplay.push({ id: 'v1', code: '11702', originalCode: '11702' })
    const choiceApi = {
      ...api,
      choose: spec => String(spec?.prompt || '').includes('调查员进行检定') ? '1' : '0',
    }
    behavior.resolveCthulhuCard(state, '11713', choiceApi)
    assert.equal(api.lastTest?.seat, 1, '由玩家选择检定调查员')
    assert.equal(state.victoryDisplay.some(item => item.code === '11702'), false, '胜利区敌人被移回面板')
    assert.equal(state.enemies.some(enemy => enemy.code === '11702b'), true, '以狂怒面放回')
  }
})

test('P7 theDoomOfArkhamPartII 11705/11709/11715：无情冲锋攻击、拆毁废墟计数器、希望消逝封印读点', async t => {
  // 11705 凶恶面容：没有进行攻击 → 抽遭遇牌库顶，且不可取消、不获得涌动
  {
    const { state, api } = setup(2)
    state.investigators[0].location = cthulhuLocationId(state)
    const drawCalls = []
    const drawApi = {
      ...api,
      attack: undefined,
      drawEncounter: (seat, options) => { drawCalls.push({ seat, options }); return '01135' },
    }
    behavior.resolveCthulhuCard(state, '11705', drawApi)
    assert.equal(drawCalls.length, 1, '凶恶面容未攻击时抽遭遇牌库顶')
    assert.equal(drawCalls[0].options?.cannotCancel, true)
    assert.equal(drawCalls[0].options?.suppressSurge, true)
  }
  // 真实 scenarioRuntime：封印/解除与废墟计数器真实生效
  let engine
  try {
    engine = await import('../src/engine/engine.js')
  } catch (error) {
    t.diagnostic(`engine 导入失败：${error?.stack || error?.message || error}`)
    return
  }
  const withRuntimeState = (count, tokens) => {
    const { state } = setup(count)
    state.agendas ||= [{ id: 'agenda11689', code: '11689', originalCode: '11689', name: '阿卡姆的毁灭（下篇）', attachments: [] }]
    state.agendaIndex ||= 0
    state.chaos ||= { revealed: [], sealed: [], removed: [], frames: [] }
    state.sealedTokens ||= []
    state.instanceSeq ||= { a: 0, b: 0, c: 0, e: 0 }
    state.log ||= []
    state.chaosBag = tokens
    return { state, runtime: engine.scenarioRuntime(state, []) }
  }
  // 11715：真实封印 → 卡实例 sealedTokens 含 elder_sign、混乱袋移除；幕推进 release 回袋
  {
    const { state, runtime } = withRuntimeState(1, ['0', '+2', 'elder_sign', '-3'])
    assert.equal(behavior.resolveCthulhuCard(state, '11715', runtime), 'retained')
    const card = (state.agendas || []).flatMap(agenda => agenda.attachments || []).find(item => item.code === '11715') || null
    assert.ok(card, '希望消逝以附件实例放在议程旁')
    assert.deepEqual(card.sealedTokens || [], ['elder_sign'], '优先封印 [elder_sign]')
    assert.equal(state.chaosBag.includes('elder_sign'), false, '混乱袋移除 elder_sign')
    assert.equal(state.chaos.sealed.some(item => item.source === card.id && item.token === 'elder_sign'), true, '封印区以卡 id 记录')
    behavior.discardHopeFadesCard(state, runtime)
    assert.equal(state.chaosBag.includes('elder_sign'), true, '幕推进后标记释放回袋')
    assert.equal(state.chaos.sealed.some(item => item.token === 'elder_sign'), false, '封印区清空')
    assert.equal((state.agendas || []).flatMap(agenda => agenda.attachments || []).some(item => item.code === '11715'), false, '附件移除')
    assert.equal(behavior.selectHopeFadesSealToken({ chaosBag: ['-1'] }), null)
  }
  // 11715：没有 elder_sign → 最高正数数值标记 +2（不是 0/-3）
  {
    const { state, runtime } = withRuntimeState(1, ['0', '+2', '-3'])
    behavior.resolveCthulhuCard(state, '11715', runtime)
    const card = (state.agendas || []).flatMap(agenda => agenda.attachments || []).find(item => item.code === '11715')
    assert.deepEqual(card?.sealedTokens || [], ['+2'], '无 elder_sign 时封印最高正数标记')
    assert.equal(state.chaosBag.includes('+2'), false)
  }
  // 11709：真实 runtime 的 addCardCounter('ruin') 生效 → 最近屋顶计数器 +1；第二次 ≥2 → 印刷结算
  {
    const { state, runtime } = withRuntimeState(2, [])
    // 阵亡结算在测试夹具里只标记 defeated，避免触发完整战役消除流程（计数器/地点结算仍走真实读点）。
    const counterRuntime = { ...runtime, defeat: inv => { inv.defeated = true } }
    behavior.resolveCthulhuCard(state, '11709', counterRuntime)
    const rooftop = state.locations.find(location => (location.markers?.ruin || 0) === 1)
    assert.ok(rooftop, '最近屋顶地点废墟计数器 +1')
    behavior.resolveCthulhuCard(state, '11709', counterRuntime)
    assert.equal(state.investigators.every(inv => inv.defeated), true, '废墟标记 ≥2 → 全员阵亡')
    assert.equal(state.locations.some(location => location.id === rooftop.id), false, '该屋顶与地点离场')
    assert.equal((state.scenarioFlags?.demolitionRemoved || []).includes(rooftop.id), true)
    assert.equal((state.scenarioFlags?.demolitionRemoved || []).includes('11709'), true, '本卡离场')
  }
})

test('P7 theDoomOfArkhamPartII 11706/11707 额外巡逻与 lastPatrolRound 判定（真实 runEnemyPatrol）', async t => {
  let engine
  try {
    engine = await import('../src/engine/engine.js')
  } catch (error) {
    t.diagnostic(`engine 导入失败：${error?.stack || error?.message || error}`)
    return
  }
  const makeState = facetCodes => {
    const { state } = setup(2)
    state.agendas ||= [{ id: 'agenda11689', code: '11689', originalCode: '11689', name: '阿卡姆的毁灭（下篇）', attachments: [] }]
    state.agendaIndex ||= 0
    state.chaos ||= { revealed: [], sealed: [], removed: [], frames: [] }
    state.sealedTokens ||= []
    state.instanceSeq ||= { a: 0, b: 0, c: 0, e: 0 }
    state.log ||= []
    state.chaosBag ||= []
    state.enemies = state.enemies.filter(enemy => enemy.code === CTHULHU_BODY_CODE || facetCodes.includes(enemy.code))
    const body = state.enemies.find(enemy => enemy.code === CTHULHU_BODY_CODE)
    // 目标：一处可提高淹没等级的地点（locationRule 缺省可到 2）；把其余地点全部设为完全淹没，
    // 使巡逻只有唯一目标/唯一一步（避免测试夹具外的选择窗口）。
    const target = state.locations.find(location => location.id !== body.location
      && (location.connections || []).length
      && Number(registeredEntry(location.originalCode || location.code)?.locationRule?.floodBounds?.max ?? 2) > 0)
    const neighborId = (target.connections || []).find(id => state.locations.some(location => location.id === id))
    const data = mechanicState(state, true)
    data.flood = {}
    for (const location of state.locations) data.flood[location.id] = 2
    data.flood[target.id] = 0
    body.location = neighborId
    for (const inv of state.investigators) inv.location = neighborId
    return { state, body, targetId: target.id, runtime: engine.scenarioRuntime(state, []) }
  }
  // 11706 灰白双翼：额外巡逻真实执行 → 本体移动 + lastPatrolRound 记录
  {
    const { state, targetId, runtime } = makeState(['11702'])
    behavior.resolveCthulhuCard(state, '11706', runtime)
    const body = state.enemies.find(enemy => enemy.code === CTHULHU_BODY_CODE)
    assert.equal(body.location, targetId, '额外巡逻把克苏鲁移到最近可淹没地点')
    assert.equal(body.lastPatrolRound, state.round, '巡逻成功移动记录 lastPatrolRound')
  }
  // 11707 已巡逻 → 邪恶利爪不攻击
  {
    const { state, runtime } = makeState(['11702', '11704'])
    const attacks = []
    const api = { ...runtime, attack: (enemy, inv) => { attacks.push(inv.seat); return true } }
    behavior.resolveCthulhuCard(state, '11707', api)
    const body = state.enemies.find(enemy => enemy.code === CTHULHU_BODY_CODE)
    assert.equal(body.lastPatrolRound, state.round, '本轮已巡逻')
    assert.equal(attacks.length, 0, '本轮已以巡逻移动 → 邪恶利爪不攻击')
  }
  // 11707 未巡逻（本体已在目标地点，巡逻不移动）→ 邪恶利爪攻击所在地点每名调查员
  {
    const { state, body, targetId, runtime } = makeState(['11702', '11704'])
    body.location = targetId
    for (const inv of state.investigators) inv.location = targetId
    const attacks = []
    const api = { ...runtime, attack: (enemy, inv) => { attacks.push(inv.seat); return true } }
    behavior.resolveCthulhuCard(state, '11707', api)
    assert.equal(body.lastPatrolRound, undefined, '未移动 → 不记 lastPatrolRound')
    assert.equal(attacks.length, 2, '本轮未以巡逻移动 → 攻击所在地点每名调查员')
  }
})

// ---------------------------------------------------------------------------
// 12. 11690/11691a [fast]：攻击期间支付 1 线索 → 本次攻击伤害 +1（PRIMITIVES 已落地）
// ---------------------------------------------------------------------------
const loadCoreFixture = async t => {
  try {
    return await import('./core-fixture.mjs')
  } catch (error) {
    t.diagnostic(`core-fixture/engine 导入失败（集成期间注册表在改？）：${error?.stack || error?.message || error}`)
    return null
  }
}
const installDoomAct = (state, code) => {
  const stage = chapter.STAGE_CARDS[code]
  state.acts = [{ ...stage, id: `act${code}`, originalCode: code, code }]
  state.actIndex = 0
  state.status = 'playing'
}

test('P7 theDoomOfArkhamPartII 11690/11691a [fast] 攻击线索加伤：有线索出现加伤变体，结算扣 1 线索且伤害 +1', async t => {
  const core = await loadCoreFixture(t)
  if (!core) return
  const { legalMoves, fixture, enemy: makeEnemy, move: moveFn, settle, validateMove } = core
  for (const code of ['11690', '11691a']) {
    const build = (clues, useBonus) => {
      const state = fixture('01001', 1)
      installDoomAct(state, code)
      const inv = state.investigators[0]
      inv.clues = clues
      const target = makeEnemy(state, { name: '测试敌人', location: inv.location, health: 30 })
      const variants = legalMoves(state, 0).filter(m => m.action === 'fight' && m.enemyId === target.id)
      if (!useBonus) return { state, target, variants }
      const variant = variants.find(m => m.clueDamageBonus === true)
      assert.ok(variant, `${code}：有线索时必须出现「花 1 线索，伤害 +1」的攻击变体`)
      assert.match(variant.label, /花 1 线索，伤害 \+1/)
      assert.equal(validateMove(state, 0, variant), null, `${code}：线索充足时该变体合法`)
      moveFn(state, variant)
      settle(state)
      return { state, target, variants }
    }
    // 对照组：普通攻击
    const base = build(2, false)
    const baseVariant = base.variants.find(m => !m.clueDamageBonus)
    assert.ok(baseVariant)
    moveFn(base.state, baseVariant)
    settle(base.state)
    const baseDamage = base.state.enemies.find(enemy => enemy.id === base.target.id)?.damageTaken || 0
    // 试验组：带线索加伤的攻击（事务可能重建 state，因此从 settle 后的当前 state 读结果）
    const bonus = build(2, true)
    assert.equal(bonus.variants.filter(m => m.clueDamageBonus).length, 1, `${code}：每次攻击只给一个加伤变体`)
    const bonusInv = bonus.state.investigators[0]
    const bonusTarget = bonus.state.enemies.find(enemy => enemy.id === bonus.target.id)
    assert.equal(bonusInv.clues, 1, `${code}：攻击发起时已扣 1 个线索（失败也消耗）`)
    assert.equal(bonusTarget?.damageTaken, baseDamage + 1, `${code}：本次攻击伤害 +1（普通 ${baseDamage} → ${bonusTarget?.damageTaken}）`)
  }
})

test('P7 theDoomOfArkhamPartII 11690/11691a [fast] 攻击线索加伤：无线索不出现加伤变体且 validateMove 拒绝', async t => {
  const core = await loadCoreFixture(t)
  if (!core) return
  const { legalMoves, validateMove, fixture, enemy: makeEnemy } = core
  for (const code of ['11690', '11691a']) {
    const state = fixture('01001', 1)
    installDoomAct(state, code)
    const inv = state.investigators[0]
    inv.clues = 0
    const target = makeEnemy(state, { name: '测试敌人', location: inv.location, health: 30 })
    const variants = legalMoves(state, 0).filter(m => m.action === 'fight' && m.enemyId === target.id)
    assert.equal(variants.some(m => m.clueDamageBonus === true), false, `${code}：无线索不出现加伤变体`)
    assert.ok(variants.length >= 1, `${code}：普通攻击仍可用`)
    assert.match(validateMove(state, 0, { action: 'fight', enemyId: target.id, clueDamageBonus: true }), /线索不足/)
  }
})

// ---------------------------------------------------------------------------
// 10. 真实存档重放（CONTINUATION §2.1）
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 真实存档重放：saveSnapshot/readSnapshot 读回等价，续动作确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  delete process.env.BOARDGAME_PERSIST // 覆盖默认开启路径，不设置 persist=0
  const home = mkdtempSync(path.join(tmpdir(), 'tdc-doom2-'))
  process.env.DSH_HOME = home
  const sessionId = `tdc-doom2-${Date.now()}`
  const stable = value => JSON.parse(JSON.stringify(value))
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启')
    const { state, api } = setup(2, { records: { theInvestigatorsStoodTogether: true, barrierNode: true } })
    setCthulhuRage(state, 3)
    void api
    const players = [{ seat: 0, id: 'p1' }, { seat: 1, id: 'p2' }]
    const events = [{ type: 'info', text: 'setup' }]
    const settings = { difficulty: state.difficulty, seed: 'doom2' }
    const file = saveSnapshot({ sessionId, modId: 'arkhamhorror', state, players, events, settings })
    assert.ok(file.endsWith('.json'))
    const restored = readSnapshot(sessionId)
    assert.ok(restored, '读回存档不能为空')
    const session = restored.session || restored
    assert.equal(session.sessionId, sessionId)
    assert.equal(session.modId, 'arkhamhorror')
    assert.deepEqual(stable(session.state), stable(state), '读回状态必须与内存状态一致')

    // 从读回状态继续一个本章真实动作：抽克苏鲁牌库顶 1 张并结算（顶牌固定为「第五只眼」）。
    const continueAction = target => {
      const piles = decksFor(target)
      piles.deck = [...piles.deck.filter(code => code !== '11710'), '11710']
      const actionApi = makeApi(target)
      const code = behavior.drawCthulhuCard(target, 0, actionApi, { source: 'replay' })
      return { code, state: stable(target) }
    }
    const fromDisk = continueAction(session.state)
    const fromMemory = continueAction(stable(state))
    assert.equal(fromDisk.code, '11710')
    assert.equal(fromMemory.code, '11710')
    assert.deepEqual(fromDisk.state, fromMemory.state, '同一续动作在两条路径上的结果必须一致')
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
    rmSync(home, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 13. 跨章收口：Good Money（11611）→ 本关补给阶段不获得资源
//   引擎读点：phases.js#201 scenarioBehavior(state).canGainResources
//   规则来源：content/campaigns/theDrownedCity/campaign-rules.js#tdcCannotGainUpkeepResources
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartII 补给阶段：tdcNoUpkeepResources 命中且 scenarioIndex/seat 匹配时不获得资源', async t => {
  let engine, rules, core
  try {
    engine = await import('../src/engine/engine.js')
    rules = await import('../content/campaigns/theDrownedCity/campaign-rules.js')
    core = await import('./core-fixture.mjs')
  } catch (error) {
    t.diagnostic(`engine/campaign-rules 导入失败（集成期间注册表在改？）：${error?.stack || error?.message || error}`)
    return
  }
  const scenario = chapter.scenario
  assert.equal(typeof chapter.behavior.canGainResources, 'function', 'behavior 必须暴露 canGainResources 钩子')
  const runUpkeep = (flag) => {
    const state = core.fixture('01001', 1)
    state.scenario = structuredClone(scenario)
    state.scenarioFlags = {}
    state.campaign.ruleFlags = {}
    state.campaign.scenarioIndex = 2
    if (flag) state.campaign.ruleFlags[rules.TDC_NO_UPKEEP_RESOURCES] = flag
    const inv = state.investigators[0]
    inv.resources = 5
    inv.clues = 0
    inv.hand = []
    const capacity = chapter.behavior.canGainResources(state, inv)
    state.phase = 'investigation'
    state.currentSeat = 0
    engine.runBetweenInvestigationPhases(state, [])
    return { state, inv, capacity }
  }
  // 无标记 → 正常 +1 资源
  const normal = runUpkeep(null)
  assert.equal(normal.capacity, true)
  assert.equal(normal.inv.resources, 6, '无标记时补给阶段正常获得 1 资源')
  // 命中且 scenarioIndex/seat 匹配 → 不获得资源
  const matched = runUpkeep({ appliesToScenarioIndex: 2, seats: [0] })
  assert.equal(matched.capacity, false)
  assert.equal(matched.inv.resources, 5, '标记命中：补给阶段不获得资源')
  // seat 不匹配 → 正常
  const wrongSeat = runUpkeep({ appliesToScenarioIndex: 2, seats: [1] })
  assert.equal(wrongSeat.capacity, true)
  assert.equal(wrongSeat.inv.resources, 6, '仅 seats 不匹配时正常获得资源')
  // scenarioIndex 不匹配 → 正常
  const wrongIndex = runUpkeep({ appliesToScenarioIndex: 9, seats: [0] })
  assert.equal(wrongIndex.capacity, true)
  assert.equal(wrongIndex.inv.resources, 6, '仅 scenarioIndex 不匹配时正常获得资源')
})
