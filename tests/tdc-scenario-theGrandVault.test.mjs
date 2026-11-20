// P7 大秘库（theGrandVault · 提示卡 11587）章节测试。
//
// 覆盖：模块 import / manifest 结构 / 12 个规则地点与 grid 坐标 / 幕 2 议程 3 与结局键 /
// 遭遇牌库与放一边守恒 / 随机秘库房间（8 候选移出 1 张异界机械）/ 底部一排淹没 / 供能分支
// （thePowerWasDiverted）/ 移动平台换位 / 幕 1 轮末目标与碑匾交付 / 封印腔室解封 /
// 秘库核心解封与幕间（theInnerSanctumWasUnsealed）/ 四档混乱标记 / 结局记录与 Good Money /
// JSON 存档往返。
//
// 本文件只对「受控剧情资产 / 引擎既有读点」的接线用例 import engine.js；
// 章节 behavior 的其余用例仍只走内容层函数与 P2/P7 原语（网格坐标用 mechanicState）。
import test from 'node:test'
import assert from 'node:assert/strict'
// 引导 import：先加载 mechanic-state，避免 engine/ability 与 card-rules 的初始化顺序回归（见 engine-needs 环境观察）。
import { mechanicState } from '../src/engine/mechanic-state.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { relocateEnemy, scenarioRuntime } from '../src/engine/engine.js'
import { enemyCanEnterLocation } from '../src/engine/enemy-entry.js'
import { changeFloodLevel, floodLevel } from '../src/engine/flood.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { fixture as engineFixture, legalMoves as engineLegalMoves, move as engineMove, settle as engineSettle } from './core-fixture.mjs'
import { assertScenarioManifest } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/index.js'
import {
  scenario, ACT_CODES, AGENDA_CODES, RESOLUTION_KEYS, LOCATIONS, LOCATION_IDS, LOCATION_CELLS,
  FIXED_LOCATION_IDS, CHAMBER_LOCATION_IDS, VAULT_POOL_IDS, VAULT_SLOT_CELLS, VAULT_BOTTOM_ROW_CELLS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, SET_ASIDE_ALIASES, STAR_SPAWN_ENEMY_CODES,
  STAR_SPAWN_REMOVED_COUNT, MECHANISM_IDS, TIDAL_TABLET_CODE, VAULT_ATTENDANT_CODE, GLYPH_RECORDS,
  GLYPH_RUNE_ORDER, GLYPH_RUNES_UNSEAL_THRESHOLD, VAULT_CORE_INTERLUDE, SCENARIO_TEXT, SETUP_STEPS,
  GOOD_MONEY_NEXT_SCENARIO_RESOURCES, encounterDefinitions,
} from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/definition.js'
import {
  behavior, prepareScenario, setupScenario, activatedIds,
  activateLocation, deactivateLocation, allVaultActivated, maybeRevealCore, swapPlatform,
  translateGlyph, maybeUnsealSealedChamber, translatedGlyphCount, glyphCardsInVictory,
  giveTidalTablet, tidalTabletControlledBy, vaultCoreInterlude, applyTokenEffect,
  resolveGoodMoney, resolution, moveError, enemyDefeated, enemyPhaseStart, spawnEnemy,
  removeStillBehindYouCopies, nearestFloodedToMovingPlatform, increaseFloodLevel, locationCannotFlood,
  spawnLocation as grandVaultSpawnLocation, enemySpawned, mostCluesInvestigator, nearestFloodedTo,
} from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/behavior.js'
import {
  grandVaultChaosToken, grandVaultChaosTokenValue, skullValue, tabletValue, activatedCount,
  isActivated as isActivatedBehavior, GRAND_VAULT_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, isHardSide,
} from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { readdirSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { saveSnapshot, readSnapshot, persistEnabled } from '../../../lib/sessions.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENTRY_DIR = resolve(HERE, '../src/cards/encounter-entries/theDrownedCity/theGrandVault')
const ENTRY_FILES = readdirSync(ENTRY_DIR).filter(name => name.endsWith('.js')).sort()
const ENTRIES = []
for (const name of ENTRY_FILES) ENTRIES.push((await import(`file:///${ENTRY_DIR.replace(/\\/g, '/')}/${name}`)).default)
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, records = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [], actIndex: 0, agendaIndex: 0,
})
const stateWithScenario = (count = 1, records = {}) => {
  const state = stateFor(count, records)
  state.scenario = clone(scenario)
  return state
}
const makeApi = (state, options = {}) => {
  let serial = 0
  const api = {
    state, info: () => {}, finished: null, presented: [], testResults: [], choices: [],
    choose: options.choose || (() => null),
    random: options.random || (() => 0.5),
    shuffle: options.shuffle || (list => [...list]),
    testResult: options.testResult || { success: false, failedBy: 1 },
    present: (_text, meta) => api.presented.push(meta),
    test(seat, skill, difficulty, resolve) {
      const result = typeof api.testResult === 'function' ? api.testResult(seat, skill, difficulty) : api.testResult
      api.lastTest = { seat, skill, difficulty, result }
      api.testResults.push(api.lastTest)
      resolve?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    gainClues(seat, amount = 1) { state.investigators[seat].clues += amount },
    spendResources(seat, amount = 1) { state.investigators[seat].resources -= amount },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    addScenarioXpBonus(seat, amount = 1) { state.investigators[seat].scenarioXpBonus = (Number(state.investigators[seat].scenarioXpBonus) || 0) + amount },
    defeat(inv) { inv.defeated = true },
    finish(key) { api.finished = key },
    advanceAct() {
      const act = state.acts[state.actIndex]
      behavior.actReveal(state, act, api)
      state.actIndex += 1
    },
    spawn(code, locationId, extra = {}) {
      serial += 1
      const enemy = { id: `${code}-${serial}`, code, originalCode: code, name: code, location: locationId,
        fight: 0, evade: 0, health: 1, damage: 0, horror: 0, traits: [], exhausted: extra.exhausted === true,
        engagedSeat: extra.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0, attachments: [], victory: 0 }
      state.enemies.push(enemy)
      return enemy
    },
    giveAsset(seat, code) {
      const asset = { id: `asset-${code}-${seat}`, code, originalCode: code, name: code, controllerSeat: seat,
        ownerSeat: seat, exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [], assets: [] }
      state.investigators[seat].assets.push(asset)
      return asset
    },
    addStoryToVictory(code, extra = {}) {
      if (!state.victoryDisplay.some(entry => entry.code === code)) {
        state.victoryDisplay.push({ id: extra.sourceId || code, code, originalCode: code,
          name: code, victory: Number(ALL_CARDS[code]?.victory) || 1 })
      }
      return true
    },
    attachEncounterToLocation(code, locationId) {
      const loc = state.locations.find(item => item.id === locationId)
      if (!loc) return false
      loc.attachments ||= []
      loc.attachments.push({ code, originalCode: code, name: code })
      return true
    },
    moveInvestigator(seat, destination) { state.investigators[seat].location = destination },
    reveal(id) {
      const location = state.locations.find(item => item.id === id)
      if (!location) return false
      location.revealed = true
      return true
    },
    moveEnemyToward(enemy, destination) { enemy.location = destination; return true },
    moveEnemy(enemy, destination) { enemy.location = destination; return true },
    attack(enemy, inv) { (api.attacks ||= []).push([enemy.id, inv?.seat]); return true },
    engage(enemy, seat) { enemy.engagedSeat = seat; return true },
  }
  api.mechanics = {
    progress: { forSeat: (track, seat) => (options.progress || {})[`${track}:${seat}`] || null },
    startingAdjustments: { defer: (seat, spec) => { (state.deferredAdjustments ||= []).push({ seat, ...spec }) } },
  }
  return api
}
const setup = (count = 1, records = {}, options = {}) => {
  const state = stateWithScenario(count, records)
  const api = makeApi(state, options)
  behavior.setupScenario(state, api)
  return { state, api }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id) || null
const gridOf = (state, id) => mechanicState(state).grid?.[id] || null
const cardCount = codes => codes.reduce((total, code) => {
  const list = Array.isArray(code) ? code : [code]
  return total + list.length
}, 0)

// ---------------------------------------------------------------------------
// 1. 结构 / manifest
// ---------------------------------------------------------------------------
test('P7 theGrandVault 结构：26 条目、12 规则地点、2 幕 3 议程、development manifest', () => {
  assert.equal(chapter.scenario.id, 'theGrandVault')
  assert.equal(chapter.scenario.referenceCode, '11587')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.doesNotThrow(() => assertScenarioManifest(chapter.manifest))
  assert.equal(chapter.manifest.locations.length, 12)
  assert.equal(LOCATION_IDS.length, 12)
  assert.deepEqual([...ACT_CODES], ['11591', '11592'])
  assert.deepEqual([...AGENDA_CODES], ['11588', '11589', '11590'])
  assert.equal(scenario.acts.length, 2)
  assert.equal(scenario.agendas.length, 3)
  assert.deepEqual(Object.keys(scenario.resolutions), [...RESOLUTION_KEYS])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.implementedEncounterCodes.length, 26)
  assert.equal(ENTRIES.length, 26)
  assert.equal(new Set(ENTRIES.map(entry => entry.code)).size, 26)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [...chapter.implementedEncounterCodes].sort())
  for (const entry of ENTRIES) {
    assert.equal(entry.code, entry.code.trim())
    assert.equal(ENTRY_FILES.includes(`${entry.code}.js`), true, `${entry.code}.js 与 code 一致`)
  }
  assert.deepEqual([...GATHER_GROUPS], ['theGrandVault', 'alienMachinery', 'tdcFlood', 'theInescapable', 'rlyeh', 'starSpawn'])
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds].sort(), [...GATHER_GROUPS].sort())
  assert.equal(SCENARIO_TEXT.textLanguage, 'en')
  assert.ok(SCENARIO_TEXT.setup.length > 0)
  assert.equal(SETUP_STEPS.length, 15)
  assert.equal(Object.keys(SCENARIO_TEXT.introBranches).length, 3)
  assert.equal(chapter.manifest.vaultChamberDeck.inPlayCount, 7)
  assert.equal(chapter.manifest.vaultChamberDeck.removedCount, 1)
  assert.equal(chapter.manifest.starSpawnHandling.removedCount, STAR_SPAWN_REMOVED_COUNT)
})

test('P7 theGrandVault 地点与 layout：4 固定 + 8 候选、网格坐标、展示坐标覆盖全部地点', () => {
  assert.equal(FIXED_LOCATION_IDS.length, 4)
  assert.equal(CHAMBER_LOCATION_IDS.length, 8)
  assert.equal(VAULT_POOL_IDS.length, 8)
  assert.equal(VAULT_SLOT_CELLS.length, 7)
  assert.deepEqual(LOCATION_CELLS.theGreatStair, { x: -2, y: 0 })
  assert.deepEqual(LOCATION_CELLS.movingPlatform, { x: -1, y: 0 })
  assert.deepEqual(LOCATION_CELLS.coreOfTheVault, { x: 0, y: 0 })
  assert.deepEqual(LOCATION_CELLS.chamberOfTheTablet, { x: 2, y: 0 })
  assert.deepEqual([...VAULT_BOTTOM_ROW_CELLS], [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }])
  for (const id of LOCATION_IDS) {
    assert.ok(chapter.layout.locations[id], `layout 覆盖 ${id}`)
  }
  assert.equal(chapter.layout.edges.length, 0, '印刷没有连接图标数据：展示层不创建规则连接')
  const report = scenarioZoneReport(scenario, chapter.manifest)
  assert.equal(report.locationCount, 12)
  assert.equal(report.unresolvedAliases.length, 0)
})

// ---------------------------------------------------------------------------
// 2. 遭遇牌库 / 放一边守恒
// ---------------------------------------------------------------------------
test('P7 theGrandVault 遭遇牌库：固定 6 组、放一边 15 张、Star Spawn 2 张移出', () => {
  assert.equal(ENCOUNTER_DECK.length, 19)
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11607').length, 3)
  assert.equal(ENCOUNTER_DECK.filter(code => code === VAULT_ATTENDANT_CODE).length, 0, '秘库随从放一边')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11751').length, 3, '持久构造体 ×3')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '11745').length, 0, 'The Inescapable 组放一边')
  const groupDeck = Object.entries(ALL_CARDS)
    .filter(([, card]) => GATHER_GROUPS.map(group => group.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()).includes(card.encounterCode))
    .filter(([, card]) => ['enemy', 'treachery', 'asset'].includes(card.type))
    .flatMap(([code, card]) => Array(Math.max(1, Number(card.quantity) || 1)).fill(code))
  const declared = chapter.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0)
    + chapter.manifest.zones.setAside.reduce((sum, entry) => sum + entry.count, 0)
  assert.equal(declared, groupDeck.length, '牌库 + 放一边 = 组内全部可入牌库卡（Star Spawn 全部在放一边区声明）')
  const sideCodes = chapter.manifest.zones.setAside.map(entry => entry.cardCode)
  assert.deepEqual(sideCodes.sort(), [...new Set(SET_ASIDE_ALIASES)].sort())
  const { state } = setup(1)
  const zones = state.scenarioZones
  assert.equal(zones.setAside.length, SET_ASIDE_ALIASES.length - STAR_SPAWN_REMOVED_COUNT)
  assert.equal(zones.removed.length, STAR_SPAWN_REMOVED_COUNT)
  assert.deepEqual([...zones.removed, ...zones.setAside.filter(code => STAR_SPAWN_ENEMY_CODES.includes(code))].sort(),
    [...STAR_SPAWN_ENEMY_CODES].sort())
})

// ---------------------------------------------------------------------------
// 3. 布置 / 随机秘库房间 / 淹没 / 供能分支
// ---------------------------------------------------------------------------
test('P7 theGrandVault 布置：11 处地点入场，7 张秘库房间随机填充剩余槽位，底部一排部分淹没', () => {
  const { state } = setup(1)
  assert.equal(state.locations.length, 11)
  for (const id of FIXED_LOCATION_IDS) assert.ok(locationOf(state, id), `固定地点 ${id} 入场`)
  const chambers = LOCATION_IDS.filter(id => CHAMBER_LOCATION_IDS.includes(id) && locationOf(state, id))
  assert.equal(chambers.length, 7)
  for (const id of MECHANISM_IDS.filter(id => !chambers.includes(id))) {
    assert.equal(locationOf(state, id), null, '随机移出的 1 张异界机械不入场')
  }
  const occupied = chambers.map(id => gridOf(state, id)).map(cell => `${cell.x},${cell.y}`).sort()
  assert.deepEqual(occupied, [...VAULT_SLOT_CELLS].map(cell => `${cell.x},${cell.y}`).sort())
  for (const cell of VAULT_BOTTOM_ROW_CELLS) {
    const id = behavior.locationIdAtCell(state, cell)
    assert.ok(id, `底部一排 (${cell.x},${cell.y}) 有腔室`)
    assert.equal(mechanicState(state).flood[id], 1, '底部一排初始部分淹没')
  }
  // 正交网格邻接：移动平台与相邻地点相连（近似：印刷连接图标按正交邻接处理）。
  const platform = locationOf(state, 'movingPlatform')
  assert.ok(platform.connections.includes('theGreatStair'))
  assert.ok(platform.connections.includes('coreOfTheVault'))
  // 供能分支：默认激活左下/右下/右上三处。
  assert.equal(activatedIds(state).length, 3)
})

test('P7 theGrandVault 供能分支：thePowerWasDiverted 时只激活左下腔室', () => {
  const { state, api } = setup(1, { thePowerWasDiverted: true })
  assert.deepEqual(activatedIds(state), [behavior.locationIdAtCell(state, { x: -1, y: -1 })])
  const report = prepareScenario(state, api)
  assert.equal(report.powerWasDiverted, true)
  assert.equal(report.introBranch, 'grandVault1')
  assert.equal(api.finished, null)
})

test('P7 theGrandVault 激活账本：激活/失活经 scenarioFlags 记录，秘库核心在全部秘库激活后解封', () => {
  const { state, api } = setup(1)
  const core = locationOf(state, 'coreOfTheVault')
  assert.equal(core.revealed, false, '秘库核心初始未揭示')
  const chamber = locationOf(state, behavior.locationIdAtCell(state, { x: 0, y: 1 }))
  for (const vault of state.locations.filter(loc => loc.traits.includes('Vault'))) {
    if (!isActivatedBehavior(state, vault.id)) activateLocation(state, vault.id, api)
  }
  assert.equal(allVaultActivated(state), true)
  assert.equal(activatedCount(state), 7, '7 张秘库房间（碑匾腔室没有[[秘库]]特性）')
  maybeRevealCore(state, api)
  assert.equal(locationOf(state, 'coreOfTheVault').revealed, true, '每处[[秘库]]激活后揭示核心')
  deactivateLocation(state, chamber.id, api)
  assert.equal(allVaultActivated(state), false)
})

// ---------------------------------------------------------------------------
// 4. 移动平台换位
// ---------------------------------------------------------------------------
test('P7 theGrandVault 移动平台：共同花费线索后与相邻[[秘库]]交换网格位置并重算连接', () => {
  const { state, api } = setup(2)
  const platform = locationOf(state, 'movingPlatform')
  state.investigators[0].location = 'movingPlatform'
  state.investigators[1].location = 'movingPlatform'
  state.investigators[0].clues = 1
  state.investigators[1].clues = 1
  const target = locationOf(state, 'movingPlatform').connections
    .map(id => locationOf(state, id)).find(loc => loc && loc.traits.includes('Vault'))
  assert.ok(target)
  const targetCell = { ...gridOf(state, target.id) }
  const platformCell = { ...gridOf(state, 'movingPlatform') }
  const moved = swapPlatform(state, state.investigators[0], { targets: [{ id: target.id }] }, api)
  assert.equal(moved, true)
  assert.deepEqual({ ...gridOf(state, 'movingPlatform') }, targetCell)
  assert.deepEqual(gridOf(state, target.id), platformCell)
  assert.equal(state.investigators[0].clues, 0, '线索被共同支付')
  assert.ok(locationOf(state, 'movingPlatform').connections.length >= 1, '换位后仍与相邻地点相连')
})

// ---------------------------------------------------------------------------
// 5. 符文 / 封印腔室 / 碑匾 / 内殿
// ---------------------------------------------------------------------------
test('P7 theGrandVault 符文：翻译 3 个符文揭示封印腔室；地点符文走地点胜利、秘库翻面剧情卡进胜利区', () => {
  const { state, api } = setup(1)
  const chamber = locationOf(state, 'chamberOfTheTablet')
  assert.equal(chamber.revealed, false)
  assert.equal(translateGlyph(state, '11598', api), true)
  assert.equal(translateGlyph(state, '11599', api), true)
  assert.equal(chamber.revealed, false, '2 个符文还不够')
  assert.equal(translateGlyph(state, '11608', api), true)
  assert.equal(translatedGlyphCount(state), 3)
  assert.equal(chamber.revealed, true, '翻译 3 个符文后揭示封印腔室')
  assert.deepEqual(chamber.name, '碑匾腔室')
  // 第二轮修正后的胜利区口径：档案室 11598/11599 是地点，胜利点走引擎地点胜利计数，
  // 不再往 victoryDisplay 补故事卡；古代秘库翻面后的 11608b 是剧情卡，加入胜利区。
  assert.equal(glyphCardsInVictory(state).length, 1)
  assert.equal(glyphCardsInVictory(state)[0].code, '11608b')
  assert.equal(translateGlyph(state, '11608', api), false, '同一符文不重复记录')
})

test('P7 theGrandVault 碑匾：碑匾腔室最后一个线索后发现并交付潮汐碑匾', () => {
  const { state, api } = setup(1)
  const chamber = locationOf(state, 'chamberOfTheTablet')
  chamber.revealed = true
  chamber.clues = 0
  chamber.maxClues = 0
  state.investigators[0].location = 'chamberOfTheTablet'
  const handled = behavior.afterInvestigate(state, state.investigators[0], chamber, { success: true }, api)
  assert.equal(handled, true)
  assert.ok(tidalTabletControlledBy(state))
  assert.equal(state.scenarioZones.setAside.includes(TIDAL_TABLET_CODE), false, '碑匾离开放一边区')
  assert.equal(behavior.afterInvestigate(state, state.investigators[0], chamber, { success: true }, api), false, '一次性')
})

test('P7 theGrandVault 幕间「秘库核心」：共同花费 3[per] 线索，按键记录 theInnerSanctumWasUnsealed', () => {
  const { state, api } = setup(1)
  const core = locationOf(state, 'coreOfTheVault')
  core.revealed = true
  state.investigators[0].location = 'coreOfTheVault'
  state.investigators[0].clues = VAULT_CORE_INTERLUDE.clueCostPerInvestigator
  api.choose = () => 'pushTheButton'
  assert.equal(vaultCoreInterlude(state, state.investigators[0], api), true)
  assert.equal(state.campaign.records.theInnerSanctumWasUnsealed, true)
  assert.equal(state.investigators[0].clues, 0)
  // 不碰它：每位调查员 1 点奖励经验。
  const second = setup(1)
  const core2 = locationOf(second.state, 'coreOfTheVault')
  core2.revealed = true
  second.state.investigators[0].location = 'coreOfTheVault'
  second.state.investigators[0].clues = 3
  second.api.choose = () => 'leaveItAlone'
  assert.equal(vaultCoreInterlude(second.state, second.state.investigators[0], second.api), true)
  assert.equal(second.state.investigators[0].scenarioXpBonus, 1)
})

// ---------------------------------------------------------------------------
// 6. 幕 / 议程
// ---------------------------------------------------------------------------
test('P7 theGrandVault 幕 1：轮末且控制潮汐碑匾时推进；幕 2 全员撤退推进并进入结局', () => {
  const { state, api } = setup(2, { theExpeditionHeadedWest: true })
  state.investigators[0].location = 'chamberOfTheTablet'
  // 幕 1 目标需要「控制潮汐碑匾」。
  state.agendas[1].face = 'front'
  giveTidalTablet(state, 0, api)
  const advanced = behavior.roundEnded(state, api)
  assert.equal(advanced, true)
  assert.equal(state.actIndex, 1, '幕 1 推进到幕 2')
  // 幕 2：全员撤退后推进 → 幕 2 背面按路线进入结局 1。
  for (const inv of state.investigators) inv.resigned = true
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(api.finished, 'resolution1')
  assert.equal(state.actIndex, 2)
})

test('P7 theGrandVault 议程背面：议程 1 生成穷途异魔，议程 3 全体被击败', () => {
  const { state, api } = setup(2)
  state.investigators[0].location = 'theGreatStair'
  state.campaign.leadSeat = 0
  state.encounterDeck = ['11607', '11745', '11745', '11745']
  state.encounterDiscard = ['11745']
  assert.equal(behavior.agendaReveal(state, state.agendas[0], api), true)
  const spawned = state.enemies.find(enemy => String(enemy.originalCode || enemy.code) === '11744')
  assert.ok(spawned, '穷途异魔生成在队长所在地')
  assert.equal(spawned.location, 'theGreatStair')
  assert.equal(state.encounterDiscard.length, 0, '遭遇弃牌堆洗回牌库')
  // 议程 3 背面：每位未撤退的存活调查员被击败并 1 点肉体创伤。
  behavior.agendaReveal(state, state.agendas[2], api)
  assert.equal(state.investigators.every(inv => inv.defeated), true)
  assert.equal(state.campaign.trauma[0].physical, 1)
})

// ---------------------------------------------------------------------------
// 7. 混乱标记
// ---------------------------------------------------------------------------
test('P8 11587 困难邪教徒等到检定结算后，忽略符号时不触发', () => {
  const state = stateFor()
  state.difficulty = 'hard'
  const inv = state.investigators[0]
  const damage = inv.damage
  const horror = inv.horror
  const api = { choose: () => 'damage' }
  assert.deepEqual(grandVaultChaosToken(state, inv, 'cultist').onDraw, [])
  behavior.afterTest(state, inv, { success: true }, api, { resolvedTokens: ['cultist'], ignoredSymbols: true })
  assert.equal(inv.damage, damage)
  behavior.afterTest(state, inv, { success: true }, api, { resolvedTokens: ['cultist'] })
  assert.equal(inv.damage, damage + 1)
  assert.equal(inv.horror, horror + 1)
})

test('P7 theGrandVault 混乱标记：四档取值（含淹没加成/已激活数量）与 [cultist]/[elder_thing] 追加效果', () => {
  const { state, api } = setup(2)
  state.investigators[0].location = 'theGreatStair'
  activateLocation(state, behavior.locationIdAtCell(state, { x: 0, y: -1 }), api)
  assert.equal(activatedCount(state), 4)
  assert.equal(skullValue(state), 2, '简单/普通：4 的一半向下取整')
  assert.equal(grandVaultChaosTokenValue(state, 'skull'), -2)
  state.difficulty = 'hard'
  assert.equal(isHardSide(state), true)
  assert.equal(skullValue(state), 4, '困难/专家：不折半')
  assert.equal(grandVaultChaosTokenValue(state, 'cultist'), -4)
  state.difficulty = 'standard'
  const flooded = behavior.locationIdAtCell(state, { x: 0, y: -1 })
  state.investigators[0].location = flooded
  assert.equal(tabletValue(state, state.investigators[0]), -3, '部分淹没 -3')
  mechanicState(state, true).flood[flooded] = 2
  assert.equal(tabletValue(state, state.investigators[0]), -4, '完全淹没 -4')
  assert.deepEqual(grandVaultChaosToken(state, state.investigators[0], 'cultist').onFail[0].mode, 'deactivateOrHarm')
  assert.deepEqual(grandVaultChaosToken(state, state.investigators[0], 'elderthing').onFail[0].mode, 'searchStillBehindYou')
  // [cultist]：选择使地点失活。
  api.choose = () => 'deactivate'
  assert.equal(applyTokenEffect(state, state.investigators[0], { token: 'cultist', mode: 'deactivateOrHarm' }, api), true)
  assert.equal(isActivatedBehavior(state, flooded), false, '所在地点失活')
  // [elder_thing]：把「仍在你身后」加入胜利区。
  state.encounterDiscard = ['11745']
  assert.equal(applyTokenEffect(state, state.investigators[0], { token: 'elderthing', mode: 'searchStillBehindYou' }, api), true)
  assert.equal(state.victoryDisplay.some(entry => entry.code === '11745'), true)
  for (const face of CHAOS_TOKEN_FACES) assert.ok(GRAND_VAULT_TOKEN_MEANINGS.standard[face])
  assert.equal(CHAOS_TOKEN_FACES.length, 4)
})

// ---------------------------------------------------------------------------
// 8. 结局 / 记录 / 存档往返
// ---------------------------------------------------------------------------
test('P7 theGrandVault 结局：R\'lyeh 地图、Tidal Tablet、Good Money 下一章起始资源', () => {
  const { state, api } = setup(1, { theExpeditionHeadedWest: false }, {
    // P7 原语口径：轨道 'tdcTask'，任务身份在 entry.option。
    progress: { 'tdcTask:0': { option: 'goodMoney', value: 1 } },
  })
  state.investigators[0].location = 'theGreatStair'
  giveTidalTablet(state, 0, api)
  api.choose = () => 'playItSafe'
  const result = resolution(state, 'resolution2', [], api)
  assert.deepEqual(result, { award: true })
  assert.deepEqual(state.campaign.records.rlyehMap, ['theGrandVault'])
  assert.equal(state.campaign.records.tidalTablet, true)
  assert.equal(state.deferredAdjustments.length, 1)
  assert.equal(state.deferredAdjustments[0].resources, GOOD_MONEY_NEXT_SCENARIO_RESOURCES)
  assert.equal(state.deferredAdjustments[0].seat, 0)
  // 两头下注：没有引擎读点，记 scenarioFlags 并写入原语请求（见报告）。
  const both = setup(1, {}, { progress: { 'tdcTask:0': { option: 'goodMoney', value: 2 } } })
  both.api.choose = () => 'playBothSides'
  resolveGoodMoney(both.state, both.api)
  assert.equal(both.state.scenarioFlags['grandVaultGoodMoneyBothSides:0'], true)
})

test('P7 theGrandVault JSON 存档往返：网格 / 激活账本 / 符文 / 放一边保持', () => {
  const { state, api } = setup(2)
  translateGlyph(state, '11598', api)
  const saved = clone(state)
  assert.deepEqual(saved.campaign.records.discoveredGlyphs, ['rune_l'])
  assert.deepEqual(activatedIds(saved), activatedIds(state))
  assert.deepEqual(Object.keys(mechanicState(saved).grid).sort(), Object.keys(mechanicState(state).grid).sort())
  assert.deepEqual(saved.scenarioZones.setAside, state.scenarioZones.setAside)
  assert.equal(saved.investigators[0].location, 'theGreatStair')
})

// ---------------------------------------------------------------------------
// 9. 第二轮：未揭示封锁 / 内殿强制 / 11605 敌军阶段（内容侧收口）
// ---------------------------------------------------------------------------
test('P7 theGrandVault 未揭示封锁与内殿强制：不能进入核心/封印腔室；穷途异魔在核心被击败记录并移出「仍在你身后」', () => {
  const { state, api } = setup(1)
  const core = locationOf(state, 'coreOfTheVault')
  const sealed = locationOf(state, 'chamberOfTheTablet')
  assert.match(moveError(state, state.investigators[0], core), /尚未揭示/)
  assert.match(moveError(state, state.investigators[0], sealed), /尚未揭示/)
  assert.equal(moveError(state, state.investigators[0], locationOf(state, 'theGreatStair')), null)
  core.revealed = true
  assert.equal(moveError(state, state.investigators[0], core), null)
  // 穷途异魔在核心被击败：移出全部「仍在你身后」（11745）并记录 theCreatureWasDefeated。
  const inescapable = spawnEnemy(state, '11744', core.id, api)
  state.encounterDeck.push('11745')
  state.encounterDiscard.push('11745', '11607')
  state.scenarioZones.setAside = [...(state.scenarioZones.setAside || []), '11745']
  state.removedFromGame = ['11745']
  state.investigators[0].threat = [{ code: '11745', originalCode: '11745' }]
  core.attachments = [{ code: '11745', originalCode: '11745' }]
  assert.equal(enemyDefeated(state, inescapable, api), false, '不替换击败去向（敌人仍按常规结算）')
  assert.equal(state.campaign.records.theCreatureWasDefeated, true)
  assert.equal(state.encounterDeck.includes('11745'), false)
  assert.equal(state.encounterDiscard.includes('11745'), false)
  assert.equal(state.encounterDiscard.includes('11607'), true, '其它遭遇卡不动')
  assert.equal(state.scenarioZones.setAside.includes('11745'), false)
  assert.equal(state.removedFromGame.includes('11745'), false)
  assert.equal(state.investigators[0].threat.length, 0)
  assert.equal(core.attachments.length, 0)
  // 不在核心 / 未揭示 / 非穷途异魔时都不触发。
  const other = spawnEnemy(state, '11744', 'movingPlatform', api)
  assert.equal(enemyDefeated(state, other, api), false, '不在核心的穷途异魔不触发内殿强制')
  assert.equal(removeStillBehindYouCopies(state).length, 0, '没有可移出的「仍在你身后」')
})

test('P7 theGrandVault 11605 敌军阶段：攻击连接地点[战斗]最低调查员，否则移动到最近移动平台的淹没地点', () => {
  const { state, api } = setup(2)
  // 场景 1：连接地点有调查员 → 攻击最低[战斗]者。
  const slitherer = spawnEnemy(state, '11605', 'theGreatStair', api)
  state.investigators[0].location = 'movingPlatform'
  state.investigators[0].combat = 4
  state.investigators[1].location = 'movingPlatform'
  state.investigators[1].combat = 2
  assert.equal(enemyPhaseStart(state, api), true)
  assert.deepEqual(api.attacks.at(-1), [slitherer.id, 1], '攻击位于连接地点的最低[战斗]调查员')
  // 场景 2：连接地点没有调查员 → 移动到距离移动平台最近的淹没地点。
  for (const inv of state.investigators) inv.location = 'chamberOfTheTablet'
  slitherer.location = 'theGreatStair'
  api.attacks = []
  assert.equal(enemyPhaseStart(state, api), true)
  assert.equal(api.attacks.length, 0)
  assert.notEqual(slitherer.location, 'theGreatStair')
  assert.ok(mechanicState(state).flood?.[slitherer.location] > 0, '移动目标必须是淹没地点')
  assert.ok(nearestFloodedToMovingPlatform(state, 'theGreatStair'))
})

// ---------------------------------------------------------------------------
// 10. 第二轮：生成落点（PRIMITIVES.md 已落地的 scenarioBehavior.spawnLocation 既有读点）
// ---------------------------------------------------------------------------
test('P7 theGrandVault 生成落点：11605 最近的淹没地点、11606 与猎物交战', () => {
  const { state, api } = setup(2)
  // 11605：默认布置把底部一排腔室提高为部分淹没 → 生成落点 = 距离抽牌者最近的淹没地点。
  state.investigators[0].location = 'theGreatStair'
  const picked = grandVaultSpawnLocation(state, '11605', 'theGreatStair', 0, api)
  assert.notEqual(picked, 'theGreatStair')
  assert.ok(mechanicState(state).flood?.[picked] > 0, '11605 生成在淹没地点')
  assert.equal(picked, nearestFloodedTo(state, 'theGreatStair'), '生成点 = 最近的淹没地点')
  // 没有淹没地点时回退默认落点。
  const noFlood = setup(2)
  mechanicState(noFlood.state, true).flood = {}
  assert.equal(grandVaultSpawnLocation(noFlood.state, '11605', 'theGreatStair', 0, noFlood.api), 'theGreatStair')
  // 11606：生成落点 = 猎物（线索最多者）所在地点，生成后与猎物交战。
  state.investigators[0].location = 'movingPlatform'
  state.investigators[0].clues = 3
  state.investigators[1].location = 'theGreatStair'
  state.investigators[1].clues = 1
  assert.equal(mostCluesInvestigator(state).seat, 0)
  const preyLocation = grandVaultSpawnLocation(state, '11606', 'theGreatStair', 0, api)
  assert.equal(preyLocation, 'movingPlatform', '生成落点 = 猎物所在地点')
  const attendant = spawnEnemy(state, '11606', preyLocation, api)
  assert.equal(enemySpawned(state, attendant, api), true)
  assert.equal(attendant.engagedSeat, 0, '生成 - 与猎物（线索最多者）交战')
  // 其它卡号不改换落点。
  assert.equal(grandVaultSpawnLocation(state, '11607', 'theGreatStair', 0, api), 'theGreatStair')
})

// ---------------------------------------------------------------------------
// 11. 第二轮：literal 账本证据（26 张条目的印刷关键子句断言）
// ---------------------------------------------------------------------------
test('P7 theGrandVault literal 覆盖：26 张条目的印刷关键子句断言', () => {
  assert.equal(ENTRIES.length, 26)
  const byCode = Object.fromEntries(ENTRIES.map(entry => [entry.code, entry]))
  for (const code of chapter.implementedEncounterCodes) assert.ok(byCode[code], `缺少条目 ${code}`)
  // 议程：生命修正 / 猎手相邻 / 全体击败均取 definition/behavior。
  assert.equal(chapter.scenario.stageCards['11589'].inescapableHealthPerInvestigator, 1)
  assert.equal(chapter.scenario.stageCards['11590'].inescapableHealthPerInvestigator, 2)
  assert.equal(chapter.scenario.stageCards['11589'].inescapableHunterAdjacent, true)
  // 幕：3 符文解封 / 撤离目标 / 碑匾目标。
  assert.equal(chapter.scenario.stageCards['11591'].translateGlyphs, 3)
  assert.equal(registeredEntry('11591').flags.unsealAtGlyphs, 3)
  assert.equal(registeredEntry('11592').flags.resignedObjective, true)
  // 地点：不可淹没（floodBounds.max=0）/ 可激活费用 / 符文房间 / 连接规则。
  for (const code of ['11593', '11594', '11595', '11604']) {
    assert.deepEqual(registeredEntry(code).locationRule.floodBounds, { max: 0 })
  }
  assert.deepEqual(registeredEntry('11596').locationRule.floodBounds, { min: 1 })
  assert.equal(registeredEntry('11596').locationRule.cannotDecreaseFlood, true, '第六轮：11596 淹没不能降低声明')
  assert.equal(typeof behavior.decreaseFloodLevel, 'function', '第六轮：11596 behavior 侧拒绝降低读点')
  assert.equal(registeredEntry('11593').flags.resign, true)
  assert.equal(registeredEntry('11594').flags.swapPlatform, true)
  assert.equal(registeredEntry('11595').flags.vaultCoreInterlude, true)
  assert.equal(registeredEntry('11596').flags.activationCost, 'cistern')
  assert.equal(registeredEntry('11598').flags.glyphChamber, true)
  assert.equal(registeredEntry('11599').flags.glyphChamber, true)
  assert.deepEqual(['11600', '11601', '11602', '11603'].map(code => registeredEntry(code).flags.activationCost),
    ['discard3', 'damageHorror', 'resources5', 'revealTop3'])
  for (const code of ['11600', '11601', '11602', '11603']) assert.equal(registeredEntry(code).flags.revealGlyphTreachery, true)
  assert.equal(registeredEntry('11604').flags.unsealAtGlyphs, 3)
  // 敌人：生成/关键词声明 + 被击败强制。
  assert.equal(registeredEntry('11605').flags.spawnNearestFlooded, true)
  assert.deepEqual(registeredEntry('11605').enemyRule, { enterOnlyFlooded: true }, '第五轮：enemyRule.enterOnlyFlooded')
  assert.equal(registeredEntry('11606').flags.hunter, true)
  assert.equal(registeredEntry('11606').flags.prey, 'mostClues')
  assert.equal(typeof behavior.enemyConnections, 'function', '第五轮：11606 猎手连接钩子')
  assert.equal(typeof behavior.hiddenValueOf, 'function', '第五轮：11608-10 隐藏值读点')
  assert.equal(typeof behavior.translateAncientVaultAction, 'function', '第五轮：11608-10 翻译行动')
  // 诡计：致命机械检定 / 3 张古代秘库附属 + 3 张背面剧情卡 / 潮汐碑匾。
  assert.deepEqual(registeredEntry('11607').flags.test, { skill: 'willpower', difficulty: 3 })
  assert.equal(typeof registeredEntry('11607').encounterResolve, 'function')
  for (const code of ['11608', '11609', '11610']) {
    assert.equal(registeredEntry(code).flags.ancientVault, true)
    assert.equal(typeof registeredEntry(code).encounterResolve, 'function')
  }
  for (const code of ['11608b', '11609b', '11610b']) assert.ok(registeredEntry(code).flags.glyphBack)
  assert.equal(registeredEntry('11611').flags.tidalTablet, true)
  // 第三轮：受控剧情资产 [reaction]/[fast] 已声明（controlledAsset 允许 action/free）。
  assert.equal(registeredEntry('11611').controlledAsset, true)
  assert.equal(registeredEntry('11611').abilities.length, 2)
  assert.deepEqual(registeredEntry('11611').abilities.map(ability => ability.kind).sort(), ['free', 'reaction'])
  // 符文记录表覆盖全部 5 个符文。
  assert.deepEqual(GLYPH_RUNE_ORDER, ['rune_l', 'rune_m', 'rune_n', 'rune_o', 'rune_p'])
  assert.deepEqual(Object.keys(GLYPH_RECORDS).sort(), ['11598', '11599', '11608', '11609', '11610'])
  // 行为入口存在（内容侧收口的读点）。
  for (const hook of ['moveError', 'enemyDefeated', 'enemyPhaseStart', 'spawnLocation', 'enemySpawned', 'canGainResources', 'actions', 'performAction', 'resolution']) {
    assert.equal(typeof behavior[hook], 'function', `behavior.${hook}`)
  }
})

// ---------------------------------------------------------------------------
// 11. 第二轮：真实 saveSnapshot/readSnapshot 存档重放
// ---------------------------------------------------------------------------
test('P7 theGrandVault saveReplay：真实 saveSnapshot/readSnapshot 恢复后状态等价、后续动作确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  const persistHome = mkdtempSync(join(tmpdir(), 'tdc-gv-save-'))
  delete process.env.BOARDGAME_PERSIST // 覆盖默认开启路径（不设 BOARDGAME_PERSIST=0）
  process.env.DSH_HOME = persistHome
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认为开启')
    const { state, api } = setup(2)
    translateGlyph(state, '11598', api)
    const sessionId = 'tdc-gv-save-replay'
    const session = {
      sessionId, modId: 'arkhamhorror', state,
      players: [{ seat: 0, name: '调查员1' }, { seat: 1, name: '调查员2' }],
      events: [{ type: 'test', text: '大秘库存档前' }],
      settings: { difficulty: 'standard', seed: 'tdc-gv' },
      revision: 3,
    }
    const file = saveSnapshot(session)
    assert.equal(existsSync(file), true)
    const record = readSnapshot(sessionId)
    assert.ok(record, `readSnapshot 返回空：${readFileSync(file, 'utf8').slice(0, 400)}`)
    const normalize = value => JSON.parse(JSON.stringify(value))
    assert.deepEqual(normalize(record.session.state), normalize(state), '读回状态与内存状态深度相等')
    assert.equal(record.session.sessionId, sessionId)
    assert.equal(record.session.modId, 'arkhamhorror')
    assert.deepEqual(record.session.players, session.players)
    assert.deepEqual(record.session.settings, session.settings)
    // 后续动作：从读回状态与内存起点各执行同一 behavior 入口，结果指纹一致。
    const restoredState = record.session.state
    const restoreApi = makeApi(restoredState)
    const memoryApi = makeApi(state)
    assert.equal(translateGlyph(restoredState, '11599', restoreApi), true)
    assert.equal(translateGlyph(state, '11599', memoryApi), true)
    const fingerprint = value => JSON.stringify({
      glyphs: value.campaign.records.discoveredGlyphs,
      flags: value.scenarioFlags,
      victory: value.victoryDisplay,
      grid: Object.fromEntries(Object.entries(mechanicState(value).grid).map(([id, cell]) => [id, { x: cell.x, y: cell.y }])),
      activation: activatedIds(value),
      setAside: value.scenarioZones.setAside,
    })
    assert.equal(fingerprint(restoredState), fingerprint(state), '同一动作在恢复态与内存态结果一致')
    assert.deepEqual(restoredState.campaign.records.discoveredGlyphs, ['rune_l', 'rune_m'])
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
    rmSync(persistHome, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 12. 第三轮：受控剧情资产 11611（PRIMITIVES.md「受控剧情资产行动」）
// ---------------------------------------------------------------------------
const addFloodLocations = state => {
  state.locations.push(
    { id: 'tdcPool', code: 'tdcPool', name: '淹没池', revealed: true, clues: 0, shroud: 1, connections: ['tdcVault'] },
    { id: 'tdcVault', code: 'tdcVault', name: '秘库', revealed: true, clues: 0, shroud: 1, connections: ['tdcPool'] },
  )
  state.investigators[0].location = 'tdcPool'
}
const placeTidalTablet = state => {
  state.investigators[0].assets ||= []
  const tablet = { id: 'tidalTablet11611', code: '11611', exhausted: false }
  state.investigators[0].assets.push(tablet)
  return tablet
}

test('P7 theGrandVault 受控剧情资产 11611 [fast]：legalMoves 出现横置能力并真实结算淹没操作', () => {
  const state = engineFixture('01001', 1)
  const inv = state.investigators[0]
  addFloodLocations(state)
  const tablet = placeTidalTablet(state)
  const here = inv.location
  const target = 'tdcVault'
  const water = scenarioRuntime(state, []).mechanics.water
  water.set(here, 0, { ignoreRestrictions: true })
  water.set(target, 1, { ignoreRestrictions: true })
  const moves = engineLegalMoves(state, 0)
  const abilityMove = moves.find(option => option.action === 'ability' && option.assetId === tablet.id)
  assert.ok(abilityMove, '受控剧情资产的 [fast] 能力出现在合法动作里')
  assert.match(abilityMove.label, /潮汐碑匾/)
  engineMove(state, { action: 'ability', assetId: tablet.id, abilityIndex: abilityMove.abilityIndex })
  engineSettle(state)
  const after = scenarioRuntime(state, []).mechanics.water
  assert.equal(after.level(here), 1, '提高所在地点的淹没等级（0 → 1）')
  assert.equal(after.level(target), 0, '降低另一处淹没地点（1 → 0）')
  const afterTablet = state.investigators[0].assets.find(asset => asset.id === tablet.id)
  assert.equal(afterTablet.exhausted, true, '[fast] 费用：横置潮汐碑匾')
})

test('P7 theGrandVault 受控剧情资产 11611 [reaction]：所在地点淹没等级提高时移动到一处连接地点', () => {
  const state = engineFixture('01001', 1)
  const inv = state.investigators[0]
  addFloodLocations(state)
  const tablet = placeTidalTablet(state)
  const here = inv.location
  const target = 'tdcVault'
  const execute = (draft, seat, move, events) => {
    void seat; void move
    scenarioRuntime(draft, events).mechanics.water.change(here, 1)
  }
  resolveTransaction(state, 0, { action: 'fixture-flood' }, execute)
  assert.equal(state.pendingChoice?.kind, 'reaction', '淹没提高打开 floodChanged 反应窗口')
  const triggerOption = state.pendingChoice.options.find(option => String(option.id).startsWith('desc:') && option.cardCode === '11611')
  assert.ok(triggerOption, '潮汐碑匾 [reaction] 出现在反应选项里')
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: triggerOption.id }, execute)
  if (state.pendingChoice?.kind === 'location') {
    resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: target }, execute)
  }
  assert.equal(state.investigators[0].location, target, '淹没提高后移动到一处连接地点')
  const afterTablet = state.investigators[0].assets.find(asset => asset.id === tablet.id)
  assert.equal(afterTablet.exhausted, false, '[reaction] 不横置潮汐碑匾')
})

// ---------------------------------------------------------------------------
// 13. 第三轮：Good Money「下一章维护阶段不能获得资源」（campaignRuleFlag 跨章标记 + campaign-rules helper）
// ---------------------------------------------------------------------------
test('P7 theGrandVault Good Money：campaignRuleFlag 跨章标记只让下一章维护阶段禁止获得资源（campaign-rules helper 判定，越章后 stale 无害）', () => {
  const { state, api } = setup(2, {}, { progress: { 'tdcTask:0': { option: 'goodMoney', value: 2 } } })
  state.campaign.scenarioIndex = 4
  api.choose = () => 'playBothSides'
  resolveGoodMoney(state, api)
  const flag = state.campaign.ruleFlags?.tdcNoUpkeepResources
  assert.ok(flag, '结算写入 campaign.ruleFlags 跨章标记')
  assert.equal(flag.originScenario, 'theGrandVault')
  assert.deepEqual(flag.seats, [0])
  assert.equal(flag.appliesToScenarioIndex, 5, '只对下一章（index 5）生效')
  // 下一章：只有选择两头下注的座位不能获得维护资源（行为经 campaign-rules helper 判定）。
  state.campaign.scenarioIndex = 5
  assert.equal(behavior.canGainResources(state, state.investigators[0]), false)
  assert.equal(behavior.canGainResources(state, state.investigators[1]), true)
  // 越过下一章后 helper 按 appliesToScenarioIndex 返回可恢复正常；stale 标记不需要清理。
  state.campaign.scenarioIndex = 6
  assert.equal(behavior.canGainResources(state, state.investigators[0]), true, '越章后 stale 标记无害')
  assert.ok(state.campaign.ruleFlags.tdcNoUpkeepResources, 'stale 标记保留（helper 判定，preScenarioSetup 不再清理）')
  assert.equal(state.scenarioFlags['grandVaultGoodMoneyBothSides:0'], true, '统计性 flag 保留')
})

// ---------------------------------------------------------------------------
// 14. 第五轮：11605 enterOnlyFlooded / 11606 猎手连接 / 11608-11610 翻译费用
// ---------------------------------------------------------------------------
test('P7 theGrandVault 11605 不能进入未淹没地点：enemyRule.enterOnlyFlooded（进入/生成/猎人移动共用读点）', () => {
  const state = engineFixture('01001', 1)
  state.locations.push(
    { id: 'tdcDry', code: 'tdcDry', name: '干涸地', revealed: true, clues: 0, shroud: 1, connections: ['tdcWet'] },
    { id: 'tdcWet', code: 'tdcWet', name: '淹没地', revealed: true, clues: 0, shroud: 1, connections: ['tdcDry'] },
  )
  const water = scenarioRuntime(state, []).mechanics.water
  water.set('tdcWet', 1, { ignoreRestrictions: true })
  const slitherer = {
    id: 'slitherer11605', code: '11605', originalCode: '11605', name: '黑暗中的滑行者',
    location: 'tdcWet', engagedSeat: null, exhausted: false, damageTaken: 0,
    traits: ['Monster', 'Stowaway', 'Elite'],
  }
  state.enemies.push(slitherer)
  assert.equal(enemyCanEnterLocation(state, slitherer, 'tdcDry'), false, '未淹没地点：拒绝进入/生成')
  assert.equal(enemyCanEnterLocation(state, slitherer, 'tdcWet'), true, '淹没地点：允许')
  relocateEnemy(state, slitherer, 'tdcDry', [])
  assert.equal(slitherer.location, 'tdcWet', '不能移动到未淹没地点')
  relocateEnemy(state, slitherer, 'tdcWet', [])
  assert.equal(slitherer.location, 'tdcWet')
  // 同一声明也覆盖生成路径：引擎生成到未淹没地点时返回 null。
  water.set('tdcWet', 0, { ignoreRestrictions: true })
  assert.equal(scenarioRuntime(state, []).spawn('11605', 'tdcWet'), null, '生成路径同样拒绝未淹没地点')
})

test('P7 theGrandVault 11606 猎手连接：behavior.enemyConnections 返回全部已激活地点', () => {
  const { state, api } = setup(1)
  const activatedA = behavior.locationIdAtCell(state, { x: -1, y: -1 })
  const activatedB = behavior.locationIdAtCell(state, { x: 0, y: -1 })
  activateLocation(state, activatedA, api)
  activateLocation(state, activatedB, api)
  const here = state.locations.find(location => location.id === 'theGreatStair')
  const attendant = {
    id: 'attendant11606', code: '11606', originalCode: '11606', name: '秘库随从',
    location: here.id, engagedSeat: null, exhausted: false, traits: ['Monster', 'Keeper'],
  }
  const extra = behavior.enemyConnections(state, attendant, here)
  const expectedActivated = activatedIds(state).filter(id => id !== here.id)
  assert.deepEqual([...extra].sort(), [...expectedActivated].sort(), '每处已激活地点都视为与所在地点相连')
  // 不同卡号不受影响（穷途异魔的网格相邻分支仍独立）。
  const other = { id: 'other', code: '01169', originalCode: '01169', location: here.id }
  assert.deepEqual(behavior.enemyConnections(state, other, here), [])
})

test('P7 theGrandVault 11608/11609/11610 翻译费用：弃支援/受伤害恐惧/弃手牌按印刷支付后翻面并加入胜利区', () => {
  // 11608：弃掉印刷资源费用合计 ≥ X 的支援。
  {
    const { state, api } = setup(1)
    const chamber = state.locations.find(location => String(location.code) === '11598')
    const inv = state.investigators[0]
    inv.location = chamber.id
    behavior.events.grandVaultAncientVault(state, { seat: 0, code: '11608' }, api)
    const hidden = chamber.shroud
    const assets = Object.values(ALL_CARDS).filter(card => card.type === 'asset' && Number(card.cost) >= hidden).slice(0, 2)
    inv.assets = assets.map((card, index) => ({ id: `asset-${index}`, code: card.code, originalCode: card.code }))
    const moves = behavior.actions(state, inv)
    const translate = moves.find(move => move.rule === 'grandVaultTranslateAncientVault')
    assert.ok(translate, 'actions 提供古代秘库翻译行动')
    assert.equal(translate.hidden, hidden, 'X = 附属地点隐藏值（shroud）')
    assert.equal(behavior.performAction(state, inv, translate, api), true, '11608 翻译成功')
    assert.equal(chamber.attachments.some(card => String(card.code) === '11608'), false, '翻面后不再附属')
    assert.equal(translatedGlyphCount(state) >= 1, true, '翻译写 discoveredGlyphs')
    assert.equal(glyphCardsInVictory(state).some(card => String(card.code) === '11608b'), true, '11608b 加入胜利区')
  }
  // 11609：受到合计 X 点伤害和/或恐惧（默认选择按伤害结算）。
  {
    const { state, api } = setup(1)
    const chamber = state.locations.find(location => String(location.code) === '11599')
    const inv = state.investigators[0]
    inv.location = chamber.id
    behavior.events.grandVaultAncientVault(state, { seat: 0, code: '11609' }, api)
    const hidden = chamber.shroud
    const before = inv.damage
    const translate = behavior.actions(state, inv).find(move => move.rule === 'grandVaultTranslateAncientVault')
    assert.ok(translate)
    assert.equal(behavior.performAction(state, inv, translate, api), true)
    assert.equal(inv.damage - before, hidden, '费用：受到合计 X 点伤害/恐惧')
    assert.equal(glyphCardsInVictory(state).some(card => String(card.code) === '11609b'), true)
  }
  // 11610：选择并弃掉手牌 X 张。
  {
    const { state, api } = setup(1)
    const chamber = state.locations.find(location => String(location.code) === '11598')
    const inv = state.investigators[0]
    inv.location = chamber.id
    behavior.events.grandVaultAncientVault(state, { seat: 0, code: '11610' }, api)
    const hidden = chamber.shroud
    inv.hand = Array.from({ length: hidden + 1 }, () => '01020')
    const translate = behavior.actions(state, inv).find(move => move.rule === 'grandVaultTranslateAncientVault')
    assert.ok(translate)
    assert.equal(behavior.performAction(state, inv, translate, api), true)
    assert.equal(inv.hand.length, 1, '费用：弃掉 X 张手牌')
    assert.equal(inv.discard.length, hidden)
    assert.equal(glyphCardsInVictory(state).some(card => String(card.code) === '11610b'), true)
  }
})

// ---------------------------------------------------------------------------
// 15. 第六轮：11607 第二幕改选两项 / 11596 淹没不能降低（双层约束）
// ---------------------------------------------------------------------------
test('P7 theGrandVault 11607 致命机械：失败按当前幕选择（第一幕选 1 项，第二幕改选 2 项）', () => {
  const makeState = () => {
    const { state, api } = setup(1)
    api.testResult = { success: false, failedBy: 1 }
    // 提供两项可用选项：最近的已激活[[秘库]] + 放在一边的秘库随从。
    const vault = behavior.locationIdAtCell(state, { x: -1, y: -1 })
    activateLocation(state, vault, api)
    state.scenarioZones.setAside = [...(state.scenarioZones.setAside || []), VAULT_ATTENDANT_CODE]
    const choices = []
    api.choose = spec => { choices.push(spec); return spec.options?.[0]?.id ?? null }
    return { state, api, choices }
  }
  // 第一幕：失败只选 1 项。
  {
    const { state, api, choices } = makeState()
    state.actIndex = 0
    behavior.events.grandVaultDeadlyMechanisms(state, { seat: 0 }, api)
    assert.equal(choices.length, 1, '第一幕失败选 1 项')
  }
  // 第二幕：失败改选 2 项（英文卡面 act 2）。
  {
    const { state, api, choices } = makeState()
    state.actIndex = 1
    behavior.events.grandVaultDeadlyMechanisms(state, { seat: 0 }, api)
    assert.equal(choices.length, 2, '第二幕失败改选 2 项')
    assert.notEqual(choices[0].options[0].id, choices[1].options[0].id, '两项不重复')
  }
})

test('P7 theGrandVault 11596 隐蔽蓄水池：淹没等级不能降低（floodBounds.min + cannotDecreaseFlood 双层约束）', async () => {
  const { changeFloodLevel, floodLevel } = await import('../src/engine/flood.js')
  const { state, api } = setup(1)
  const cistern = state.locations.find(location => String(location.code) === '11596')
  assert.ok(cistern, '隐蔽蓄水池在场')
  const id = cistern.id
  // 未揭示、水位 0：内容层「降低」直接拒绝，且不会因 min 钳制反向提高。
  assert.equal(floodLevel(state, id), 0)
  assert.equal(behavior.decreaseFloodLevel(state, id, api), false, 'cannotDecreaseFlood 拒绝内容层降低')
  assert.equal(floodLevel(state, id), 0, '拒绝后水位不变（不会被 min 钳制成提高）')
  // 揭示后强制提高（behavior.locationRevealed）。
  behavior.locationRevealed(state, cistern, api)
  assert.equal(floodLevel(state, id), 1, '揭示后提高淹没等级')
  // 内容层降低仍被拒绝。
  assert.equal(behavior.decreaseFloodLevel(state, id, api), false)
  assert.equal(floodLevel(state, id), 1)
  // 引擎直接写入路径（api.mechanics.water.change 同类）被 floodBounds.min 钳制。
  changeFloodLevel(state, id, -1)
  assert.equal(floodLevel(state, id), 1, '引擎水位写入钳制在 1')
})
