// P7 沉睡者墓穴（sepulchreOfTheSleeper · 提示卡 11673）章节测试。
//
// 覆盖：章节结构/manifest（9 张条目、6 张地点、特殊议程牌库）、入场/跳过门槛（战役记录：
// 神器/字形/内殿解封）、刻印壁龛行动、扰动（Disturbance）与毁灭替换、克苏鲁生成/削弱/败退附加结算、
// 四档混乱符号、结局键（noResolution/resolution1）与战役记录 theInvestigatorsHaltedCthulhusAwakening。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/index.js'
import { enemyKeywordOverride, enemyHasAttackKeyword } from '../src/engine/enemy-keyword-movement.js'
import {
  scenario, LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, START_LOCATION, ALCove_IDS, ALCove_OPTIONS,
  AGENDA_CODES, AGENDA_STAGES, BENEATH_THE_CITY_CODE, CTHULHU_AWAKENED_CODE, CTHULHU_CODE,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ARTIFACT_RECORDS, ARTIFACT_RECORD_KEYS, GLYPH_TOTAL, RESOLUTION_KEYS,
} from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/definition.js'
import {
  behavior, setupScenario, artifactsEarned, translatedGlyphCount, entryPrepared,
  entryFullyPrepared, sepulchreEntry, declineTheNightmare, spawnCthulhu, cthulhuInPlay, cthulhuDefeated,
  weakenCthulhu, artifactInPlay, maybeAdvanceBeneathTheCity, investigatorDefeatResolution,
  scenarioSummary, preScenarioSetup,
} from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/behavior.js'
import {
  disturbance, setDisturbance, increaseDisturbance, disturbanceThreshold, skullValue,
  sepulchreChaosToken, sepulchreChaosTokenValue, CTHULHU_TOKEN_MEANINGS, isHardSide,
  CHAOS_TOKEN_FACES,
} from '../content/campaigns/theDrownedCity/scenarios/sepulchreOfTheSleeper/chaos.js'

const ENTRY_DIR = new URL('../src/cards/encounter-entries/theDrownedCity/sepulchreOfTheSleeper/', import.meta.url)
const entryCodes = ['11674', '11674b', '11675', ...LOCATION_IDS.map(id => LOCATIONS[id].code)]
const ENTRIES = []
for (const code of [...new Set(entryCodes)]) {
  // eslint-disable-next-line no-await-in-loop
  const module = await import(new URL(`${code}.js`, ENTRY_DIR))
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const stateFor = (records = {}, { count = 1, difficulty = 'standard' } = {}) => ({
  investigators: Array.from({ length: count }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
    actionsLeft: 3,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty, numInvestigators: count,
  phase: 'investigation', round: 1, status: 'playing', rngState: 999,
})

test('P8 11673 邪教徒：失败差值达到 3 时仅本次遭遇附加险境与涌动', () => {
  const state = stateFor()
  const draws = []
  const api = { drawEncounter: (seat, options) => draws.push({ seat, options }) }
  for (const failedBy of [2, 3]) {
    behavior.applyTokenEffect(state, state.investigators[0], { mode: 'drawEncounterOnFail', test: { failedBy } }, api)
  }
  assert.deepEqual(draws, [{ seat: 0, options: undefined }, { seat: 0, options: { peril: true, grantSurge: true } }])
})

const makeApi = (state, options = {}) => {
  const api = {
    state, info: () => {}, finished: null,
    scenario: {
      setEnemyKeywords: (enemy, keywords, keywordOptions) => {
        enemy.keywordOverrides ||= {}
        for (const keyword of keywords) {
          enemy.keywordOverrides[keyword] = { enabled: keywordOptions.enabled, throughRound: keywordOptions.throughRound }
        }
        return true
      },
    },
    choose: options.choose || (() => null),
    shuffle: options.shuffle || (list => [...list]),
    test: (seat, skill, difficulty, resolve) => {
      const result = { success: options.testSuccess !== false, failedBy: options.failedBy ?? 0 }
      resolve?.(result)
      return result
    },
    revealToken: () => (options.tokens?.length ? options.tokens.shift() : '0'),
    spawn: (code, location) => {
      const enemy = { id: `${code}-1`, code, originalCode: code, name: code, location, health: 20, fight: 5,
        evade: 5, damage: 3, horror: 3, traits: ['Ancient One', 'Elite'], exhausted: false, engagedSeat: null,
        damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: 5 }
      state.enemies.push(enemy)
      return enemy
    },
    drawEncounter: seat => { const code = state.encounterDeck.pop(); if (code) state.investigators[seat].hand.push(code) },
    damage: (seat, amount = 1) => { state.investigators[seat].damage += amount },
    horror: (seat, amount = 1) => { state.investigators[seat].horror += amount },
    discardRandom: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      for (let i = 0; i < amount && inv.hand.length; i++) inv.discard.push(inv.hand.shift())
      return true
    },
    addTrauma: (seat, kind, amount = 1) => {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus: (seat, amount = 1) => {
      state.investigators[seat].scenarioXpBonus = (state.investigators[seat].scenarioXpBonus || 0) + amount
    },
    finish: key => { api.finished = key },
    advanceAgenda: () => behavior.advanceBeneathTheCityLocal(state, api),
    defeat: inv => { inv.defeated = true },
    drivenInsane: seat => { state.investigators[seat].drivenInsane = true },
  }
  return api
}

const setup = ({ records = {}, ...options } = {}) => {
  const state = stateFor(records, options)
  const api = makeApi(state)
  const report = setupScenario(state, api)
  return { state, api, report }
}

// ---------------------------------------------------------------------------
// 1. 章节结构 / manifest
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 章节结构：9 张条目、6 张地点、特殊议程牌库、结局键逐字一致', () => {
  assert.equal(chapter.scenario.id, 'sepulchreOfTheSleeper')
  assert.equal(chapter.scenario.originalCode, '11673')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11673')
  assert.equal(chapter.implementedEncounterCodes.length, 9)
  assert.deepEqual(chapter.implementedEncounterCodes, ['11674', '11675', '11676', '11677', '11678', '11679', '11680', '11681', '11674b'])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1'])
  assert.equal(chapter.manifest.locations.length, 6)
  assert.equal(chapter.manifest.locations.map(location => location.id).includes('dreamersRest'), true)
  assert.deepEqual(chapter.manifest.agendaDeck.codes, [...AGENDA_CODES])
  assert.equal(chapter.manifest.agendaDeck.cthulhuCode, CTHULHU_CODE)
  assert.equal(chapter.manifest.agendaDeck.replacesActs, true)
  assert.equal(chapter.manifest.entryConditions.prepared.minGlyphs, 10)
  assert.equal(chapter.manifest.entryConditions.fullyPrepared.glyphs, GLYPH_TOTAL)
  assert.equal(ARTIFACT_RECORDS.length, 5)
  assert.equal(translatedGlyphCount({ campaign: { records: { discoveredGlyphs: ['A', 'B', 'a'] } } }), 2, '字形去重')
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 9)
  for (const code of entryCodes) {
    const content = readFileSync(new URL(`${code}.js`, ENTRY_DIR), 'utf8')
    assert.ok(content.includes(`code: '${code}'`), `${code} 条目 code 与文件名一致`)
  }
})

// ---------------------------------------------------------------------------
// 2. 地点连接
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 地点连接：梦者安息地与 5 张刻印壁龛相连且对称', () => {
  assert.equal(Object.keys(LOCATIONS).length, 6)
  assert.equal(START_LOCATION, 'dreamersRest')
  assert.deepEqual([...LOCATION_CONNECTIONS.dreamersRest].sort(), [...ALCove_IDS].sort())
  for (const id of ALCove_IDS) {
    assert.deepEqual([...LOCATION_CONNECTIONS[id]], ['dreamersRest'])
    const location = LOCATIONS[id]
    assert.equal(location.cluesPerInvestigator ?? location.clues, 1)
    assert.equal(location.shroud, 4)
  }
  assert.equal(LOCATIONS.dreamersRest.shroud, 1)
  assert.equal(ALCove_IDS.length, 5)
  for (const id of ALCove_IDS) assert.ok(ALCove_OPTIONS[id].artifactRecord)
})

// ---------------------------------------------------------------------------
// 3. 入场/跳过门槛（Campaigns/TheDrownedCity.hs DoStep 1–3）
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 入场/跳过：神器与字形门槛、内殿解封、知道得更清楚记录', () => {
  const empty = stateFor()
  assert.deepEqual(sepulchreEntry(empty), { branch: 'skip1', next: 'theAwakening', artifacts: 0, glyphs: 0, innerSanctum: false })
  assert.equal(entryPrepared(empty), false)
  assert.equal(entryFullyPrepared(empty), false)

  const partial = stateFor({ barrierNode: true, discoveredGlyphs: Array.from({ length: 10 }, (_, i) => String.fromCharCode(65 + i)) })
  const partialEntry = sepulchreEntry(partial)
  assert.equal(partialEntry.branch, 'skip2', '1 件神器 + 10 字形还不满足全解封')
  assert.equal(partialEntry.addZeroToken, true)
  assert.equal(entryPrepared(partial), true)
  assert.equal(entryFullyPrepared(partial), false)

  const fullRecords = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  fullRecords.discoveredGlyphs = Array.from({ length: GLYPH_TOTAL }, (_, i) => String.fromCharCode(65 + (i % 26)))
  fullRecords.theInnerSanctumWasUnsealed = true
  const full = stateFor(fullRecords)
  assert.equal(entryFullyPrepared(full), true)
  assert.deepEqual(sepulchreEntry(full).choices, ['knowBetter', 'layItToRest'])
  const declined = declineTheNightmare(full)
  assert.equal(full.campaign.records.theInvestigatorsDidNotConfrontTheNightmare, true)
  assert.equal(declined.next, 'theAwakening')
  // 缺内殿解封：仍停在 skip2。
  const noSanctum = stateFor({ ...fullRecords, theInnerSanctumWasUnsealed: false })
  assert.equal(sepulchreEntry(noSanctum).branch, 'skip2')
})

// ---------------------------------------------------------------------------
// 4. 布置：神器分配、远征物品、扰动 0
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 布置：6 地点入场、神器平均分配、远征物品可选、扰动 0', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api, report } = setup({ records, count: 3 })
  assert.equal(state.locations.length, 6)
  assert.equal(state.locations.find(location => location.id === 'dreamersRest').clues > 0, true)
  assert.equal(disturbance(state), 0)
  assert.equal(report.encounterDeckSize, ENCOUNTER_DECK.length)
  const artifactAssets = state.investigators.flatMap(inv => inv.assets.filter(asset => ARTIFACT_RECORDS.some(item => item.code === asset.originalCode)))
  assert.equal(artifactAssets.length, ARTIFACT_RECORDS.length, '5 件神器都入场')
  assert.equal(artifactInPlay(state, 'obsidianClaw')?.code, '11672a')
  api.choose = options => (options.kind === 'card' ? '0' : options.options?.[0]?.id ?? null)
  const items = behavior.distributeExpeditionItems(state, api)
  assert.equal(items >= 1, true)
  assert.equal(cthulhuInPlay(state), null, '克苏鲁开局不在场')
  // 直调 preScenarioSetup 返回入口判定。
  const intro = preScenarioSetup(state)
  assert.equal(['skip1', 'skip2', 'choice'].includes(intro.entry.branch), true)
})

// ---------------------------------------------------------------------------
// 5. 扰动 / 毁灭替换 / 议程推进
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 扰动：毁灭改为扰动，达阈值立刻推进并生成克苏鲁', () => {
  const { state, api } = setup({ count: 2 })
  assert.equal(disturbanceThreshold(state), 8, '1-2 名调查员阈值为 8')
  const enemy = { id: 'e1', code: '11741', originalCode: '11741', name: '敌人', type: 'enemy', fight: 2,
    evade: 2, health: 2, location: START_LOCATION, traits: [] }
  state.enemies.push(enemy)
  assert.equal(behavior.canPlaceDoomOn(state, enemy), false)
  assert.equal(disturbance(state), 1)
  setDisturbance(state, 7)
  assert.equal(behavior.canPlaceDoomOn(state, enemy), false)
  assert.equal(disturbance(state), 8)
  assert.equal(state.scenarioFlags.sepulchreAdvancePending, true)
  assert.equal(maybeAdvanceBeneathTheCity(state, api), true)
  assert.equal(state.agendaIndex, 1, '推进到「克苏鲁苏醒」')
  assert.equal(cthulhuInPlay(state)?.location, START_LOCATION, '克苏鲁生成于梦者安息地')
  // 非敌人（神器）上的毁灭不受替换影响。
  const artifact = artifactInPlay(state, 'barrierNode')
  if (artifact) assert.equal(behavior.canPlaceDoomOn(state, artifact), true)
})

test('P7 sepulchreOfTheSleeper 克苏鲁：神器削弱 -1 战斗/-1 躲避，败退附加结算与结局', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  const cthulhu = spawnCthulhu(state, api)
  const artifact = artifactInPlay(state, 'obsidianClaw')
  artifact.doom = 1
  assert.equal(behavior.enemyStatModifier(state, cthulhu, 'fight'), 0)
  const owner = state.investigators[artifact.controllerSeat ?? 0]
  assert.equal(weakenCthulhu(state, owner, api), true)
  assert.equal(artifact.doom, 0)
  assert.equal(behavior.enemyStatModifier(state, cthulhu, 'fight'), -1)
  assert.equal(behavior.enemyStatModifier(state, cthulhu, 'evade'), -1)
  assert.equal(weakenCthulhu(state, owner, api), false, '每轮每张支援限一次')
  // 密谋上放置毁灭：每位调查员 1 直接恐惧（需在「克苏鲁苏醒」）。
  state.agendaIndex = 1
  state.agendas[1] = { ...AGENDA_STAGES[CTHULHU_AWAKENED_CODE] }
  const horrorBefore = state.investigators[0].horror
  behavior.doomPlaced(state, { agenda: true, amount: 1 }, api)
  assert.equal(state.investigators[0].horror, horrorBefore + 1)
  // 败退附加结算：败退者发疯；全灭则战役失败。
  state.investigators[0].defeated = true
  const defeat = investigatorDefeatResolution(state, api)
  assert.deepEqual(defeat.defeated, [0])
  assert.equal(state.investigators[0].drivenInsane, true)
  assert.equal(defeat.campaignLost, false)
  state.investigators[1].defeated = true
  assert.equal(investigatorDefeatResolution(state, api).campaignLost, true)
})

// ---------------------------------------------------------------------------
// 6. 结局
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 结局：resolution1 写记录并直接结束战役（+10 经验/2 精神创伤），无结局失败', () => {
  const { state, api } = setup({ count: 2 })
  state.status = 'playing'
  const award = behavior.resolution(state, 'resolution1', null, api)
  assert.equal(state.campaign.records.theInvestigatorsHaltedCthulhusAwakening, true)
  assert.equal(state.status, 'playing')
  assert.equal(award.campaignWin, true)
  assert.equal(award.next, 'epilogue')
  assert.equal(state.campaign.trauma[0].mental, 2)
  assert.equal(award.bonus, 10)

  const failed = setup({ count: 1 }).state
  failed.investigators[0].defeated = true
  const failedAward = behavior.resolution(failed, 'noResolution')
  assert.equal(failedAward.campaignWin, false)
  assert.equal(failed.investigators[0].drivenInsane, true)
})

// ---------------------------------------------------------------------------
// 7. 混乱标记
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 混乱标记：四档、扰动上限、失败追加', () => {
  const { state } = setup({ count: 1 })
  setDisturbance(state, 4)
  assert.equal(skullValue(state), 4)
  assert.equal(sepulchreChaosTokenValue(state, 'skull'), -4)
  assert.equal(sepulchreChaosTokenValue(state, 'cultist'), -4)
  assert.equal(sepulchreChaosTokenValue(state, 'elderthing'), -3)
  assert.equal(sepulchreChaosToken(state, null, 'cultist').onFail[0].mode, 'drawEncounterOnFail')
  assert.equal(sepulchreChaosToken(state, null, 'tablet').onFail[0].mode, 'horrorOrDiscardPerFail')
  assert.equal(sepulchreChaosToken(state, null, 'elderthing').onDraw[0].mode, 'revealAnother')
  setDisturbance(state, 9)
  assert.equal(skullValue(state), 6, '简单/普通扰动上限 6')
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 9, '困难/专家不设上限')
  assert.equal(sepulchreChaosTokenValue(state, 'cultist'), -6)
  assert.equal(sepulchreChaosTokenValue(state, 'tablet'), -6)
  assert.equal(sepulchreChaosTokenValue(state, 'elderthing'), -4)
  assert.deepEqual([...CHAOS_TOKEN_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  assert.equal(CTHULHU_TOKEN_MEANINGS.standard.skull.rider, undefined)
  assert.equal(increaseDisturbance(state, 2), 11)
})

// ---------------------------------------------------------------------------
// 8. 壁龛行动
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 刻印壁龛：检定成功在对应神器上放 1 毁灭（团队线索追加 1）', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  const inv = state.investigators[0]
  inv.location = 'sigilCarvedAlcoveAmbition'
  state.investigators[1].location = 'sigilCarvedAlcoveAmbition'
  inv.clues = 2
  state.investigators[1].clues = 0
  const moves = behavior.actions(state, inv)
  assert.equal(moves.length, 1)
  assert.equal(moves[0].rule, 'sepulchreAlcove')
  api.choose = options => (options.prompt?.includes('额外放置') ? 'place' : null)
  const artifact = artifactInPlay(state, 'obsidianClaw')
  assert.equal(behavior.performAction(state, inv, moves[0], api), true)
  assert.equal(artifact.doom >= 1, true, '成功 + 团队线索追加后至少 1 个毁灭')
  // 航行壁龛没有检定：团队线索直接换 1 毁灭。
  const voyage = state.investigators.find(other => other.seat === 1)
  voyage.location = 'sigilCarvedAlcoveVoyage'
  inv.location = 'sigilCarvedAlcoveVoyage'
  inv.clues = 2
  voyage.clues = 0
  const shard = artifactInPlay(state, 'shardOfYchlecht')
  const voyageMove = behavior.actions(state, inv).find(move => move.rule === 'sepulchreAlcove')
  assert.equal(behavior.performAction(state, inv, voyageMove, api), true)
  assert.equal(shard.doom >= 1, true)
})

// ---------------------------------------------------------------------------
// 9. 存档往返 / 投影
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 状态投影与 JSON 往返', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  spawnCthulhu(state, api)
  const saved = JSON.parse(JSON.stringify(state))
  assert.deepEqual(saved.scenarioFlags.disturbance, 0)
  assert.equal(saved.locations.length, 6)
  const summary = scenarioSummary(state)
  assert.equal(summary.artifacts.length, 5)
  assert.equal(summary.cthulhu.location, START_LOCATION)
  assert.equal(cthulhuDefeated(state), false)
  behavior.enemyDefeated(state, cthulhuInPlay(state), api)
  assert.equal(api.finished, 'resolution1')
})

// ---------------------------------------------------------------------------
// 10. 真实存档（lib/sessions.js saveSnapshot/readSnapshot）重放
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper saveReplay：saveSnapshot/readSnapshot 恢复等价且后续动作确定', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { saveSnapshot, readSnapshot, persistEnabled } = await import('../../../lib/sessions.js')
  const originalHome = process.env.DSH_HOME
  const originalPersist = process.env.BOARDGAME_PERSIST
  const home = mkdtempSync(join(tmpdir(), 'tdc-sepulchre-save-'))
  delete process.env.BOARDGAME_PERSIST
  process.env.DSH_HOME = home
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启路径')
    const sessionId = 'tdc-sepulchre-save-replay'
    const { state } = setup({ records, count: 2 })
    state.investigators.forEach(inv => { inv.location = 'sigilCarvedAlcoveAmbition'; inv.clues = 2 })
    const session = { sessionId, modId: 'arkhamhorror', state,
      players: state.investigators.map(inv => ({ seat: inv.seat, name: inv.name })),
      events: [], settings: { difficulty: 'standard' } }
    const file = saveSnapshot(session)
    assert.equal(typeof file, 'string')
    const restored = readSnapshot(sessionId)
    assert.ok(restored, `readSnapshot 未返回记录；磁盘文件：${file}`)
    const persisted = restored.session ?? restored
    const normalized = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalized(persisted.state), normalized(state), '读回状态与内存状态深度相等')
    const actOn = (target, api) => {
      const inv = target.investigators[0]
      inv.location = 'sigilCarvedAlcoveAmbition'
      inv.clues = 2
      return behavior.performAction(target, inv, { rule: 'sepulchreAlcove', locationId: 'sigilCarvedAlcoveAmbition' }, api)
    }
    const restoredApi = makeApi(persisted.state)
    const freshState = setup({ records, count: 2 }).state
    const freshApi = makeApi(freshState)
    freshState.investigators.forEach(inv => { inv.location = 'sigilCarvedAlcoveAmbition'; inv.clues = 2 })
    const fromSaved = actOn(persisted.state, restoredApi)
    const fromFresh = actOn(freshState, freshApi)
    assert.deepEqual(normalized(fromSaved), normalized(fromFresh), '恢复后动作与未存档同起点的动作结果一致')
    assert.deepEqual(normalized(persisted.state.investigators[0]), normalized(freshState.investigators[0]))
    assert.equal(persisted.modId, 'arkhamhorror')
    assert.equal(persisted.sessionId, sessionId)
  } finally {
    if (originalHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = originalHome
    if (originalPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = originalPersist
    rmSync(home, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 11. 内容侧收口（第二轮）
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 内容收口：梦者安息地失败扰动、克苏鲁躲避强制、壁龛毁灭走引擎入口', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  const inv = state.investigators[0]
  const other = state.investigators[1]
  // 11676 梦者安息地：本地点检定失败 → +1 扰动。
  inv.location = 'dreamersRest'
  const before = disturbance(state)
  assert.equal(behavior.afterTest(state, inv, { success: false }, api), true)
  assert.equal(disturbance(state), before + 1)
  inv.location = 'sigilCarvedAlcoveAmbition'
  assert.equal(behavior.afterTest(state, inv, { success: false }, api), false, '非本地点失败不加扰动')

  // 11674b 克苏鲁：被躲避后二选一。
  const cthulhu = spawnCthulhu(state, api)
  inv.location = 'dreamersRest'
  other.location = 'dreamersRest'
  api.choose = () => 'damage'
  const damageBefore = other.damage
  assert.equal(behavior.afterEvade(state, inv, cthulhu, null, api), true)
  assert.equal(other.damage, damageBefore + 1, '选择伤害：所在地点每位调查员 1 点直接伤害')
  api.choose = () => 'ready'
  cthulhu.exhausted = true
  assert.equal(behavior.afterEvade(state, inv, cthulhu, null, api), true)
  assert.equal(cthulhu.exhausted, false, '选择重整：横置状态解除')

  // 刻印壁龛：毁灭走引擎 placeDoomOnCard 读点（会触发 doomPlaced/替换拦截）。
  const placed = []
  api.placeDoomOnCard = (card, amount) => { placed.push([card.code, amount]); card.doom = (card.doom || 0) + amount }
  const artifact = artifactInPlay(state, 'obsidianClaw')
  inv.location = 'sigilCarvedAlcoveAmbition'
  other.location = 'sigilCarvedAlcoveAmbition'
  inv.clues = 2
  other.clues = 0
  api.test = (seat, skill, difficulty, resolve) => { resolve({ success: true, failedBy: 0 }) }
  api.choose = options => (options.prompt?.includes('额外') ? 'skip' : null)
  assert.equal(behavior.performAction(state, inv, { rule: 'sepulchreAlcove', locationId: 'sigilCarvedAlcoveAmbition' }, api), true)
  assert.deepEqual(placed, [[artifact.code, 1]])
  assert.equal(artifact.doom, 1)
})

// ---------------------------------------------------------------------------
// 12. 关键词覆盖（setEnemyKeywords 已落地）
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 无情关键词：生成同步 + 神器削弱本轮关闭', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  const cthulhu = spawnCthulhu(state, api)
  assert.equal(cthulhu.keywordOverrides.relentless.enabled, true, '生成时同步印刷无情')
  assert.equal(enemyHasAttackKeyword(state, cthulhu, 'relentless', true, () => null), true)
  const artifact = artifactInPlay(state, 'obsidianClaw')
  artifact.doom = 1
  assert.equal(weakenCthulhu(state, state.investigators[artifact.controllerSeat ?? 0], api), true)
  assert.equal(cthulhu.keywordOverrides.relentless.enabled, false, '本轮失去无情')
  assert.equal(enemyHasAttackKeyword(state, cthulhu, 'relentless', true, () => null), false)
  state.round += 1
  assert.equal(enemyKeywordOverride(state, cthulhu, 'relentless'), null)
  assert.equal(enemyHasAttackKeyword(state, cthulhu, 'relentless', true, () => null), true, '下一轮恢复无情')
  assert.equal(behavior.phaseBegan(state, 'mythos', api), true)
  assert.equal(behavior.phaseBegan(state, 'investigation', api), false)
})

// ---------------------------------------------------------------------------
// 13. 议程推进保留神器毁灭（doomKeptOnAgendaAdvance: 'storyAssets'）
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper 城市之下推进：神器毁灭保留、其他卡清空', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state, api } = setup({ records, count: 2 })
  // 声明键已注册（引擎 clearDoomInPlay 读点）。
  assert.equal(registeredEntry('11674').doomKeptOnAgendaAdvance, 'storyAssets')
  // 准备：两件神器上有毁灭；敌人/地点上也放毁灭（应被清空）。
  const claw = artifactInPlay(state, 'obsidianClaw')
  const node = artifactInPlay(state, 'barrierNode')
  claw.doom = 2
  node.doom = 1
  state.enemies.push({ id: 'e-doom', code: '11741', originalCode: '11741', name: '敌人', location: START_LOCATION, doom: 2, traits: [] })
  state.locations.find(location => location.id === START_LOCATION).doom = 1
  const agenda = state.agendas[state.agendaIndex]
  assert.equal(behavior.agendaAdvancing(state, agenda, api), true)
  assert.equal(state.scenarioFlags.sepulchreArtifactDoomBeforeAdvance.length, 2)
  // 模拟引擎 advanceAgenda 的 clearDoomInPlay：玩家资产/敌人/地点毁灭清空（神器快照在 behavior 里保留）。
  for (const inv of state.investigators) for (const asset of inv.assets || []) asset.doom = 0
  for (const enemy of state.enemies) enemy.doom = 0
  for (const location of state.locations) location.doom = 0
  // 议程背面结算：生成克苏鲁 + 回填神器毁灭。
  assert.equal(behavior.agendaReveal(state, agenda, api), true)
  assert.equal(claw.doom, 2, '黑曜石之爪上的 2 点毁灭保留')
  assert.equal(node.doom, 1, '屏障节点上的 1 点毁灭保留')
  assert.equal(state.enemies.find(enemy => enemy.id === 'e-doom').doom, 0, '敌人上的毁灭按规则清空')
  assert.equal(state.locations.find(location => location.id === START_LOCATION).doom, 0, '地点上的毁灭按规则清空')
  assert.equal(cthulhuInPlay(state)?.location, START_LOCATION)
  assert.equal(state.agendas.length, 2, '议程牌库为城市之下 → 克苏鲁苏醒（索引由引擎 advanceAgenda 递增）')
})

// ---------------------------------------------------------------------------
// 14. Good Money 跨章标记（content/campaigns/theDrownedCity/campaign-rules.js）
// ---------------------------------------------------------------------------
test('P7 sepulchreOfTheSleeper Good Money 跨章标记：命中时不获得补给资源、不匹配正常获得', () => {
  const records = Object.fromEntries(ARTIFACT_RECORD_KEYS.map(key => [key, true]))
  const { state } = setup({ records, count: 2 })
  state.campaign.scenarioIndex = 3
  state.campaign.ruleFlags = { tdcNoUpkeepResources: { originScenario: 'theGrandVault', seats: [0], appliesToScenarioIndex: 3 } }
  // phases.js 维护阶段补给读点：scenarioBehavior(state).canGainResources?.(state, inv) !== false 才 +supply。
  const supply = inv => { if (behavior.canGainResources(state, inv) !== false) inv.resources += 1; return inv.resources }
  const first = state.investigators[0]
  const second = state.investigators[1]
  const firstBefore = first.resources
  supply(first)
  assert.equal(first.resources, firstBefore, '命中（章节索引+座位）：不获得资源')
  const secondBefore = second.resources
  supply(second)
  assert.equal(second.resources, secondBefore + 1, '座位不匹配：正常获得资源')
  // 章节索引不匹配 → 不生效（stale 标记无害）。
  state.campaign.scenarioIndex = 4
  supply(first)
  assert.equal(first.resources, firstBefore + 1, '章节索引不匹配：正常获得资源')
  // 无标记 → 正常获得。
  delete state.campaign.ruleFlags.tdcNoUpkeepResources
  supply(first)
  assert.equal(first.resources, firstBefore + 2, '无标记：正常获得资源')
  assert.equal(behavior.canGainResources(state, first), true)
})
