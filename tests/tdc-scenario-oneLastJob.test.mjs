// TDC P7 金盆洗手（oneLastJob · 提示卡 11501）章节测试。
//
// 覆盖：模块 import / manifest（17 张非玩家条目、8 地点、3 幕、2 议程、2 结局键）、
// 地点连接对称与布局边、遭遇牌库守恒（31 张固定牌库 + 放一边 + 移出）、
// 混乱标记四档（skull/tablet/elder_thing，cultist 不在袋）、幕 1 两版、幕目标与背面、
// 议程背面、结局记录（露比赌局输赢）、外星语言记录、单卡条目注册与 JSON 存档往返。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { assertScenarioManifest, assertUiLayout } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/index.js'
import {
  scenario, ACT_CODES, ALT_ACT_CODES, ACT1_V1_CODE, ACT1_V2_CODE, ACT2_SHELDON_CODE,
  ACT2_OBANNION_CODE, ACT3_CODE, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS, ACTS, AGENDAS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, LOCATIONS, LOCATION_TABLE, LOCATION_COORDINATES,
  START_LOCATION, START_LOCATION_IDS, SETUP_LOCATION_IDS, LINKED_LOCATION_IDS,
  SET_ASIDE_ALIASES, REMOVED_LOCATION_CODES, RESOLUTION_KEYS, SCENARIO_TEXT,
} from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/definition.js'
import { behavior, scenarioSummary, implementedEntryFlags } from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/behavior.js'
import {
  oneLastJobChaosToken, oneLastJobTokenValue, ONE_LAST_JOB_TOKEN_MEANINGS, skullValue,
  criminalsInPlay, criminalAtInvestigator, isHardSide, CHAOS_TOKEN_FACES, tierOf,
} from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/chaos.js'

const ENTRY_CODES = Object.freeze([
  '11502', '11503', '11504', '11505', '11504b', '11505b', '11506', '11507', '11508',
  '11509', '11510', '11511', '11512', '11513', '11514', '11515', '11516',
])
const ENTRIES = []
for (const code of ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theDrownedCity/oneLastJob/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (count = 1, records = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: count,
  phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [],
})
const stateWithScenario = (count = 1, records = {}) => {
  const state = stateFor(count, records)
  state.scenario = clone(scenario)
  return state
}
const makeApi = (state, options = {}) => {
  const api = {
    state,
    info: () => {},
    finished: null,
    advanced: 0,
    attacks: [],
    choose: options.choose || (() => null),
    random: options.random || (() => 0.1),
    shuffle: options.shuffle || (list => [...list]),
    discardEncounterTop(count = 1) {
      const cards = []
      for (let index = 0; index < count; index += 1) {
        if (!state.encounterDeck.length) break
        cards.push(state.encounterDeck.pop())
      }
      state.encounterDiscard.push(...cards)
      return cards
    },
    test(seat, skill, difficulty, resolve) {
      const result = typeof api.testResult === 'function' ? api.testResult(seat, skill, difficulty)
        : (api.testResult || { success: true, successes: 2, value: difficulty + 2 })
      api.lastTest = { seat, skill, difficulty, result }
      resolve?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    defeat(inv) { inv.defeated = true },
    advanceAct() { api.advanced += 1 },
    finish(key) { api.finished = key },
    setCampaignRecord(key, value) { state.campaign.records[key] = value },
    spawn(code, locationId, extra = {}) {
      const definition = (state.scenario?.enemies || scenario.enemies)[code] || {}
      const enemy = {
        id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
        name: definition.name, location: locationId, fight: definition.fight ?? 2,
        evade: definition.evade ?? 2, health: definition.health ?? 2,
        damage: definition.damage || 0, horror: definition.horror || 0,
        traits: [...(definition.traits || [])], exhausted: extra.exhausted === true,
        engagedSeat: extra.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0,
        attachments: [], victory: definition.victory || 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    defeatEnemy(enemy) {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      return true
    },
  }
  return api
}
const setup = (count = 1, options = {}) => {
  const state = stateWithScenario(count, options.records || {})
  const api = makeApi(state, options)
  const report = behavior.setupScenario(state, api)
  return { state, api, report }
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 oneLastJob 章节结构：17 张条目、8 地点、3 幕、2 议程、development manifest', () => {
  assert.equal(chapter.scenario.id, 'oneLastJob')
  assert.equal(chapter.scenario.originalCode, '11501')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11501')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1'])
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...ENTRY_CODES].sort())
  assert.equal(Object.keys(LOCATIONS).length, 8)
  assert.equal(LOCATION_TABLE.length, 8)
  assert.equal(LINKED_LOCATION_IDS.length, 2)
  assert.equal(SETUP_LOCATION_IDS.length, 6)
  assert.deepEqual(chapter.manifest.acts, [{ id: 'act11504' }, { id: 'act11506' }, { id: 'act11508' }])
  assert.deepEqual(chapter.manifest.agendas, [{ id: 'agenda11502' }, { id: 'agenda11503' }])
  assert.equal(RESOLUTION_KEYS.length, 2)
  assert.equal(SCENARIO_TEXT.setupSteps.length, 7)
  assert.equal(ACT_STAGES[1].objective.clueThreshold, 2)
  assert.equal(AGENDA_STAGES[1].doomThreshold, 7)
  assert.equal(STAGE_CARDS[ACT1_V2_CODE].originalCode, ACT1_V2_CODE)
  assert.equal(ACT_CODES[0], ACT1_V1_CODE)
  assert.equal(ALT_ACT_CODES[0], ACT1_V2_CODE)
  assert.equal(AGENDA_CODES.length, 2)
  assert.equal(Object.keys(AGENDAS).length, 2)
  assert.equal(Object.keys(ACTS).length, 3)
})

test('P7 oneLastJob manifest 通过 schema 校验，地点连接对称且布局边真实', () => {
  const manifest = clone(chapter.manifest)
  assert.deepEqual(assertScenarioManifest(manifest), manifest)
  assert.ok(assertUiLayout(clone(chapter.layout), new Set(Object.keys(LOCATIONS)),
    new Set(Object.entries(chapter.CONNECTIONS).flatMap(([from, tos]) => tos.map(to => `${from}>${to}`)))))
  assert.equal(manifest.startLocationId, START_LOCATION)
  assert.equal(LOCATIONS[START_LOCATION].connections.includes('miskatonicUniversity'), true)
  for (const location of Object.values(LOCATIONS)) {
    for (const target of location.connections) {
      assert.equal(LOCATIONS[target].connections.includes(location.id), true, `${location.id} ↔ ${target} 必须对称`)
    }
  }
  assert.equal(chapter.layout.edges.length, 16)
  for (const edge of chapter.layout.edges) {
    assert.ok(LOCATIONS[edge.from].connections.includes(edge.to), `边 ${edge.from}→${edge.to} 必须是真实连接`)
  }
  assert.deepEqual(manifest.zones.removed.map(entry => entry.cardCode).sort(), [...REMOVED_LOCATION_CODES].sort())
  assert.equal(manifest.zones.setAside.find(entry => entry.cardCode === '11513')?.count, 2)
  assert.equal(manifest.zones.setAside.find(entry => entry.cardCode === '11506')?.count, 1)
  assert.equal(Object.keys(LOCATION_COORDINATES).length, 8)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库守恒
// ---------------------------------------------------------------------------
test('P7 oneLastJob 遭遇牌库守恒：31 张固定牌库，头目/执行者/幕放一边', () => {
  assert.equal(ENCOUNTER_DECK.length, 31)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11515').length, 2)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11516').length, 2)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11512').length, 3)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11514').length, 2)
  for (const excluded of ['11510', '11511', '11513']) {
    assert.equal(ENCOUNTER_DECK.includes(excluded), false, `${excluded} 应放一边，不进遭遇牌库`)
  }
  const report = scenarioZoneReport(scenario, chapter.manifest)
  assert.equal(report.encounterCards, 31)
  assert.equal(report.declaredSetAsideCards, SET_ASIDE_ALIASES.length + 0)
  assert.equal(report.locationCount, 8)
  assert.equal(report.duplicateActiveZoneCodes.length, 0)
  assert.equal(report.optionalZoneCollisions.length, 0)
  const { state } = setup(1)
  assert.equal(state.encounterDeck.length, 31)
  assert.deepEqual([...state.scenarioZones.setAside], [...SET_ASIDE_ALIASES])
  assert.deepEqual([...state.locations].map(location => location.id).sort(), [...SETUP_LOCATION_IDS].sort())
  assert.equal(ENCOUNTER_DECK_CODES.length, 13)
})

// ---------------------------------------------------------------------------
// 3. 布置与幕 1 两版
// ---------------------------------------------------------------------------
test('P7 oneLastJob 布置：6 地点入场、起始蒂林哈斯特密所、两间酒馆等待幕 1 背面', () => {
  const { state, report } = setup(2, { random: () => 0.1 })
  assert.equal(report.act1Variant, 'v1')
  assert.equal(report.act1Code, ACT1_V1_CODE)
  assert.equal(state.investigators.every(inv => inv.location === START_LOCATION), true)
  assert.equal(state.locations.some(location => location.id === 'hibbsRoadhouse'), false)
  assert.equal(LOCATIONS.tillinghastEsoterica.cluesPerInvestigator, 1)
  assert.equal(LOCATIONS.miskatonicUniversity.cluesPerInvestigator, 2)
  assert.equal(LOCATIONS.hibbsRoadhouse.victory, 1)
  const west = setup(1, { random: () => 0.9 })
  assert.equal(west.report.act1Variant, 'v2')
  assert.equal(west.report.act1Code, ACT1_V2_CODE)
  assert.equal(west.report.bossCode, '11511')
  assert.deepEqual(west.state.acts.map(act => act.originalCode), [ACT1_V2_CODE, '11507', ACT3_CODE])
})

test('P7 oneLastJob 幕 1 目标 / 背面：线索放上幕、酒馆入场、头目生成、幕牌库补齐', () => {
  const { state, api } = setup(1)
  assert.equal(chapter.behavior.cluesOnAct(state), 0)
  state.actClues = 2 + 1
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(api.advanced, 1)
  assert.equal(behavior.actReveal(state, state.acts[0], api), true)
  assert.ok(state.locations.some(location => location.id === 'hibbsRoadhouse'))
  const sadie = state.enemies.find(enemy => enemy.originalCode === '11510')
  assert.ok(sadie, '幕 1 背面生成萨迪·谢尔顿')
  assert.equal(sadie.location, 'hibbsRoadhouse')
  assert.deepEqual(state.acts.map(act => act.originalCode), [ACT1_V1_CODE, ACT2_SHELDON_CODE, ACT3_CODE])
})

test('P7 oneLastJob 幕 2/幕 3：头目伤害推进、对手帮派找上门、精英在胜利区进入结局 1', () => {
  const { state, api } = setup(1)
  state.acts = [ACT1_V1_CODE, ACT2_SHELDON_CODE, ACT3_CODE].map(code => clone(STAGE_CARDS[code]))
  state.actIndex = 1
  const sadie = api.spawn('11510', 'hibbsRoadhouse')
  sadie.damageTaken = 1
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(api.advanced, 1)
  assert.equal(behavior.actReveal(state, state.acts[1], api), true)
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '11511'), '欧巴尼恩帮找上门')
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '11513'))
  state.actIndex = 2
  state.victoryDisplay.push({ id: 'sadie', code: '11510', originalCode: '11510', victory: 1 })
  assert.equal(behavior.roundEnded(state, api), true)
  assert.equal(api.advanced, 2)
  assert.equal(behavior.actReveal(state, state.acts[2], api), true)
  assert.equal(api.finished, 'resolution1')
})

test('P7 oneLastJob 议程背面：议程 1 生成执行者并洗回弃牌；议程 2 全员击败 + 无结局', () => {
  const { state, api } = setup(2)
  state.investigators[0].clues = 3
  state.investigators[0].location = 'easttown'
  state.enemies.push({
    id: 'old', code: '11512', originalCode: '11512', location: 'easttown',
    traits: ['Humanoid', 'Criminal', 'Syndicate'],
  })
  state.encounterDiscard.push('11515')
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true)
  const enforcer = state.enemies.find(enemy => enemy.originalCode === '11513')
  assert.ok(enforcer, '议程 1 背面生成帮派执行者')
  assert.equal(enforcer.engagedSeat, 0)
  assert.ok(state.encounterDeck.includes('11515'), '遭遇弃牌堆洗回遭遇牌库')
  // 议程 2 背面
  assert.equal(behavior.agendaReveal(state, state.agendas[1], api), true)
  assert.equal(state.investigators.every(inv => inv.defeated === true), true)
  assert.equal(state.campaign.trauma[0].physical, 1)
  assert.equal(api.finished, 'noResolution')
})

test('P7 oneLastJob 地点行动：外星语言（蒂林哈斯特密所）与幕 1 谈判', () => {
  const { state, api } = setup(1)
  state.investigators[0].clues = 1
  const alien = behavior.actions(state, state.investigators[0])
    .find(move => move.rule === 'oneLastJobAlienLanguage')
  assert.ok(alien)
  assert.equal(alien.reason, null)
  assert.equal(behavior.performAction(state, state.investigators[0], alien, api), true)
  assert.equal(state.campaign.records.theInvestigatorsDiscoveredAnAlienLanguage, true)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(behavior.performAction(state, state.investigators[0], alien, api), false, '每场游戏限一次')
  // 幕 1 谈判：交战中的罪犯敌人 ≤ 线索数 → 弃掉并放 1 线索到幕上。
  state.actClues = 0
  state.investigators[0].clues = 2
  const criminal = api.spawn('11512', 'tillinghastEsotericia' /* 故意错地点 */, { engagedSeat: 0 })
  criminal.location = 'tillinghastEsoterica'
  const parley = behavior.actions(state, state.investigators[0]).find(move => move.rule === 'oneLastJobParley')
  assert.ok(parley)
  assert.equal(behavior.performAction(state, state.investigators[0], parley, api), true)
  assert.equal(state.enemies.includes(criminal), false)
  assert.equal(chapter.behavior.cluesOnAct(state), 1)
  assert.equal(state.investigators[0].clues, 0)
})

// ---------------------------------------------------------------------------
// 4. 混乱标记
// ---------------------------------------------------------------------------
test('P7 oneLastJob 混乱标记：四档符号（cultist 不在战役袋）与追加效果', () => {
  const { state } = setup(1)
  state.investigators[0].location = 'easttown'
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
  assert.equal(criminalsInPlay(state).length, 0)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'skull'), 0)
  apiSpawnCriminal(state, '11512', 'easttown')
  assert.equal(criminalsInPlay(state).length, 1)
  assert.equal(criminalAtInvestigator(state, state.investigators[0])?.originalCode, '11512')
  assert.equal(skullValue(state), 1)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'skull'), -1)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'tablet'), -4)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'elderthing'), -3)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'cultist'), null, '袋里没有 cultist')
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(tierOf(state), 'hard')
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'skull'), -2, '困难：数量 +1')
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'tablet'), -5)
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'elderthing'), -4)
  const easy = oneLastJobChaosToken({ ...state, difficulty: 'standard' }, state.investigators[0], 'elderthing')
  assert.equal(easy.onFail[0].mode, 'discardSpawnCriminal')
  assert.equal(easy.onFail[0].count, 3)
  const hard = oneLastJobChaosToken(state, state.investigators[0], 'elderthing')
  assert.equal(hard.onFail[0].count, 6)
  assert.equal(hard.onFail[0].immediateAttack, true)
  assert.deepEqual(oneLastJobChaosToken(state, state.investigators[0], 'tablet').onDraw, [])
  assert.equal(ONE_LAST_JOB_TOKEN_MEANINGS.standard.cultist.delta, null)
  assert.equal(ONE_LAST_JOB_TOKEN_MEANINGS.hard.tablet.delta, -3)
})

test('P7 oneLastJob [elder_thing] 失败：弃遭遇牌、生成罪犯敌人并交战（困难面立刻攻击）', () => {
  const { state, api } = setup(1)
  state.encounterDeck = ['01159', '11749', '11512', '11750']
  const inv = state.investigators[0]
  assert.equal(behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'discardSpawnCriminal', count: 3 }, api), true)
  assert.equal(state.encounterDiscard.length, 3)
  const spawned = state.enemies.find(enemy => enemy.originalCode === '11512')
  assert.ok(spawned, '弃牌里的罪犯敌人被生成')
  assert.equal(spawned.engagedSeat, 0)
})

// ---------------------------------------------------------------------------
// 5. 结局与记录
// ---------------------------------------------------------------------------
test('P7 oneLastJob 结局：无结局记露比赢、结局 1 记露比输、外星语言翻符文 A', () => {
  for (const [key, record] of [['noResolution', 'rubyWonTheBet'], ['resolution1', 'rubyLostTheBet']]) {
    const { state, api } = setup(1)
    const result = behavior.resolution(state, key, null, api)
    assert.equal(state.campaign.records[record], true, `${key} → ${record}`)
    assert.equal(result.flowData.resolution, key)
  }
  const { state, api } = setup(1)
  state.campaign.records.theInvestigatorsDiscoveredAnAlienLanguage = true
  behavior.resolution(state, 'resolution1', null, api)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['A'])
  assert.equal(state.scenarioFlags.tdcGlyphTranslation.A, 'Depths')
})

test('P7 oneLastJob 只读投影与 JSON 存档往返', () => {
  const { state } = setup(2)
  state.actClues = 2
  const summary = scenarioSummary(state)
  assert.equal(summary.act, ACT1_V1_CODE)
  assert.equal(summary.actClues, 2)
  assert.equal(summary.clueThreshold, 4)
  assert.equal(summary.setAside.length, SET_ASIDE_ALIASES.length)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.equal(restored.locations.length, state.locations.length)
})

// ---------------------------------------------------------------------------
// 6. 单卡条目
// ---------------------------------------------------------------------------
test('P7 oneLastJob 单卡条目：17 张注册、code 唯一、数据条目 flags 与读点', () => {
  assert.equal(ENTRIES.length, 17)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 17)
  for (const entry of ENTRIES) {
    assert.equal(registeredEntry(entry.code).code, entry.code)
    assert.ok(['agenda', 'act', 'location', 'enemy', 'treachery'].includes(entry.scope), `${entry.code} scope`)
  }
  assert.equal(chapter.implementedEncounterCodes.includes('11504b'), true)
  assert.equal(chapter.implementedEncounterCodes.includes('11505b'), true)
  assert.equal(implementedEntryFlags('11504').clueThreshold, 2)
  assert.equal(implementedEntryFlags('11506').bossCode, '11510')
  assert.equal(implementedEntryFlags('11508').eliteInVictory, 1)
  assert.equal(implementedEntryFlags('11509').alienLanguageAction, true)
  assert.equal(implementedEntryFlags('11502').arkhamLastClue, true)
  assert.deepEqual(implementedEntryFlags('11513'), {})
  assert.equal(registeredEntry('11515').implemented, false, '未实现的诡计不得标 implemented')
  assert.equal(registeredEntry('11516').implemented, false)
  assert.equal(typeof registeredEntry('11504b').flags, 'object')
  // 数值直接从卡表读：萨迪/内奥米/执行者
  assert.equal(scenario.enemies['11510'].fight, 2)
  assert.equal(scenario.enemies['11510'].victory, 1)
  assert.equal(scenario.enemies['11513'].hunter, true)
  assert.equal(scenario.enemies['11513'].prey, 'mostClues')
  assert.equal(scenario.enemies['11514'].aloof, true)
})

test('P7 oneLastJob 议程反应：阿卡姆地点最后一个线索后弃顶 3 张并生成罪犯', () => {
  const { state, api } = setup(1)
  state.locations.push({ id: 'easttown', code: '01132', originalCode: '01132', name: '东城区',
    traits: ['Arkham'], clues: 0, connections: [] })
  state.investigators[0].location = 'easttown'
  state.encounterDeck = ['11749', '11512', '11750']
  assert.equal(behavior.afterInvestigate(state, state.investigators[0], state.locations.at(-1), null, api), true)
  assert.equal(state.encounterDiscard.length, 3)
  assert.ok(state.enemies.some(enemy => enemy.originalCode === '11512'))
  const second = behavior.afterInvestigate(state, state.investigators[0], state.locations.at(-1), null, api)
  assert.equal(second, false, '同一议程+地点只触发一次')
})

function apiSpawnCriminal(state, code, locationId) {
  const definition = (state.scenario?.enemies || scenario.enemies)[code] || {}
  state.enemies.push({
    id: `${code}-${state.enemies.length + 1}`, code, originalCode: code,
    name: definition.name, location: locationId,
    traits: [...(definition.traits || [])], health: definition.health ?? 2,
    damage: definition.damage || 0, horror: definition.horror || 0,
    damageTaken: 0, exhausted: false, engagedSeat: null, attachments: [], clues: 0, doom: 0,
  })
}
