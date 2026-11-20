// P7 大秘库（theGrandVault · 提示卡 11587）章节测试。
//
// 覆盖：模块 import / manifest 结构 / 12 个规则地点与 grid 坐标 / 幕 2 议程 3 与结局键 /
// 遭遇牌库与放一边守恒 / 随机秘库房间（8 候选移出 1 张异界机械）/ 底部一排淹没 / 供能分支
// （thePowerWasDiverted）/ 移动平台换位 / 幕 1 轮末目标与碑匾交付 / 封印腔室解封 /
// 秘库核心解封与幕间（theInnerSanctumWasUnsealed）/ 四档混乱标记 / 结局记录与 Good Money /
// JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2/P7 原语（网格坐标用 mechanicState）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
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
  resolveGoodMoney, resolution,
} from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/behavior.js'
import {
  grandVaultChaosToken, grandVaultChaosTokenValue, skullValue, tabletValue, activatedCount,
  isActivated as isActivatedBehavior, GRAND_VAULT_TOKEN_MEANINGS, CHAOS_TOKEN_FACES, isHardSide,
} from '../content/campaigns/theDrownedCity/scenarios/theGrandVault/chaos.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
  assert.equal(chapter.manifest.status, 'development')
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
test('P7 theGrandVault 符文：翻译 3 个符文揭示封印腔室，符文卡加入胜利区', () => {
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
  assert.equal(glyphCardsInVictory(state).length, 3)
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
