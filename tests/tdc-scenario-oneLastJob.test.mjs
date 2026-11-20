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
  assert.equal(chapter.manifest.status, 'playable')
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
  assert.equal(implementedEntryFlags('11502').doomThreshold, 7)
  assert.deepEqual(implementedEntryFlags('11513'), {})
  assert.equal(registeredEntry('11515').implemented, true, '11515 已接 enemyDamaged 强制窗口')
  assert.equal(registeredEntry('11516').implemented, true, '11516 已接 attachToEnemy/afterParley/attachmentAbilities')
  assert.equal(typeof registeredEntry('11504b').flags, 'object')
  // 数值直接从卡表读：萨迪/内奥米/执行者
  assert.equal(scenario.enemies['11510'].fight, 2)
  assert.equal(scenario.enemies['11510'].victory, 1)
  assert.equal(scenario.enemies['11513'].hunter, true)
  assert.equal(scenario.enemies['11513'].prey, 'mostClues')
  assert.equal(scenario.enemies['11514'].aloof, true)
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


// ---------------------------------------------------------------------------
// 6. saveReplay：真实 saveSnapshot / readSnapshot 持久化 + 同一动作重放
// ---------------------------------------------------------------------------
test('P7 oneLastJob saveReplay：saveSnapshot/readSnapshot 恢复后状态等价，外星语言动作结果一致', async () => {
  const fsMod = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const home = fsMod.mkdtempSync(path.join(os.tmpdir(), 'dsh-tdc-obj-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const { saveSnapshot, readSnapshot, persistEnabled } = await import('../../../lib/sessions.js')
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启路径必须被覆盖')
    const { state } = setup(1)
    state.investigators[0].clues = 1
    const session = {
      sessionId: 'tdc-one-last-job-save-replay',
      modId: 'arkhamhorror',
      state: JSON.parse(JSON.stringify(state)),
      players: [{ seat: 0, name: '调查员1' }],
      events: [{ kind: 'setup', note: 'test' }],
      settings: { difficulty: 'standard' },
    }
    const file = saveSnapshot(session)
    assert.equal(fsMod.existsSync(file), true, '快照文件应落盘')
    const restoredRecord = readSnapshot(session.sessionId)
    assert.ok(restoredRecord, 'readSnapshot 应返回记录')
    assert.equal(restoredRecord.sessionId ?? restoredRecord.session.sessionId, session.sessionId)
    const restoredState = restoredRecord.session.state
    assert.deepEqual(restoredState, JSON.parse(JSON.stringify(state)), '恢复后状态必须与内存状态等价')

    // 同一起点上执行本章真实动作（蒂林哈斯特密所「发现外星语言」），结果指纹必须一致。
    const moveOf = target => behavior.actions(target, target.investigators[0])
      .find(move => move.rule === 'oneLastJobAlienLanguage')
    const freshMove = moveOf(state)
    const restoredMove = moveOf(restoredState)
    assert.ok(freshMove && restoredMove, '两个起点都必须提供同一动作')
    assert.equal(freshMove.reason, null)
    assert.equal(restoredMove.reason, null)
    const apiFresh = makeApi(state)
    const apiRestored = makeApi(restoredState)
    assert.equal(behavior.performAction(state, state.investigators[0], freshMove, apiFresh), true)
    assert.equal(behavior.performAction(restoredState, restoredState.investigators[0], restoredMove, apiRestored), true)
    const fingerprint = target => JSON.stringify({
      records: target.campaign.records,
      clues: target.investigators[0].clues,
      flags: target.scenarioFlags,
      summary: scenarioSummary(target),
    })
    assert.equal(fingerprint(restoredState), fingerprint(state), '恢复后继续同一动作的结果必须一致')
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fsMod.rmSync(home, { recursive: true, force: true })
  }
})


// ---------------------------------------------------------------------------
// 7. 第二轮接线：议程反应的最远/最近空地点走 P7 图距离原语
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// 8. 第二轮接线：11513/11514 强制效果与头目关键词（引擎既有读点）
// ---------------------------------------------------------------------------
test('P7 oneLastJob 第二轮接线：11513 执行者每轮强制、11514 线人生成与发现线索代价、头目 immobile/retaliate/alert', () => {
  const { state, api } = setup(1)
  // 头目关键词由 definition 解析，引擎 enemies.js 读 def.immobile / def.retaliate / def.alert。
  assert.equal(scenario.enemies['11510'].immobile, true, '萨迪不能移动')
  assert.equal(scenario.enemies['11510'].retaliate, true, '萨迪反击')
  assert.equal(scenario.enemies['11511'].immobile, true, '内奥米不能移动')
  assert.equal(scenario.enemies['11511'].alert, true, '内奥米警戒')

  // 11513：每轮首次攻击另一名罪犯敌人后，执行者重整并攻击该调查员。
  const inv = state.investigators[0]
  const easttown = state.locations.find(location => location.id === 'easttown')
  inv.location = 'easttown'
  const criminal = api.spawn('11512', 'easttown')
  const enforcer = api.spawn('11513', 'easttown')
  enforcer.exhausted = true
  state.round = 2
  const attacks = []
  const apiBattle = { ...api, attack: (enemy, target) => { attacks.push([enemy.id, target.seat]) } }
  assert.equal(behavior.enemyAttackedSuccessfully(state, inv, criminal, apiBattle), true)
  assert.equal(enforcer.exhausted, false, '执行者重整')
  assert.deepEqual(attacks, [[enforcer.id, 0]], '执行者攻击该调查员')
  assert.equal(behavior.enemyAttackedSuccessfully(state, inv, criminal, apiBattle), false, '每轮只触发一次')

  // 11514：生成 = 最近的有线索阿卡姆地点；发现线索后花 3 资源或放 1 毁灭。
  easttown.clues = 1
  assert.equal(behavior.spawnLocation(state, '11514', 'fallback', 0, api), 'easttown')
  const informant = api.spawn('11514', 'easttown')
  const doomBefore = state.doom
  const apiDoom = { ...api, choose: () => 'doom', addDoom: () => { state.doom += 1 } }
  assert.equal(behavior.cluesGained(state, inv, 1, apiDoom), true)
  assert.equal(state.doom, doomBefore + 1, '选择放毁灭')
  inv.resources = 4
  const apiSpend = { ...api, choose: () => 'spend', loseResources: (seat, amount) => { state.investigators[seat].resources -= amount } }
  assert.equal(behavior.cluesGained(state, inv, 1, apiSpend), true)
  assert.equal(inv.resources, 1, '选择花费 3 资源')
  void informant
})


// ---------------------------------------------------------------------------
// 9. 第二轮接线：11511 首次被躲避后的重整与受伤取消
// ---------------------------------------------------------------------------
test('P7 oneLastJob 第二轮接线：11511 首次被躲避后重整，同地点调查员可受 1 伤害取消', () => {
  const { state, api } = setup(1)
  const inv = state.investigators[0]
  inv.location = 'easttown'
  const naomi = api.spawn('11511', 'easttown')
  naomi.exhausted = true
  state.round = 5
  assert.equal(behavior.afterEvade(state, inv, naomi, null, { ...api, choose: () => 'none' }), true)
  assert.equal(naomi.exhausted, false, '不取消时重整')
  assert.equal(behavior.afterEvade(state, inv, naomi, null, { ...api, choose: () => 'none' }), false, '每轮只触发一次')
  // 下一轮：由该地点调查员受到 1 点伤害取消。
  state.round = 6
  naomi.exhausted = true
  const damageBefore = inv.damage
  const apiPrevent = {
    ...api,
    choose: () => '0',
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
  }
  assert.equal(behavior.afterEvade(state, inv, naomi, null, apiPrevent), true)
  assert.equal(inv.damage, damageBefore + 1, '取消的调查员受到 1 点伤害')
  assert.equal(naomi.exhausted, true, '取消后保持横置')
})

// ---------------------------------------------------------------------------
// 13. Good Money（11611）跨章限制：章节 behavior.canGainResources 消费 campaign-rules
// ---------------------------------------------------------------------------
test('P7 oneLastJob Good Money 跨章限制：补给阶段 canGainResources 按 campaign.ruleFlags 命中', () => {
  const { state } = setup(1)
  const inv = state.investigators[0]
  assert.equal(behavior.canGainResources(state, inv), true, '无标记 → 正常获得资源')
  state.campaign.ruleFlags = {
    tdcNoUpkeepResources: { originScenario: 'theGrandVault', seats: [0], appliesToScenarioIndex: 7 },
  }
  state.campaign.scenarioIndex = 7
  assert.equal(behavior.canGainResources(state, inv), false, 'seat + scenarioIndex 命中 → 补给阶段不能获得资源')
  state.campaign.scenarioIndex = 8
  assert.equal(behavior.canGainResources(state, inv), true, 'scenarioIndex 不匹配 → 正常获得')
  state.campaign.scenarioIndex = 7
  assert.equal(behavior.canGainResources(state, { seat: 1 }), true, 'seat 不匹配 → 正常获得')
  // seats 为空表示全队都受限（Good Money playBothSides 失败口径）。
  state.campaign.ruleFlags.tdcNoUpkeepResources = { originScenario: 'theGrandVault', seats: [], appliesToScenarioIndex: 7 }
  assert.equal(behavior.canGainResources(state, { seat: 1 }), false, 'seats 为空 → 全队受限')
  delete state.campaign.ruleFlags.tdcNoUpkeepResources
  assert.equal(behavior.canGainResources(state, inv), true, '移除标记 → 恢复正常')
})


// ---------------------------------------------------------------------------
// 10. 第四轮：11502/11503 最后线索改条目 abilities（clueDiscovered 窗口）
// ---------------------------------------------------------------------------
test('P7 oneLastJob 议程反应（条目 abilities）：lastClue + Arkham 地点才触发，非最后线索/非 Arkham 不触发', () => {
  for (const code of ['11502', '11503']) {
    const ability = registeredEntry(code).abilities[0]
    assert.equal(ability.kind, 'reaction')
    assert.deepEqual(ability.trigger, ['clueDiscovered'])
    const state = {
      locations: [
        { id: 'easttown', code: '01132', originalCode: '01132', name: '东城区', traits: ['Arkham'], clues: 0 },
        { id: 'cave', code: '11521', originalCode: '11521', name: '洞穴', traits: ["R'lyeh", 'Walkway'], clues: 0 },
      ],
    }
    const check = context => ability.criteria({ state, context, helpers: {} })
    assert.equal(check({ location: 'easttown', lastClue: true, seat: 0 }), true, code + ' 最后线索 + Arkham 触发')
    assert.equal(check({ location: 'easttown', lastClue: false, seat: 0 }), false, code + ' 非最后线索不触发')
    assert.equal(check({ location: 'cave', lastClue: true, seat: 0 }), false, code + ' 非 Arkham 地点不触发')
    assert.equal(check({ location: 'missing', lastClue: true, seat: 0 }), false, code + ' 地点不存在不触发')
  }
})

test('P7 oneLastJob 议程反应（条目 abilities）：弃遭遇顶 3 张并把罪犯敌人生成到最近空地点', () => {
  const ability = registeredEntry('11502').abilities[0]
  const state = {
    locations: [
      { id: 'easttown', code: '01132', originalCode: '01132', name: '东城区', traits: ['Arkham'], clues: 0 },
      { id: 'riverDock', code: '01132', originalCode: '01132', name: '河岸码头', traits: ['Arkham'], clues: 0 },
    ],
    investigators: [{ seat: 0, name: '调查员1', location: 'easttown', defeated: false, resigned: false }],
  }
  const nearestCalls = []
  const spawned = []
  const discardCalls = []
  const api = {
    discardEncounterTop: count => { discardCalls.push(count); return ['11512', '11749', '11512'] },
    cardType: code => (code === '11512' ? 'enemy' : 'treachery'),
    cardTraits: code => (code === '11512' ? ['Humanoid', 'Criminal', 'Syndicate'] : []),
    mechanics: { map: { nearest: (from, eligible) => { nearestCalls.push(from); return ['riverDock'].filter(id => eligible(state.locations.find(location => location.id === id))) } } },
    spawnEnemyAt: (code, locationId) => { spawned.push([code, locationId]) },
    info: () => {},
  }
  ability.resolve({ state, context: { location: 'easttown', lastClue: true, seat: 0 }, api })
  assert.deepEqual(discardCalls, [3], '弃遭遇顶 3 张')
  assert.deepEqual(nearestCalls, ['easttown', 'easttown'], '每名罪犯敌人都从线索地点求最近空地点')
  assert.deepEqual(spawned, [['11512', 'riverDock'], ['11512', 'riverDock']], '两名罪犯敌人生成在最近空地点')
})

// ---------------------------------------------------------------------------
// 11. 第四轮：11515 伤害减 1 + 自伤 + 弃卡；11516 附属/涌动/谈判后攻击/行动弃卡
// ---------------------------------------------------------------------------
test('P7 oneLastJob 11515 卷入交火：失败减 1 伤害 + 1 直接伤害 + 弃卡；成功不减', () => {
  const entry = registeredEntry('11515')
  assert.equal(entry.implemented, true)
  const threatCalls = []
  assert.deepEqual(entry.encounterResolve({}, { seat: 0 }, { code: '11515' }, {
    threat: (seat, code) => threatCalls.push([seat, code]), info: () => {},
  }), { placed: true })
  assert.deepEqual(threatCalls, [[0, '11515']], '显现进入威胁区')
  const ability = entry.abilities[0]
  assert.equal(ability.kind, 'forced')
  assert.deepEqual(ability.trigger, ['enemyDamaged'])

  const makeState = () => {
    const threatCard = { id: 'threat-11515', code: '11515', originalCode: '11515' }
    const enemy = {
      id: 'gang-1', code: '11512', originalCode: '11512', name: '帮派士兵',
      location: 'easttown', traits: ['Humanoid', 'Criminal', 'Syndicate'], damageTaken: 2,
    }
    const state = {
      locations: [{ id: 'easttown', traits: ['Arkham'] }],
      enemies: [enemy],
      investigators: [{ seat: 0, name: '调查员1', location: 'easttown', threat: [threatCard], defeated: false, resigned: false }],
    }
    return { state, enemy, threatCard }
  }

  // 失败：伤害 -1 + 1 直接伤害 + 弃卡。
  {
    const { state, enemy, threatCard } = makeState()
    assert.equal(ability.criteria({ state, source: threatCard, context: { enemy, amount: 2 }, helpers: {} }), true)
    const directDamage = []
    let removed = null
    let asked = 0
    const api = {
      choose: () => { asked += 1; return 'agility' },
      test: (seat, skill, difficulty, options) => { api.lastTest = { seat, skill, difficulty }; options.resolve({ success: false }) },
      directDamage: (seat, amount) => directDamage.push([seat, amount]),
      removeThreat: card => { removed = card; return true },
      setEnemyDamageTaken: (target, amount) => { target.damageTaken = amount },
      info: () => {},
    }
    ability.resolve({ state, source: threatCard, context: { enemy, amount: 2 }, api })
    assert.equal(asked, 1, '技能选择只弹一次')
    assert.deepEqual(api.lastTest, { seat: 0, skill: 'agility', difficulty: 3 })
    assert.equal(enemy.damageTaken, 1, '本次伤害减 1')
    assert.deepEqual(directDamage, [[0, 1]], '受到 1 点直接伤害')
    assert.equal(removed, threatCard, '弃掉卷入交火')
  }
  // 成功：不减、不自伤、不弃卡。
  {
    const { state, enemy, threatCard } = makeState()
    const directDamage = []
    let removed = null
    const api = {
      choose: () => 'intellect',
      test: (seat, skill, difficulty, options) => options.resolve({ success: true }),
      directDamage: (seat, amount) => directDamage.push([seat, amount]),
      removeThreat: card => { removed = card; return true },
      info: () => {},
    }
    ability.resolve({ state, source: threatCard, context: { enemy, amount: 2 }, api })
    assert.equal(enemy.damageTaken, 2, '成功不减伤害')
    assert.deepEqual(directDamage, [], '成功不受直接伤害')
    assert.equal(removed, null, '成功不弃卡')
  }
})

test('P7 oneLastJob 11516 谈判破裂：附属最近罪犯敌人 / 无目标涌动 / 谈判后攻击 / 意志行动弃卡', () => {
  const entry = registeredEntry('11516')
  assert.equal(entry.implemented, true)
  const enemy = {
    id: 'gang-2', code: '11512', originalCode: '11512', name: '帮派士兵',
    location: 'easttown', traits: ['Humanoid', 'Criminal', 'Syndicate'], attachments: [],
  }
  const state = { enemies: [enemy], locations: [{ id: 'easttown' }, { id: 'miskatonic' }] }
  const attachments = []
  const nearestCalls = []
  const api = {
    mechanics: { map: { nearest: (from, eligible) => { nearestCalls.push(from); return ['easttown'].filter(id => eligible(state.locations.find(location => location.id === id))) } } },
    attachToEnemy: (target, code, extra) => { attachments.push([target.id, code, extra?.id]); target.attachments.push({ id: extra?.id, code, originalCode: code }) },
    info: () => {},
  }
  assert.deepEqual(entry.encounterResolve(state, { location: 'easttown', seat: 0 }, { code: '11516' }, api),
    { placed: true })
  assert.deepEqual(nearestCalls, ['easttown'])
  assert.deepEqual(attachments, [['gang-2', '11516', '11516:gang-2']], '附属到最近的罪犯敌人')

  // 无目标 → 涌动结果。
  const emptyState = { enemies: [], locations: [] }
  assert.deepEqual(entry.encounterResolve(emptyState, { location: 'easttown', seat: 0 }, { code: '11516' }, {
    mechanics: { map: { nearest: () => [] } }, info: () => {},
  }), { placed: false, gainSurge: true })

  // 谈判后攻击：behavior.afterParley 检查 11516 附属。
  const attacks = []
  const attacked = behavior.afterParley({ enemies: [enemy] },
    { seat: 0, name: '调查员1', location: 'easttown', defeated: false, resigned: false }, enemy, {
      attack: (target, inv) => attacks.push([target.id, inv.seat]), info: () => {},
    })
  assert.equal(attacked, true)
  assert.deepEqual(attacks, [['gang-2', 0]], '附属敌人攻击谈判者')

  // [action] 意志(3) 成功弃卡（attachmentAbilities + detachEncounterAttachment）。
  const attachment = enemy.attachments[0]
  let detached = null
  let tested = null
  entry.treacheryRule.attachmentAbilities[0].resolve({
    inv: { seat: 0, name: '调查员1' }, source: attachment,
    api: {
      test: (seat, skill, difficulty, options) => { tested = { seat, skill, difficulty }; options.resolve({ success: true }) },
      scenario: { detachEncounterAttachment: card => { detached = card } },
      info: () => {},
    },
  })
  assert.deepEqual(tested, { seat: 0, skill: 'willpower', difficulty: 3 })
  assert.equal(detached, attachment, '意志检定成功后弃掉谈判破裂')
})


// ---------------------------------------------------------------------------
// 12. 第六轮：11506/11507 线索转移+冷漠、11508 谈判互伤、11514 最近地点 BFS
// ---------------------------------------------------------------------------
test('P7 oneLastJob 11506/11507 幕 2 背面：转移至多 2 个线索到非精英敌人 + 有线索罪犯敌人冷漠同步', () => {
  const { state, api } = setup(1)
  state.campaign.leadSeat = 0
  state.acts = [
    { id: 'act1', code: '11504', originalCode: '11504' },
    { id: 'act2', code: '11506', originalCode: '11506' },
    { id: 'act3', code: '11508', originalCode: '11508' },
  ]
  state.actIndex = 1
  const boss = api.spawn('11510', 'hibbsRoadhouse')
  boss.clues = 2
  const damageCalls = []
  const keywordCalls = []
  const choices = []
  let targetId = null
  const apiAct = {
    ...api,
    choose: request => {
      choices.push(request)
      if (request.kind === 'choice') return '2'
      targetId = targetId || state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '11512')?.id
      return targetId
    },
    damageEnemy: (id, amount, seat) => { damageCalls.push([id, amount, seat]) },
    takeEnemyClues: (enemy, seat, count) => {
      const moved = Math.min(count, Number(enemy.clues) || 0)
      enemy.clues = (Number(enemy.clues) || 0) - moved
      state.investigators[seat].clues = (Number(state.investigators[seat].clues) || 0) + moved
      return moved
    },
    moveClueToEnemy: (enemy, options = {}) => {
      const owner = state.investigators[options.seat]
      if (!owner || (Number(owner.clues) || 0) < 1) return 0
      owner.clues -= 1
      enemy.clues = (Number(enemy.clues) || 0) + 1
      return 1
    },
    loseClues: (seat, n) => {
      const owner = state.investigators[seat]
      owner.clues = Math.max(0, (Number(owner.clues) || 0) - (Number(n) || 0))
    },
    setEnemyKeywords: (enemy, keywords, spec = {}) => keywordCalls.push([enemy.id, keywords.join(','), spec.enabled]),
  }
  assert.equal(behavior.actReveal(state, state.acts[1], apiAct), true)
  const soldier = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '11512')
  assert.ok(soldier, '帮派士兵已生成')
  const rival = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '11511')
  assert.ok(rival, '对手头目已生成')
  assert.equal(boss.clues, 0, '头目身上的 2 个线索被移走')
  assert.equal(soldier.clues, 2, '非精英敌人获得 2 个线索')
  assert.ok(damageCalls.some(([id, amount]) => id === rival.id && amount === 2), '对手头目被放置 2 点伤害')
  assert.ok(choices.some(request => request.kind === 'choice' && String(request.options.length) === '3'),
    '领队选择移动线索数量（0/1/2）')
  assert.ok(keywordCalls.some(([id, keywords, enabled]) => id === soldier.id && keywords === 'aloof' && enabled === true),
    '有线索的罪犯敌人获得冷漠（aloof=true）')
  assert.ok(keywordCalls.some(([id, keywords, enabled]) => id === boss.id && keywords === 'aloof' && enabled === false),
    '无线索的罪犯敌人不获得冷漠（aloof=false）')
})

test('P7 oneLastJob 11506/11507 冷漠同步：phaseBegan/enemySpawned 按线索有无续期', () => {
  const { state, api } = setup(1)
  state.acts = [
    { id: 'act1', code: '11504', originalCode: '11504' },
    { id: 'act2', code: '11506', originalCode: '11506' },
    { id: 'act3', code: '11508', originalCode: '11508' },
  ]
  state.actIndex = 2
  const thug = api.spawn('11512', 'easttown')
  const keywordCalls = []
  const apiAloof = {
    ...api,
    setEnemyKeywords: (enemy, keywords, spec = {}) => keywordCalls.push([enemy.id, spec.enabled]),
  }
  thug.clues = 1
  behavior.phaseBegan(state, 'investigation', apiAloof)
  assert.ok(keywordCalls.some(([id, enabled]) => id === thug.id && enabled === true), '线索>0 → 冷漠')
  thug.clues = 0
  behavior.enemySpawned(state, thug, apiAloof)
  assert.ok(keywordCalls.some(([id, enabled]) => id === thug.id && enabled === false), '线索=0 → 恢复非冷漠')
})

test('P7 oneLastJob 11508 面对后果：谈判移除线索让该敌人把伤害值造成给同地点另一敌人', () => {
  const { state, api } = setup(1)
  state.acts = [
    { id: 'act1', code: '11504', originalCode: '11504' },
    { id: 'act2', code: '11506', originalCode: '11506' },
    { id: 'act3', code: '11508', originalCode: '11508' },
  ]
  state.actIndex = 2
  const inv = state.investigators[0]
  inv.location = 'easttown'
  const source = api.spawn('11512', 'easttown')
  const target = api.spawn('11513', 'easttown')
  source.clues = 1
  const moves = behavior.actions(state, inv)
  const move = moves.find(item => item.rule === 'oneLastJobGangWarsParley')
  assert.ok(move, '幕 3 出现谈判行动')
  assert.equal(move.reason, null, '有「有线索罪犯敌人 + 另一名敌人」时可用')
  const answers = [source.id, target.id]
  const damageCalls = []
  let clueRemoved = 0
  const apiAction = {
    ...api,
    choose: request => { assert.equal(request.kind, 'enemy'); return answers.shift() },
    takeEnemyClues: (enemy, seat, count) => {
      const moved = Math.min(count, Number(enemy.clues) || 0)
      enemy.clues = (Number(enemy.clues) || 0) - moved
      state.investigators[seat].clues = (Number(state.investigators[seat].clues) || 0) + moved
      clueRemoved += moved
      return moved
    },
    loseClues: (seat, n) => {
      const owner = state.investigators[seat]
      owner.clues = Math.max(0, (Number(owner.clues) || 0) - (Number(n) || 0))
    },
    damageEnemy: (id, amount, seat) => damageCalls.push([id, amount, seat]),
  }
  assert.equal(behavior.performAction(state, inv, move, apiAction), true)
  assert.equal(source.clues, 0, '移除 1 个线索')
  assert.equal(clueRemoved, 1)
  assert.deepEqual(damageCalls, [[target.id, Number(source.damage) || 0, inv.seat]], '该敌人对另一敌人造成其伤害值')
})

test('P7 oneLastJob 11514 帮派线人生成：无图距离原语时本地 BFS 仍取最近的有线索[[阿卡姆]]地点', () => {
  const { state, api } = setup(1)
  void api
  state.locations = [
    { id: 'start', code: '11509', originalCode: '11509', traits: ['Arkham'], clues: 0, connections: ['middle'] },
    { id: 'middle', code: '11509', originalCode: '11509', traits: ['Arkham'], clues: 0, connections: ['start', 'near'] },
    { id: 'near', code: '11509', originalCode: '11509', traits: ['Arkham'], clues: 2, connections: ['middle'] },
    { id: 'far', code: '11509', originalCode: '11509', traits: ['Arkham'], clues: 1, connections: [] },
  ]
  state.investigators[0].location = 'start'
  // 无 api.mechanics.map.nearest：BFS 应选连接可达的 near，而不是列表里更早出现的 far。
  const target = behavior.spawnLocation(state, '11514', 'start', 0, {})
  assert.equal(target, 'near')
})
