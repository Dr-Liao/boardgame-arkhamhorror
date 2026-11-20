// 大秘库（theGrandVault · 11587）· 引擎钩子（章节流程）。
//
// 权威来源：Scenario/Scenarios/TheDrownedCity/TheGrandVault.hs + Helpers.hs +
//   Location|Enemy|Treachery/Cards/TheDrownedCity/TheGrandVault/*.hs +
//   frontend/src/locales/en/theDrownedCity/theGrandVault.json。
//
// 引擎读点（全部走既有钩子，不改引擎）：
//   preScenarioSetup → 供能分支（thePowerWasDiverted）与开场分支
//   setupLocations / locationPlaced / afterDeckSetup → 固定地点 + 随机秘库房间网格、放一边、
//     Star Spawn 随机 2 张移出、底部一排腔室部分淹没、预激活
//   actions / performAction → 移动平台交换、激活腔室、研究秘库核心幕间、翻译符文
//   afterInvestigate → 「最后一个线索被发现」：碑匾腔室交付潮汐碑匾 / 档案室翻译符文 /
//     移动平台调查后无额外效果；秘库核心在轮末按「每处秘库均已激活」解封
//   locationRevealed → 隐蔽蓄水池强制提高淹没等级 / 异界机械抽取放在一边的符文诡计
//   enemyStatModifier / enemyConnections → 穷途异魔生命与「每处地点视为相连」的猎手移动
//   roundEnded / checkObjectives → 幕 1（控制潮汐碑匾且轮末）与幕 2（全员撤退）推进、
//     秘库核心解封判定
//   actReveal / agendaReveal → 幕/议程背面
//   resolveChaosToken / applyTokenEffect → 11587 四档混乱标记
//   resolution → 结局 1/2/无结局、R'lyeh 地图、Tidal Tablet、Good Money 下一章效果
//   events → 单卡条目经 api.resolveScenarioEvent 结算的复杂行为
//
// 近似（报告已登记）：
//   · 卡表无地点连接图标数据 → 用正交网格相邻作为规则连接的近似（与「移动平台与每处相邻地点
//     相连」同口径）；移动平台/碑匾腔室的印刷连接合并在同一份网格邻接里。
//   · 幕/议程目标没有专门的引擎 objective 类型 → 目标判定在 roundEnded/checkObjectives 里。
//   · Good Money「下一章维护阶段不能获得资源」没有引擎读点 → 记入 scenarioFlags 并写原语请求。
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { applyCampaignEffect } from '../../../../../src/campaign/campaign-effects.js'
import { TDC_NO_UPKEEP_RESOURCES, tdcCannotGainUpkeepResources } from '../../campaign-rules.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'
import { adjacentGridSpaces, connectGrid, gridPosition, relocateGridCells } from '../../../../../src/engine/grid-map.js'
import { changeFloodLevel, floodLevel, setFloodLevel } from '../../../../../src/engine/flood.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  isHardSide, skullValue, activatedCount, activatedLocationIds, isActivated, floodLevelOf,
  grandVaultChaosToken, GRAND_VAULT_TOKEN_MEANINGS, GLYPH_TRAIT, VAULT_TRAIT,
} from './chaos.js'
import {
  ACT1_CODE, ACT2_CODE, AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE, ACT_STAGES, AGENDA_STAGES, AGENDAS,
  ANCIENT_VAULT_BACK_CODES, ANCIENT_VAULT_CODES, CHAMBER_LOCATION_IDS, CHAPTER_ID, DEADLY_MECHANISMS_CODE,
  ENCOUNTER_DECK, FIXED_LOCATION_IDS, GLYPH_RECORDS, GLYPH_RUNE_ORDER, GLYPH_RUNES_UNSEAL_THRESHOLD,
  GOOD_MONEY_NEXT_SCENARIO_RESOURCES, INESCAPABLE_SET_CODES, LOCATION_CELLS, LOCATIONS, RESOLUTION_KEYS,
  SCENARIO_TEXT, SEALED_CHAMBER_ID, SET_ASIDE_ALIASES, SLITHERER_CODE, STAR_SPAWN_ENEMY_CODES,
  STAR_SPAWN_REMOVED_COUNT, TIDAL_TABLET_CODE, VAULT_ATTENDANT_CODE, VAULT_BOTTOM_LEFT_CELL,
  VAULT_BOTTOM_ROW_CELLS, VAULT_CORE_INTERLUDE, VAULT_POOL_IDS, VAULT_PREACTIVATED_CELLS, VAULT_SLOT_CELLS,
  encounterDefinitions, scenario, vaultChamberPool,
} from './definition.js'

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clone = value => (value == null ? value : structuredClone(value))
const codeOf = value => String(value?.originalCode || value?.code || '')
const info = (api, message) => api?.info?.(message)
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const activeInvestigators = state => (state?.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const locationOf = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const flagsFor = state => (state.scenarioFlags ||= {})
const setFlag = (state, key, value = true) => { flagsFor(state)[key] = value; return value }
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())
const entryFlags = code => registeredEntry(String(code))?.flags || {}
const flagIs = (code, key) => entryFlags(code)[key] === true
const groupCluesAt = (state, locationId) => (state?.investigators || [])
  .filter(inv => inv.location === locationId && !inv.defeated && !inv.resigned)
  .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
function spendGroupClues(state, locationId, amount) {
  let remaining = amount
  for (const inv of state?.investigators || []) {
    if (remaining <= 0) break
    if (inv.location !== locationId || inv.defeated || inv.resigned) continue
    const pay = Math.min(Number(inv.clues) || 0, remaining)
    inv.clues = (Number(inv.clues) || 0) - pay
    remaining -= pay
  }
  return remaining === 0
}
const randomOf = api => (typeof api?.random === 'function' ? api.random : () => 0.5)
function localShuffle(list, random) {
  const result = [...list]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    ;[result[index], result[pick]] = [result[pick], result[index]]
  }
  return result
}
const shuffleWith = (api, list) => (typeof api?.shuffle === 'function' ? api.shuffle([...list]) : localShuffle(list, randomOf(api)))

function writeGridCell(state, locationId, cell) {
  const data = mechanicState(state, true)
  data.grid ||= {}
  data.grid[locationId] = {
    x: cell.x, y: cell.y, isolated: false, connections: [...(mechanicState(state)?.grid?.[locationId]?.connections || [])],
  }
  const loc = locationOf(state, locationId)
  if (loc) loc.grid = { x: cell.x, y: cell.y }
  return data.grid[locationId]
}

function syncConnections(state) {
  try { connectGrid(state) } catch { /* 纯数据测试没有网格容器时忽略 */ }
  return true
}

function locationInstance(state, locationId, { revealed = false } = {}) {
  const base = state.scenario?.locations?.[locationId] || LOCATIONS[locationId]
  if (!base) return null
  const def = clone(base)
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * investigatorCount(state)
    : Number(def.clues) || 0)
  return {
    ...def, id: locationId, revealed,
    clues: revealed ? clues : 0, maxClues: clues,
    connections: [], symbolLinks: [], attachments: [], damage: 0, horror: 0,
    resources: 0, doom: 0,
  }
}

/** 把地点放进网格：优先走引擎 api.mechanics.map.place，纯内容层调用时本地建实例。 */
export function placeLocationAt(state, locationId, cell, api = {}, { revealed = false } = {}) {
  writeGridCell(state, locationId, cell)
  let loc = locationOf(state, locationId)
  if (!loc) {
    const placed = typeof api?.mechanics?.map?.place === 'function'
      ? api.mechanics.map.place(locationId, cell.x, cell.y)
      : null
    if (!placed) {
      const instance = locationInstance(state, locationId, { revealed })
      if (!instance) return null
      state.locations ||= []
      state.locations.push(instance)
      loc = instance
    } else {
      loc = locationOf(state, locationId)
    }
  }
  const current = locationOf(state, locationId)
  if (current) current.grid = { x: cell.x, y: cell.y }
  if (revealed && current && current.revealed !== true) revealLocal(state, current, api)
  syncConnections(state)
  return locationId
}

function revealLocal(state, loc, api = {}) {
  if (!loc || loc.revealed === true) return false
  loc.revealed = true
  loc.clues = Math.max(0, Number(loc.maxClues) || 0)
  if (loc.unrevealedActualName) { loc.name = loc.unrevealedActualName; delete loc.unrevealedActualName }
  delete loc.hiddenIdentity
  if (typeof api?.reveal === 'function') api.reveal(loc.id)
  info(api, `「${loc.name}」被揭示。`)
  return true
}

// ---------------------------------------------------------------------------
// 网格工具（秘库房间位置 / 相邻 / 已激活）
// ---------------------------------------------------------------------------
export function currentGrid(state) {
  return mechanicState(state)?.grid || {}
}

export function locationIdAtCell(state, cell) {
  for (const [id, value] of Object.entries(currentGrid(state))) {
    if (value.x === cell.x && value.y === cell.y) return id
  }
  return null
}

export function swappedCells(state, fromId, toId) {
  const from = gridPositionFrom(state, fromId)
  const to = gridPositionFrom(state, toId)
  if (!from || !to) return null
  return [{ id: fromId, x: to.x, y: to.y }, { id: toId, x: from.x, y: from.y }]
}
function gridPositionFrom(state, id) {
  const cell = currentGrid(state)[id]
  return cell ? { x: cell.x, y: cell.y } : null
}

export function activatedIds(state) {
  return activatedLocationIds(state)
}

export function activateLocation(state, locationId, api = {}) {
  if (!locationId || isActivated(state, locationId)) return false
  flagsFor(state).grandVaultActivated ||= []
  flagsFor(state).grandVaultActivated.push(String(locationId))
  const loc = locationOf(state, locationId)
  if (loc) loc.resources = Number(loc.resources) || 1
  info(api, `「${loc?.name || locationId}」被激活。`)
  maybeRevealCore(state, api)
  return true
}

export function deactivateLocation(state, locationId, api = {}) {
  const list = flagsFor(state).grandVaultActivated
  if (!Array.isArray(list)) return false
  const index = list.indexOf(String(locationId))
  if (index < 0) return false
  list.splice(index, 1)
  const loc = locationOf(state, locationId)
  if (loc) loc.resources = 0
  info(api, `「${loc?.name || locationId}」失去激活。`)
  return true
}

/** 最近的一处已激活[[秘库]]地点（按图距离；并列取先找到的）。 */
export function nearestActivatedVault(state, fromId) {
  const candidates = activatedIds(state)
    .map(id => locationOf(state, id))
    .filter(loc => loc && hasTrait(loc, VAULT_TRAIT))
  if (!candidates.length) return null
  const start = locationOf(state, fromId)
  if (start && candidates.some(loc => loc.id === start.id)) return start.id
  let frontier = start ? [...(start.connections || [])] : []
  const seen = new Set(start ? [start.id] : [])
  while (frontier.length) {
    const next = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      if (candidates.some(loc => loc.id === id)) return id
      const loc = locationOf(state, id)
      for (const neighbor of loc?.connections || []) if (!seen.has(neighbor)) next.push(neighbor)
    }
    frontier = next
  }
  return candidates[0].id
}

export function allVaultActivated(state) {
  const vaults = (state.locations || []).filter(loc => hasTrait(loc, VAULT_TRAIT))
  return vaults.length > 0 && vaults.every(loc => isActivated(state, loc.id))
}

export function coreOfVault(state) {
  return locationOf(state, 'coreOfTheVault')
}

export function maybeRevealCore(state, api = {}) {
  const core = coreOfVault(state)
  if (!core || core.revealed === true) return false
  if (!allVaultActivated(state)) return false
  revealLocal(state, core, api)
  info(api, '每处[[秘库]]地点都已激活：揭示秘库核心。')
  return true
}

// ---------------------------------------------------------------------------
// 供能分支 / 布置
// ---------------------------------------------------------------------------
export function routeOf(state) {
  const records = state?.campaign?.records || {}
  return records.thePowerWasDiverted === true ? 'diverted' : 'normal'
}

export function prepareScenario(state, api = {}) {
  if (flagsFor(state).grandVaultPrepared) return flagsFor(state).grandVaultReport
  const powerWasDiverted = routeOf(state) === 'diverted'
  const report = {
    chapterId: CHAPTER_ID, powerWasDiverted,
    introBranch: powerWasDiverted ? 'grandVault1' : 'grandVault2',
    preactivatedCells: powerWasDiverted ? [VAULT_BOTTOM_LEFT_CELL] : [...VAULT_PREACTIVATED_CELLS],
  }
  const actSource = state.scenario?.stageCards || {}
  state.acts = [actSource[ACT1_CODE] || ACT_STAGES[1], actSource[ACT2_CODE] || ACT_STAGES[2]].map(act => clone(act))
  const agendas = state.scenario?.stageCards || {}
  state.agendas = [AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE]
    .map(code => clone(agendas[code] || AGENDAS[AGENDA1_CODE === code ? 0 : AGENDA2_CODE === code ? 1 : 2]))
  state.actIndex = Number.isInteger(state.actIndex) ? state.actIndex : 0
  state.agendaIndex = Number.isInteger(state.agendaIndex) ? state.agendaIndex : 0
  setFlag(state, 'grandVaultReport', report)
  setFlag(state, 'grandVaultPrepared', true)
  info(api, `大秘库：供能${powerWasDiverted ? '已被改道（只激活左下腔室）' : '未被改道（激活左下/右下/右上）'}。`)
  return report
}

export function preScenarioSetup(state, events, api = {}) {
  void events
  const report = prepareScenario(state, api)
  return report
}

export function introduction(sc, records = {}, context = null) {
  const state = context?.campaign ? context : { campaign: { records }, scenarioFlags: context?.scenarioFlags || {} }
  const report = { ...prepareScenario(state, {}) }
  const branch = report.introBranch
  const paragraphs = [SCENARIO_TEXT.intro, SCENARIO_TEXT.introBranches[branch]]
    .filter(Boolean).flatMap(value => String(value).split(/\n{2,}/)).filter(Boolean)
  return { version: 3, title: sc?.name || scenario.name, sections: [{ title: SCENARIO_TEXT.heading, paragraphs }], paragraphs, code: ACT1_CODE }
}

export function setupLocations(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  const report = prepareScenario(state, api)
  const random = typeof helper?.randomValue === 'function' ? () => helper.randomValue(state) : randomOf(api)
  const built = vaultChamberPool(random)
  flagsFor(state).grandVaultChambers = { removed: built.removed, chambers: built.chambers, slots: built.slots }
  for (const [id, cell] of Object.entries(LOCATION_CELLS)) writeGridCell(state, id, cell)
  setFlag(state, 'grandVaultReport', { ...report, removedChamber: built.removed, chambers: [...built.chambers] })
  info(api, `秘库房间：随机移出「${ALL_CARDS[LOCATIONS[built.removed]?.code]?.nameZh || built.removed}」，其余 7 张洗牌入场。`)
  return [...FIXED_LOCATION_IDS]
}

export function setupEnemies(state, events = null, helper = {}) {
  void state; void events; void helper
}

export function afterDeckSetup(state, events, helper = {}) {
  void events
  const api = helper?.api || {}
  prepareScenario(state, api)
  const zones = state.scenarioZones ||= {}
  const report = flagsFor(state).grandVaultReport || {}
  // 1) 随机秘库房间：7 张洗牌后按槽位未揭示入场（被移出的异界机械移出游戏）。
  const chambers = report.chambers || (flagsFor(state).grandVaultChambers?.chambers) || []
  const slotCells = report.slots || VAULT_SLOT_CELLS
  const placed = []
  for (const [index, id] of chambers.entries()) {
    const cell = slotCells[index]
    if (!cell) break
    writeGridCell(state, id, cell)
    const exists = locationOf(state, id)
    if (!exists) {
      const done = typeof api?.mechanics?.map?.place === 'function'
        ? api.mechanics.map.place(id, cell.x, cell.y)
        : placeLocationAt(state, id, cell, api, { revealed: false })
      if (done) placed.push(id)
    } else placed.push(id)
  }
  for (const id of FIXED_LOCATION_IDS) {
    if (!gridPosition(state, id)) writeGridCell(state, id, LOCATION_CELLS[id])
    const loc = locationOf(state, id)
    if (loc && (id === 'theGreatStair' || id === 'movingPlatform')) loc.revealed = true
  }
  // 2) 底部一排腔室部分淹没（Haskell vaultBottomRow），然后按供能分支预激活。
  for (const cell of VAULT_BOTTOM_ROW_CELLS) {
    const id = locationIdAtCell(state, cell)
    if (id) increaseFloodLevel(state, id, api)
  }
  for (const cell of report.preactivatedCells || VAULT_PREACTIVATED_CELLS) {
    const id = locationIdAtCell(state, cell)
    if (id) activateLocation(state, id, api)
  }
  // 3) 放一边：Ancient Vault 双面诡计 / Vault Attendant / Tidal Tablet / The Inescapable 组 / Star Spawn。
  const starSpawn = shuffleWith(api, STAR_SPAWN_ENEMY_CODES)
  const removedStarSpawn = starSpawn.slice(0, STAR_SPAWN_REMOVED_COUNT)
  const setAsideStarSpawn = starSpawn.slice(STAR_SPAWN_REMOVED_COUNT)
  zones.setAside = [...SET_ASIDE_ALIASES.filter(code => !STAR_SPAWN_ENEMY_CODES.includes(code)), ...setAsideStarSpawn]
  zones.setAsideLocations = []
  zones.removed = [...removedStarSpawn]
  setFlag(state, 'grandVaultStarSpawn', { removed: removedStarSpawn, setAside: setAsideStarSpawn })
  syncConnections(state)
  info(api, `大秘库布置：${placed.length} 张秘库房间入场；Star Spawn 随机移出 ${removedStarSpawn.length} 名，其余放一边。`)
  return { placed, starSpawn: { removed: removedStarSpawn, setAside: setAsideStarSpawn } }
}

/** 直调/单测入口：准备 + 固定地点 + 随机秘库房间 + 淹没/激活/放一边。 */
export function setupScenario(state, api = {}) {
  state.locations = []
  state.scenarioFlags ||= {}
  delete state.scenarioFlags.grandVaultPrepared
  delete state.scenarioFlags.grandVaultReport
  state.scenario ||= scenario
  const helper = { api, randomValue: () => randomOf(api)() }
  const fixed = setupLocations(state, null, helper)
  for (const id of fixed) {
    const revealed = id === 'theGreatStair' || id === 'movingPlatform'
    placeLocationAt(state, id, LOCATION_CELLS[id], api, { revealed })
  }
  afterDeckSetup(state, null, helper)
  state.investigators ||= []
  for (const inv of state.investigators) if (!inv.location) inv.location = 'theGreatStair'
  if (!state.encounterDeck?.length) state.encounterDeck = [...(state.scenario?.encounterDeck || ENCOUNTER_DECK)]
  return { ...flagsFor(state).grandVaultReport, placedIds: [...fixed] }
}

export function locationPlaced(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  const cell = LOCATION_CELLS[location.id]
  if (cell && !gridPosition(state, location.id)) writeGridCell(state, location.id, cell)
  if (location.id === 'theGreatStair' || location.id === 'movingPlatform') {
    location.revealed = true
    location.clues = Math.max(0, Number(location.maxClues) || 0)
  }
  const position = gridPosition(state, location.id)
  if (position) location.grid = { x: position.x, y: position.y }
  syncConnections(state)
  return true
}

export function locationRevealed(state, location, api = {}, seat = null) {
  void seat
  if (!location) return false
  if (hasTrait(location, VAULT_TRAIT) && flagIs(codeOf(location), 'revealFlood')) {
    increaseFloodLevel(state, location.id, api)
  }
  if (flagIs(codeOf(location), 'revealGlyphTreachery')) {
    drawSetAsideGlyphTreachery(state, api, seat)
  }
  if (flagIs(codeOf(location), 'glyphChamber') && location.clues === 0) {
    translateGlyph(state, codeOf(location), api)
  }
  return true
}

// ---------------------------------------------------------------------------
// 淹没
// ---------------------------------------------------------------------------
export function locationCannotFlood(state, locationId) {
  const loc = locationOf(state, locationId)
  const code = codeOf(loc) || codeOf({ code: LOCATIONS[locationId]?.code })
  if (['theGreatStair', 'movingPlatform', 'coreOfTheVault', SEALED_CHAMBER_ID].includes(locationId)) return true
  if (['11593', '11594', '11595', '11604'].includes(code)) return true
  const bounds = registeredEntry(code)?.locationRule?.floodBounds || {}
  return bounds.max === 0
}

export function increaseFloodLevel(state, locationId, api = {}, amount = 1) {
  if (!locationId || locationCannotFlood(state, locationId)) return false
  if (floodLevel(state, locationId) >= 2) return false
  if (typeof api?.mechanics?.water?.change === 'function') {
    api.mechanics.water.change(locationId, amount)
  } else if (!canChangeFlood(state, locationId, amount)) return false
  else changeFloodLevel(state, locationId, amount)
  return true
}

/** 11596 隐蔽蓄水池：印刷「本地点的淹没等级不能降低」。
 * 双层约束：① 条目 `locationRule.floodBounds.min = 1` 让引擎水位写入（含 api.mechanics.water.change
 * 等直接写入路径）把任何降低钳制在 1；② 本函数先读条目 `locationRule.cannotDecreaseFlood`，
 * 对内容层降低调用直接拒绝——避免未揭示/水位 0 时「降低」被 min 钳制反而变成提高的边界情况。
 */
function floodCannotDecrease(state, locationId) {
  const loc = locationOf(state, locationId)
  const code = codeOf(loc) || codeOf({ code: LOCATIONS[locationId]?.code })
  return registeredEntry(code)?.locationRule?.cannotDecreaseFlood === true
}

export function decreaseFloodLevel(state, locationId, api = {}, amount = -1) {
  if (!locationId) return false
  if (floodCannotDecrease(state, locationId)) {
    info(api, `「${locationOf(state, locationId)?.name || locationId}」的淹没等级不能降低。`)
    return false
  }
  if (typeof api?.mechanics?.water?.change === 'function') return api.mechanics.water.change(locationId, amount)
  if (!canChangeFlood(state, locationId, amount)) return false
  return changeFloodLevel(state, locationId, amount)
}
function canChangeFlood(state, locationId, delta) {
  const before = floodLevel(state, locationId)
  const after = Math.max(0, Math.min(2, before + delta))
  return after !== before
}

// ---------------------------------------------------------------------------
// 符文（Glyph）
// ---------------------------------------------------------------------------
export function translatedGlyphs(state) {
  return [...(recordsFor(state).discoveredGlyphs || [])]
}
export function translatedGlyphCount(state) {
  return new Set(translatedGlyphs(state)).size
}
export function isGlyphTranslated(state, rune) {
  return translatedGlyphs(state).includes(String(rune))
}

/** 发现/翻译一个符文：写 discoveredGlyphs，加故事卡进胜利区；满 3 个揭示封印腔室。
 *
 * 胜利区归属口径（第二轮修正）：
 *   · 档案室 11598/11599 是**地点**，胜利点由引擎 `awardLocationVictory` 计入 `state.victory`，
 *     不再另造一张故事卡进 victoryDisplay（否则 XP / 符文数重复计）。
 *   · 古代秘库 11608/11609/11610 翻面后的 11608b/11609b/11610b 是**剧情卡**，按印刷确实加入
 *     胜利区，因此这里补故事卡。
 *   · `options.addVictory === false` 供「本卡本身已被引擎放进胜利区」的调用方（如敌人 11630/31）关闭补卡。
 */
export function translateGlyph(state, sourceCode, api = {}, { addVictory } = {}) {
  const record = GLYPH_RECORDS[String(sourceCode)]
  if (!record) return false
  const records = recordsFor(state)
  records.discoveredGlyphs ||= []
  if (records.discoveredGlyphs.includes(record.rune)) return false
  records.discoveredGlyphs.push(record.rune)
  setFlag(state, `grandVaultGlyph:${record.rune}`, true)
  const isLocationGlyph = Object.values(LOCATIONS).some(location => location.code === String(sourceCode))
  const backCode = ANCIENT_VAULT_CODES.includes(String(sourceCode))
    ? ANCIENT_VAULT_BACK_CODES[ANCIENT_VAULT_CODES.indexOf(String(sourceCode))]
    : null
  const recordVictory = addVictory ?? !isLocationGlyph
  const victoryCode = backCode || String(sourceCode)
  if (recordVictory) {
    if (typeof api.addStoryToVictory === 'function') api.addStoryToVictory(victoryCode, { sourceId: `glyph:${record.rune}` })
    else {
      state.victoryDisplay ||= []
      if (!state.victoryDisplay.some(entry => entry.code === victoryCode || entry.originalCode === victoryCode)) {
        state.victoryDisplay.push({
          id: `glyph:${record.rune}`, code: victoryCode, originalCode: victoryCode,
          name: ALL_CARDS[victoryCode]?.nameZh || ALL_CARDS[victoryCode]?.name || victoryCode,
          victory: Number(ALL_CARDS[victoryCode]?.victory) || 1,
        })
      }
    }
  }
  info(api, `发现符文 ${record.rune}（${record.wordZh} / ${record.word}）：已翻译 ${translatedGlyphCount(state)} 个。`)
  maybeUnsealSealedChamber(state, api)
  return true
}

export function maybeUnsealSealedChamber(state, api = {}) {
  if (flagsFor(state).grandVaultSealedChamberUnsealed) return false
  if (translatedGlyphCount(state) < GLYPH_RUNES_UNSEAL_THRESHOLD) return false
  const chamber = locationOf(state, SEALED_CHAMBER_ID)
  if (!chamber) return false
  setFlag(state, 'grandVaultSealedChamberUnsealed', true)
  revealLocal(state, chamber, api)
  info(api, `已翻译 ${GLYPH_RUNES_UNSEAL_THRESHOLD} 个符文：揭示封印腔室。`)
  return true
}

export function glyphCardsInVictory(state) {
  const backGlyphs = new Set(ANCIENT_VAULT_BACK_CODES)
  return (state.victoryDisplay || []).filter(entry => {
    const code = String(entry?.originalCode || entry?.code)
    if (backGlyphs.has(code)) return true
    const card = ALL_CARDS[code] || entry
    return hasTrait(card, GLYPH_TRAIT)
  })
}

export function drawSetAsideGlyphTreachery(state, api = {}, seat = null) {
  const zones = state.scenarioZones ||= {}
  const aside = Array.isArray(zones.setAside) ? zones.setAside : []
  const candidates = aside.filter(code => ANCIENT_VAULT_CODES.includes(String(code)))
  if (!candidates.length) {
    info(api, '放在一边的[[符文]]诡计已用尽。')
    return null
  }
  const random = randomOf(api)
  const code = candidates[Math.floor(random() * candidates.length)]
  aside.splice(aside.indexOf(code), 1)
  detachSetAsideGlyph(state, code, api, seat)
  return code
}

function detachSetAsideGlyph(state, code, api = {}, seat = null) {
  const actor = Number.isInteger(seat) ? seat : (state.currentSeat ?? state.campaign?.leadSeat ?? 0)
  const inv = (state.investigators || [])[actor]
  const loc = inv ? locationOf(state, inv.location) : null
  if (loc && typeof api.attachEncounterToLocation === 'function') api.attachEncounterToLocation(code, loc.id)
  else if (loc) {
    loc.attachments ||= []
    loc.attachments.push({ code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code })
  }
  info(api, `放在一边的「${ALL_CARDS[code]?.nameZh || code}」附属到「${loc?.name || '调查员所在地'}」。`)
  return code
}

// ---------------------------------------------------------------------------
// 秘库核心幕间 / 潮汐碑匾
// ---------------------------------------------------------------------------
export function tidalTabletControlledBy(state) {
  return (state.investigators || []).find(inv => (inv.assets || []).some(asset => codeOf(asset) === TIDAL_TABLET_CODE)) || null
}

export function giveTidalTablet(state, seat, api = {}) {
  const inv = (state.investigators || [])[seat]
  if (!inv) return null
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside)) {
    const index = zones.setAside.indexOf(TIDAL_TABLET_CODE)
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  if (typeof api.giveAsset === 'function') {
    const asset = api.giveAsset(seat, TIDAL_TABLET_CODE)
    if (asset) return asset
  }
  const card = ALL_CARDS[TIDAL_TABLET_CODE] || {}
  const asset = {
    id: `grandVault-tidalTablet-${seat}`, code: TIDAL_TABLET_CODE, originalCode: TIDAL_TABLET_CODE,
    name: card.nameZh || card.name || TIDAL_TABLET_CODE, controllerSeat: seat, ownerSeat: seat,
    exhausted: false, damage: 0, horror: 0, tokens: 0, attachments: [], assets: [],
  }
  inv.assets ||= []
  inv.assets.push(asset)
  info(api, `潮汐碑匾交给 ${inv.name}。`)
  return asset
}

export function vaultCoreInterlude(state, inv, api = {}) {
  if (!inv) return false
  const core = coreOfVault(state)
  if (!core || core.revealed !== true || inv.location !== core.id) return false
  const required = VAULT_CORE_INTERLUDE.clueCostPerInvestigator * investigatorCount(state)
  if (groupCluesAt(state, core.id) < required) return false
  spendGroupClues(state, core.id, required)
  const choose = typeof api.choose === 'function' ? api.choose : () => 'pushTheButton'
  const choice = choose({
    kind: 'story', source: '11595', seat: inv.seat, canSkip: false,
    prompt: VAULT_CORE_INTERLUDE.title,
    options: [
      { id: 'pushTheButton', label: VAULT_CORE_INTERLUDE.pushTheButton },
      { id: 'leaveItAlone', label: VAULT_CORE_INTERLUDE.leaveItAlone },
    ],
  }) || 'pushTheButton'
  if (choice === 'pushTheButton') {
    recordsFor(state).theInnerSanctumWasUnsealed = true
    info(api, '秘库核心：按下按钮，记录「内殿已解封」。')
  } else {
    for (const each of activeInvestigators(state)) {
      if (typeof api.addScenarioXpBonus === 'function') api.addScenarioXpBonus(each.seat, 1)
      else each.scenarioXpBonus = (Number(each.scenarioXpBonus) || 0) + 1
    }
    info(api, '秘库核心：不碰它，每位调查员获得 1 点奖励经验。')
  }
  setFlag(state, 'grandVaultCoreInterlude', choice)
  return true
}

// ---------------------------------------------------------------------------
// 行动（移动平台交换 / 激活腔室 / 幕间 / 翻译符文）
// ---------------------------------------------------------------------------
export function actions(state, inv) {
  if (!inv || inv.defeated || inv.resigned) return []
  const here = locationOf(state, inv.location)
  if (!here) return []
  const moves = []
  const vaultHere = hasTrait(here, VAULT_TRAIT)
  // 移动平台 [fast]：共同花费 1[per_investigator] 线索，与一处相邻[[秘库]]地点交换位置。
  if (here.id === 'movingPlatform') {
    const adjacentVaults = (here.connections || [])
      .map(id => locationOf(state, id)).filter(loc => loc && hasTrait(loc, VAULT_TRAIT))
    const required = investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    if (adjacentVaults.length) {
      moves.push({
        action: 'scenarioAction', rule: 'grandVaultSwapPlatform', locationId: here.id, actions: 0,
        label: `共同花费 ${required} 个线索：将移动平台与一处相邻[[秘库]]地点交换位置`,
        targets: adjacentVaults.map(loc => ({ id: loc.id, label: loc.name })),
        reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
      })
    }
  }
  // 秘库腔室激活 [action]。
  if (vaultHere && !isActivated(state, here.id) && flagValue(here, 'activationCost')) {
    moves.push({
      action: 'scenarioAction', rule: 'grandVaultActivateLocation', locationId: here.id, actions: 1,
      label: `激活「${here.name}」（${activationCostLabel(here)}）`,
    })
  }
  // 秘库核心幕间 [action][action]（3[per_investigator] 线索）。
  if (here.id === 'coreOfTheVault' && here.revealed === true) {
    const required = VAULT_CORE_INTERLUDE.clueCostPerInvestigator * investigatorCount(state)
    const available = groupCluesAt(state, here.id)
    moves.push({
      action: 'scenarioAction', rule: 'grandVaultStudyMachine', locationId: here.id, actions: 2,
      label: `共同花费 ${required} 个线索：研究机器，进入幕间「秘库核心」`,
      reason: available >= required ? null : `需要本地点共 ${required} 个线索（现有 ${available}）`,
    })
  }
  // 档案室/双面陷阱：翻译符文（最后线索后已可自主触发；这里提供显式行动便于手动结算）。
  if (flagIs(codeOf(here), 'glyphChamber') && here.clues === 0 && !isGlyphTranslated(state, GLYPH_RECORDS[codeOf(here)]?.rune)) {
    moves.push({
      action: 'scenarioAction', rule: 'grandVaultTranslateGlyph', locationId: here.id, actions: 0,
      label: `发现本地点印刷的符文（${GLYPH_RECORDS[codeOf(here)]?.rune}）`,
    })
  }
  // 11608/11609/11610 古代秘库：翻译已附属的符文诡计（[action]，费用按印刷；X = 附属地点隐藏值/shroud）。
  const attachedAncientVault = (here.attachments || [])
    .map(attachment => codeOf(attachment))
    .find(code => ANCIENT_VAULT_CODES.includes(code))
  if (attachedAncientVault && !isGlyphTranslated(state, GLYPH_RECORDS[attachedAncientVault]?.rune)) {
    const hidden = hiddenValueOf(here)
    const cost = ancientVaultCostCheck(state, inv, attachedAncientVault, hidden)
    moves.push({
      action: 'scenarioAction', rule: 'grandVaultTranslateAncientVault', locationId: here.id,
      code: attachedAncientVault, hidden, actions: 1,
      label: `翻译已附属的古代秘库「${ALL_CARDS[attachedAncientVault]?.nameZh || attachedAncientVault}」（隐藏值 ${hidden}；${cost.label}）`,
      reason: cost.reason || null,
    })
  }
  return moves
}

/** 地点隐藏值 = 印刷 shroud（GV 没有 shroud 修正；11608/09/10 的 X）。 */
export function hiddenValueOf(location) {
  return Math.max(0, Number(location?.shroud) || 0)
}
function printedResourceCost(asset) {
  return Math.max(0, Number(ALL_CARDS[codeOf(asset)]?.cost) || 0)
}
function ancientVaultCostCheck(state, inv, code, hidden) {
  if (code === '11608') {
    const total = (inv.assets || []).reduce((sum, asset) => sum + printedResourceCost(asset), 0)
    return total >= hidden
      ? { label: `弃掉印刷资源费用合计 ≥ ${hidden} 的支援` }
      : { label: `弃掉印刷资源费用合计 ≥ ${hidden} 的支援`, reason: `游戏区域支援的印刷资源费用合计仅 ${total}，需要 ≥ ${hidden}` }
  }
  if (code === '11610') {
    const cards = (inv.hand || []).length
    return cards >= hidden
      ? { label: `选择并弃掉手牌 ${hidden} 张` }
      : { label: `选择并弃掉手牌 ${hidden} 张`, reason: `手牌仅 ${cards} 张，需要 ≥ ${hidden}` }
  }
  return { label: `受到合计 ${hidden} 点伤害和/或恐惧` }
}

function flagValue(location, key) {
  return registeredEntry(codeOf(location))?.flags?.[key]
}
function activationCostLabel(location) {
  const cost = flagValue(location, 'activationCost')
  if (cost === 'discard3') return '选择并弃掉手牌中的 3 张卡牌'
  if (cost === 'damageHorror') return '受到 1 点伤害和 1 点恐惧'
  if (cost === 'resources5') return '花费 5 个资源'
  if (cost === 'revealTop3') return '揭示牌库顶 3 张'
  if (cost === 'cistern') return '打开新通道并提高一处[[秘库]]的淹没等级'
  return '支付卡面费用'
}

export function performAction(state, inv, move, api = {}) {
  if (!move || !inv || inv.defeated || inv.resigned) return false
  if (move.rule === 'grandVaultSwapPlatform') return swapPlatform(state, inv, move, api)
  if (move.rule === 'grandVaultActivateLocation') return activateChamberAction(state, inv, move, api)
  if (move.rule === 'grandVaultStudyMachine') return vaultCoreInterlude(state, inv, api)
  if (move.rule === 'grandVaultTranslateGlyph') {
    const code = codeOf(locationOf(state, inv.location))
    return translateGlyph(state, code, api)
  }
  if (move.rule === 'grandVaultTranslateAncientVault') return translateAncientVaultAction(state, inv, move, api)
  return false
}

/** 11608/11609/11610：翻译已附属的古代秘库（按印刷支付费用 → 翻面并翻译符文、背面加入胜利区）。 */
export function translateAncientVaultAction(state, inv, move, api = {}) {
  const here = locationOf(state, inv.location)
  if (!here) return false
  const code = String(move?.code || '')
  if (!ANCIENT_VAULT_CODES.includes(code)) return false
  if (isGlyphTranslated(state, GLYPH_RECORDS[code]?.rune)) return false
  const attachment = (here.attachments || []).find(item => codeOf(item) === code)
  if (!attachment) return false
  const hidden = Number.isInteger(move?.hidden) ? move.hidden : hiddenValueOf(here)
  if (code === '11608' && !payAssetResourceCost(state, inv, hidden, api)) return false
  if (code === '11609' && !payDamageHorrorCost(state, inv, hidden, api)) return false
  if (code === '11610' && !payHandCardsCost(state, inv, hidden, api)) return false
  here.attachments = (here.attachments || []).filter(item => item !== attachment)
  info(api, `「${ALL_CARDS[code]?.nameZh || code}」翻面并结算其文本。`)
  return translateGlyph(state, code, api)
}

/** 11608 费用：选择并弃掉游戏区域中印刷资源费用合计 ≥ X 的支援。 */
function payAssetResourceCost(state, inv, required, api = {}) {
  const candidates = (inv.assets || []).filter(asset => printedResourceCost(asset) > 0)
  const picked = []
  let total = 0
  while (total < required) {
    const remaining = candidates.filter(asset => !picked.includes(asset))
    if (!remaining.length) return false
    let choice = remaining[0]
    if (typeof api.choose === 'function') {
      const pickedId = api.choose({
        kind: 'asset', source: '11608', seat: inv.seat, canSkip: false,
        prompt: `选择并弃掉支援（印刷资源费用合计至少 ${required}，已选 ${total}）。`,
        options: remaining.map(asset => ({ id: asset.id, label: `${ALL_CARDS[codeOf(asset)]?.nameZh || codeOf(asset)}（资源 ${printedResourceCost(asset)}）` })),
      })
      choice = remaining.find(asset => asset.id === pickedId) || remaining[0]
    }
    picked.push(choice)
    total += printedResourceCost(choice)
  }
  for (const asset of picked) discardControlledAsset(state, inv, asset, api)
  return true
}

function discardControlledAsset(state, inv, asset, api = {}) {
  if (typeof api.discardAsset === 'function' && api.discardAsset(inv.seat, asset) !== false) return true
  const index = (inv.assets || []).indexOf(asset)
  if (index < 0) return false
  inv.assets.splice(index, 1)
  inv.discard ||= []
  inv.discard.push(codeOf(asset))
  return true
}

/** 11609 费用：受到合计 X 点伤害和/或恐惧（逐点选择分配）。 */
function payDamageHorrorCost(state, inv, required, api = {}) {
  let damage = 0
  let horror = 0
  for (let index = 0; index < required; index += 1) {
    let pick = 'damage'
    if (typeof api.choose === 'function') {
      pick = api.choose({
        kind: 'effect', source: '11609', seat: inv.seat, canSkip: false,
        prompt: `受到第 ${index + 1}/${required} 点：伤害还是恐惧？`,
        options: [{ id: 'damage', label: '伤害' }, { id: 'horror', label: '恐惧' }],
      }) || 'damage'
    }
    if (pick === 'horror') horror += 1
    else damage += 1
  }
  if (damage > 0) {
    if (typeof api.damage === 'function') api.damage(inv.seat, damage)
    else inv.damage = (Number(inv.damage) || 0) + damage
  }
  if (horror > 0) {
    if (typeof api.horror === 'function') api.horror(inv.seat, horror)
    else inv.horror = (Number(inv.horror) || 0) + horror
  }
  return true
}

/** 11610 费用：选择并弃掉手牌 X 张（与 11593 激活费用共用同一份弃手牌实现）。 */
function payHandCardsCost(state, inv, required, api = {}) {
  if ((inv.hand || []).length < required) return false
  return discardFromHand(state, inv, required, api) === required
}

export function swapPlatform(state, inv, move, api = {}) {
  const platform = locationOf(state, 'movingPlatform')
  if (!platform) return false
  const required = investigatorCount(state)
  if (groupCluesAt(state, platform.id) < required) return false
  const targets = (move?.targets || [])
    .map(target => locationOf(state, target.id)).filter(Boolean)
  if (!targets.length) return false
  const target = typeof api.choose === 'function'
    ? targets.find(loc => loc.id === api.choose({
      kind: 'location', source: '11594', seat: inv.seat,
      prompt: '选择一处相邻[[秘库]]地点与移动平台交换位置。',
      options: targets.map(loc => ({ id: loc.id, label: loc.name })),
    })) || targets[0]
    : targets[0]
  spendGroupClues(state, platform.id, required)
  const changes = swappedCells(state, platform.id, target.id)
  if (!changes) return false
  let moved = false
  if (typeof api?.mechanics?.map?.relocate === 'function') moved = api.mechanics.map.relocate(changes)
  else moved = relocateGridCells(state, changes)
  if (!moved) return false
  syncConnections(state)
  info(api, `移动平台与「${target.name}」交换位置（地点上的卡牌与标记随地点保留）。`)
  return true
}

function discardFromHand(state, inv, count, api) {
  const hand = inv.hand || []
  let discarded = 0
  while (discarded < count && hand.length) {
    let index = 0
    if (typeof api?.choose === 'function') {
      const picked = api.choose({
        kind: 'card', source: 'discardFromHand', seat: inv.seat, canSkip: false,
        prompt: `选择并弃掉手牌中的 1 张卡牌（${discarded + 1}/${count}）。`,
        options: hand.map((code, handIndex) => ({ id: String(handIndex), cardCode: code, label: ALL_CARDS[code]?.nameZh || code })),
      })
      const found = Number(picked)
      if (Number.isInteger(found) && found >= 0 && found < hand.length) index = found
    }
    const [code] = hand.splice(index, 1)
    inv.discard ||= []
    inv.discard.push(code)
    discarded += 1
  }
  return discarded
}

export function activateChamberAction(state, inv, move, api = {}) {
  const here = locationOf(state, inv.location)
  if (!here || isActivated(state, here.id)) return false
  const cost = flagValue(here, 'activationCost')
  if (cost === 'discard3') {
    if ((inv.hand || []).length < 3) return false
    discardFromHand(state, inv, 3, api)
  } else if (cost === 'damageHorror') {
    if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (Number(inv.damage) || 0) + 1
    if (typeof api.horror === 'function') api.horror(inv.seat, 1)
    else inv.horror = (Number(inv.horror) || 0) + 1
  } else if (cost === 'resources5') {
    if ((Number(inv.resources) || 0) < 5) return false
    if (typeof api.spendResources === 'function') api.spendResources(inv.seat, 5)
    else inv.resources -= 5
  } else if (cost === 'revealTop3') {
    revealTopThree(state, inv, api)
  } else if (cost === 'cistern') {
    // 隐蔽蓄水池：激活本地点，然后提高任意一处符合条件[[秘库]]地点的淹没等级。
    activateLocation(state, here.id, api)
    const candidates = (state.locations || [])
      .filter(loc => loc.id !== here.id && hasTrait(loc, VAULT_TRAIT) && !locationCannotFlood(state, loc.id) && floodLevel(state, loc.id) < 2)
    const picked = typeof api.choose === 'function'
      ? api.choose({
        kind: 'location', source: codeOf(here), seat: inv.seat, canSkip: true,
        prompt: '选择一处符合条件的[[秘库]]地点提高淹没等级。',
        options: candidates.map(loc => ({ id: loc.id, label: loc.name })),
      })
      : candidates[0]?.id
    const target = candidates.find(loc => loc.id === picked) || candidates[0]
    if (target) increaseFloodLevel(state, target.id, api)
    return true
  } else if (cost) return false
  activateLocation(state, here.id, api)
  void move
  return true
}

function revealTopThree(state, inv, api = {}) {
  const deck = Array.isArray(inv.deck) ? inv.deck : []
  const top = deck.splice(Math.max(0, deck.length - 3), 3)
  inv.hand ||= []
  for (const code of top) {
    const card = ALL_CARDS[code] || {}
    if (card.subtype === 'basicweakness' || card.type === 'weakness') inv.hand.push(code)
    else (state.removedFromGame ||= []).push(code)
  }
  info(api, `揭示牌库顶 ${top.length} 张：弱点抽取，其余移出游戏。`)
}

// ---------------------------------------------------------------------------
// 调查后（最后一个线索 → 碑匾 / 符文）
// ---------------------------------------------------------------------------
export function afterInvestigate(state, inv, location, result, api = {}) {
  if (!location || !result?.success) return false
  if ((Number(location.clues) || 0) > 0) return false
  const code = codeOf(location)
  if (location.id === SEALED_CHAMBER_ID) {
    if (flagsFor(state).grandVaultTabletFound) return false
    setFlag(state, 'grandVaultTabletFound', true)
    const candidates = (state.investigators || []).filter(each => each.location === location.id && !each.defeated)
    const seat = candidates.length && typeof api.choose === 'function'
      ? api.choose({
        kind: 'investigator', source: '11604', seat: inv.seat, canSkip: false,
        prompt: '选择该地点一位调查员控制放在一边的潮汐碑匾。',
        options: candidates.map(each => ({ id: String(each.seat), label: each.name })),
      })
      : (candidates[0]?.seat ?? inv.seat)
    giveTidalTablet(state, Number(seat) || inv.seat, api)
    return true
  }
  if (flagIs(code, 'glyphChamber')) return translateGlyph(state, code, api)
  return false
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------
export function allUndefeatedResigned(state) {
  const alive = activeInvestigators(state)
  return alive.length === 0 && (state.investigators || []).some(inv => inv.resigned)
}

export function currentActCode(state) {
  const act = (state.acts || [])[state.actIndex ?? 0]
  return codeOf(act)
}
export function currentAgendaCode(state) {
  const agenda = (state.agendas || [])[state.agendaIndex ?? 0]
  return codeOf(agenda)
}
function agendaFrontCode(state) {
  const agenda = (state.agendas || [])[state.agendaIndex ?? 0]
  if (!agenda || agenda.face === 'back') return null
  const code = codeOf(agenda)
  return [AGENDA1_CODE, AGENDA2_CODE, AGENDA3_CODE].includes(code) ? code : null
}

export function roundEnded(state, api = {}) {
  let advanced = false
  if (currentActCode(state) === ACT1_CODE && tidalTabletControlledBy(state)) {
    info(api, '幕 1 目标达成（轮末且一位调查员控制潮汐碑匾）：推进幕 1。')
    advanced = advanceAct(state, api) || true
  }
  maybeRevealCore(state, api)
  return advanced
}

function advanceAct(state, api = {}) {
  if (typeof api.advanceAct === 'function') { api.advanceAct(); return true }
  const act = (state.acts || [])[state.actIndex]
  if (act) actReveal(state, act, api)
  state.actIndex = Number(state.actIndex || 0) + 1
  return true
}

export function checkObjectives(state, api = {}) {
  if (state.status && state.status !== 'playing') return false
  if (currentActCode(state) === ACT2_CODE && allUndefeatedResigned(state) && !flagsFor(state).grandVaultAct2Advancing) {
    setFlag(state, 'grandVaultAct2Advancing', true)
    info(api, '所有未被击败的调查员都已撤退：推进幕 2。')
    advanceAct(state, api)
    return true
  }
  return false
}

export function allResigned(state, api = {}) {
  return checkObjectives(state, api)
}

export function actReveal(state, act, api = {}) {
  const code = codeOf(act)
  if (code === ACT1_CODE) return act1Back(state, api)
  if (code === ACT2_CODE) return act2Back(state, api)
  return false
}

function act1Back(state, api = {}) {
  // Tablet of the Tides：提高每处可提高地点的淹没等级；在每处没有胜利 X 的已揭示[[秘库]]
  // 地点上放置线索直到线索目标值（Haskell Act 11591 背面）。
  let flooded = 0
  for (const loc of state.locations || []) {
    if (increaseFloodLevel(state, loc.id, api)) flooded += 1
  }
  let restocked = 0
  for (const loc of state.locations || []) {
    if (loc.revealed !== true || !hasTrait(loc, VAULT_TRAIT)) continue
    if (Number(loc.victory) > 0) continue
    loc.clues = Math.max(Number(loc.clues) || 0, Number(loc.maxClues) || 0)
    restocked += 1
  }
  info(api, `幕 1 背面（潮汐碑匾）：${flooded} 处地点淹没等级提高，${restocked} 处[[秘库]]地点补满线索。`)
  return true
}

function act2Back(state, api = {}) {
  const records = recordsFor(state)
  const headedWest = records.theExpeditionHeadedWest === true
  const key = headedWest ? 'resolution1' : 'resolution2'
  info(api, `幕 2 背面：远征队${headedWest ? '向西' : '向东'} → 结局 ${headedWest ? 1 : 2}。`)
  if (typeof api.finish === 'function') { api.finish(key); return true }
  state.resolution = key
  return true
}

export function agendaReveal(state, agenda, api = {}) {
  const code = codeOf(agenda)
  if (code === AGENDA1_CODE) return agenda1Back(state, api)
  if (code === AGENDA2_CODE) return agenda2Back(state, api)
  if (code === AGENDA3_CODE) return agenda3Back(state, api)
  return false
}

function findStillBehindYou(state) {
  const codes = new Set(INESCAPABLE_SET_CODES)
  const pools = [
    ...((state.encounterDeck || []).map((code, index) => ({ code, pile: 'encounterDeck', index }))),
    ...((state.encounterDiscard || []).map((code, index) => ({ code, pile: 'encounterDiscard', index }))),
    ...((state.scenarioZones?.setAside || []).map((code, index) => ({ code, pile: 'setAside', index }))),
    ...((state.removedFromGame || []).map((code, index) => ({ code, pile: 'removedFromGame', index }))),
  ]
  return pools.filter(item => codes.has(String(item.code)) && ALL_CARDS[item.code]?.type === 'treachery')
}

function removeFromPile(state, item) {
  const list = item.pile === 'encounterDeck' ? (state.encounterDeck ||= [])
    : item.pile === 'encounterDiscard' ? (state.encounterDiscard ||= [])
      : item.pile === 'setAside' ? (state.scenarioZones.setAside ||= [])
        : (state.removedFromGame ||= [])
  const index = list.indexOf(item.code)
  if (index >= 0) list.splice(index, 1)
  return item.code
}

function agenda1Back(state, api = {}) {
  // 生成放一边的穷途异魔到队长地点 → 敏捷(4) 检定 → 成功解除交战并横置。
  const zones = state.scenarioZones ||= {}
  const aside = Array.isArray(zones.setAside) ? zones.setAside : []
  const inescapableIndex = aside.indexOf('11744')
  const leadSeat = state.campaign?.leadSeat ?? state.currentSeat ?? 0
  const lead = (state.investigators || [])[leadSeat]
  let spawned = null
  if (inescapableIndex >= 0 && lead) {
    aside.splice(inescapableIndex, 1)
    spawned = spawnEnemy(state, '11744', lead.location, api)
  }
  const stowaways = findStillBehindYou(state)
  const shuffled = [...stowaways.map(item => removeFromPile(state, item)), ...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  const starSpawnAside = (aside.filter(code => STAR_SPAWN_ENEMY_CODES.includes(String(code))))
  const extraStar = starSpawnAside.length ? [starSpawnAside[0]] : []
  if (extraStar.length) aside.splice(aside.indexOf(extraStar[0]), 1)
  state.encounterDeck = shuffleWith(api, [...(state.encounterDeck || []), ...shuffled, ...extraStar])
  if (spawned && lead) {
    if (typeof api.test === 'function') {
      api.test(lead.seat, 'agility', 4, result => {
        if (!result?.success) return
        spawned.exhausted = true
        spawned.engagedSeat = null
        info(api, '敏捷检定成功：穷途异魔与每位调查员解除交战并横置。')
      })
    }
  }
  info(api, `议程 1 背面：生成穷途异魔；${shuffled.length} 张「仍在你身后」与遭遇弃牌堆洗回遭遇牌库。`)
  return true
}

function agenda2Back(state, api = {}) {
  // 查找所有区域里的「仍在你身后」；移动未交战的持久构造体到移动平台；治愈并移动穷途异魔。
  const still = findStillBehindYou(state).map(item => removeFromPile(state, item))
  state.encounterDeck = shuffleWith(api, [...(state.encounterDeck || []), ...still])
  const platform = locationOf(state, 'movingPlatform')
  let moved = 0
  for (const enemy of state.enemies || []) {
    if (String(enemy.originalCode || enemy.code) !== '11751') continue
    if (enemy.engagedSeat != null) continue
    if (!platform) break
    enemy.location = platform.id
    enemy.exhausted = true
    moved += 1
  }
  const inescapable = (state.enemies || []).find(enemy => String(enemy.originalCode || enemy.code) === '11744')
  if (inescapable) {
    inescapable.damageTaken = Math.max(0, (Number(inescapable.damageTaken) || 0) - investigatorCount(state))
  }
  info(api, `议程 2 背面：${still.length} 张「仍在你身后」洗回牌库；${moved} 名持久构造体移到移动平台。`)
  return true
}

function agenda3Back(state, api = {}) {
  let count = 0
  for (const inv of activeInvestigators(state)) {
    if (typeof api.addTrauma === 'function') api.addTrauma(inv.seat, 'physical', 1)
    else {
      state.campaign ||= {}
      state.campaign.trauma ||= {}
      state.campaign.trauma[inv.seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[inv.seat].physical += 1
    }
    if (typeof api.defeat === 'function') api.defeat(inv, 'physical')
    else { inv.defeated = true; inv.defeatCause = 'physical' }
    count += 1
  }
  info(api, `议程 3 背面：${count} 位调查员被击败并承受 1 点肉体创伤（无结局）。`)
  return true
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------
export function enemyDefinitionFor(code) {
  return scenario.enemies?.[code] || encounterDefinitions([code]).enemies[code] || ALL_CARDS[code] || {}
}

export function spawnEnemy(state, code, locationId, api = {}, options = {}) {
  if (typeof api.spawn === 'function') return api.spawn(code, locationId, options)
  const def = enemyDefinitionFor(code)
  const enemy = {
    id: `${CHAPTER_ID}-${code}-${(state.enemies || []).length + 1}`, code, originalCode: code,
    name: def.nameZh || def.name || code, location: locationId,
    fight: def.fight ?? 0, evade: def.evade ?? 0, health: def.health ?? 1,
    damage: def.damage || 0, horror: def.horror || 0, traits: [...(def.traits || [])],
    exhausted: false, engagedSeat: options.engagedSeat ?? null, damageTaken: 0,
    doom: 0, clues: 0, attachments: [], victory: Number(def.victory) || 0,
  }
  state.enemies ||= []
  state.enemies.push(enemy)
  return enemy
}

export function enemyStatModifier(state, enemy, stat) {
  if (!enemy || stat !== 'health') return 0
  if (String(enemy.originalCode || enemy.code) !== '11744') return 0
  const agenda = agendaFrontCode(state)
  const stages = state.scenario?.stageCards || {}
  const stage = stages[agenda]
  const per = Number(stage?.inescapableHealthPerInvestigator) || 0
  return per > 0 ? per * investigatorCount(state) : 0
}

export function enemyConnections(state, enemy, location) {
  if (!enemy || !location) return []
  const code = String(enemy.originalCode || enemy.code)
  // 11606 秘库随从：以其猎手关键词移动时，所在地点视为与每处已激活地点相连
  // （读点 turn.js/movement.js 的 hunter 寻路；只影响该敌人自己的距离计算）。
  if (code === '11606') {
    return activatedLocationIds(state).filter(id => id !== location.id)
  }
  if (code !== '11744') return []
  const agenda = agendaFrontCode(state)
  const stages = state.scenario?.stageCards || {}
  if (!stages[agenda]?.inescapableHunterAdjacent && !AGENDA_STAGES[2]?.inescapableHunterAdjacent) return []
  if (agenda !== AGENDA2_CODE && agenda !== AGENDA3_CODE) return []
  // 「以其猎手关键词移动时，每处地点视为与每处相邻地点相连」→ 返回网格上正交相邻的地点。
  const cell = gridPositionFrom(state, location.id)
  if (!cell) return []
  return [[0, -1], [-1, 0], [1, 0], [0, 1]]
    .map(([x, y]) => locationIdAtCell(state, { x: cell.x + x, y: cell.y + y }))
    .filter(id => id && id !== location.id)
}

export function locationShroudModifier(state, location) {
  if (!location) return 0
  // 碑匾腔室/秘库核心没有隐藏值修正；预留读点给单卡条目（当前返回 0）。
  void state
  return 0
}

// ---------------------------------------------------------------------------
// 未揭示地点的进入限制（11595 秘库核心 / 11604 封印腔室：调查员不能进入）
// 读点：engine moves.js / moves.js legalMoves 调 scenarioBehavior.moveError。
// ---------------------------------------------------------------------------
export function moveError(state, inv, target, neighborId) {
  void inv
  const destination = target?.id || neighborId
  if (destination !== 'coreOfTheVault' && destination !== SEALED_CHAMBER_ID) return null
  const loc = locationOf(state, destination)
  if (!loc || loc.revealed !== false) return null
  return `「${loc.name}」尚未揭示，调查员不能进入。`
}

// ---------------------------------------------------------------------------
// 敌人被击败时的章内强制（11595 秘库核心：穷途异魔在本地点被击败）
// ---------------------------------------------------------------------------
export function removeStillBehindYouCopies(state) {
  const setAsideTreacheries = new Set(['11745'])
  const removed = []
  for (const pile of ['encounterDeck', 'encounterDiscard', 'removedFromGame']) {
    const list = state[pile]
    if (!Array.isArray(list)) continue
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (setAsideTreacheries.has(String(list[index]))) { removed.push(list.splice(index, 1)[0]) }
    }
  }
  const zones = state.scenarioZones ||= {}
  if (Array.isArray(zones.setAside)) {
    for (let index = zones.setAside.length - 1; index >= 0; index -= 1) {
      if (setAsideTreacheries.has(String(zones.setAside[index]))) { removed.push(zones.setAside.splice(index, 1)[0]) }
    }
  }
  for (const inv of state.investigators || []) {
    if (!Array.isArray(inv.threat)) continue
    for (let index = inv.threat.length - 1; index >= 0; index -= 1) {
      const code = codeOf(inv.threat[index])
      if (setAsideTreacheries.has(code)) { removed.push(code); inv.threat.splice(index, 1) }
    }
  }
  for (const location of state.locations || []) {
    if (!Array.isArray(location.attachments)) continue
    for (let index = location.attachments.length - 1; index >= 0; index -= 1) {
      const code = codeOf(location.attachments[index])
      if (setAsideTreacheries.has(code)) { removed.push(code); location.attachments.splice(index, 1) }
    }
  }
  return removed
}

/** 11595 背面强制：穷途异魔在（已揭示的）秘库核心被击败 → 移出所有「仍在你身后」并记录。 */
export function enemyDefeated(state, enemy, api = {}) {
  if (!enemy) return false
  if (String(enemy.originalCode || enemy.code) !== '11744') return false
  const core = coreOfVault(state)
  if (!core || core.revealed !== true || enemy.location !== core.id) return false
  const removed = removeStillBehindYouCopies(state)
  recordsFor(state).theCreatureWasDefeated = true
  setFlag(state, 'grandVaultCreatureDefeated', true)
  info(api, `穷途异魔在秘库核心被击败：${removed.length} 张「仍在你身后」移出游戏；记录「该生物被击败了」。`)
  // 返回 false：敌人本身仍按常规结算（胜利区/弃牌去向），只接管印刷强制效果。
  return false
}

/**
 * 敌军阶段开始时的章内强制（11605 黑暗中的滑行者）：
 * 若其所在地点没有调查员 → 攻击一处连接地点[战斗]最低的调查员；若未攻击 →
 * 直接移动到距离移动平台最近的淹没地点。
 */
export function enemyPhaseStart(state, api = {}) {
  let handled = 0
  for (const enemy of state.enemies || []) {
    if (enemy.defeated) continue
    if (String(enemy.originalCode || enemy.code) !== '11605') continue
    const location = locationOf(state, enemy.location)
    if (!location) continue
    if ((state.investigators || []).some(inv => !inv.defeated && !inv.resigned && inv.location === location.id)) continue
    const candidates = (state.investigators || [])
      .filter(inv => !inv.defeated && !inv.resigned && (location.connections || []).includes(inv.location))
      .sort((left, right) => Number(left.combat ?? 0) - Number(right.combat ?? 0))
    const target = candidates[0]
    if (target && typeof api.attack === 'function') {
      api.attack(enemy, target)
      handled += 1
      continue
    }
    const destination = nearestFloodedToMovingPlatform(state, enemy.location)
    if (destination) {
      if (typeof api.moveEnemy === 'function') api.moveEnemy(enemy, destination)
      else enemy.location = destination
      info(api, `黑暗中的滑行者移动到最近的淹没地点「${locationOf(state, destination)?.name || destination}」。`)
      handled += 1
    }
  }
  return handled > 0
}

/** 距离「移动平台」最近的淹没地点（BFS，距离按地点连接；并列取先找到的）。 */
export function nearestFloodedToMovingPlatform(state, fromId) {
  const anchor = locationOf(state, 'movingPlatform')
  return nearestFloodedTo(state, anchor?.id || fromId)
}

/** 从 fromId 出发最近的淹没地点（含 fromId 自身；BFS 按地点连接）。 */
export function nearestFloodedTo(state, fromId) {
  if (!fromId) {
    const any = (state.locations || []).find(loc => floodLevel(state, loc.id) > 0)
    return any?.id || null
  }
  if (floodLevel(state, fromId) > 0) return fromId
  const seen = new Set([fromId])
  let frontier = [...(locationOf(state, fromId)?.connections || [])]
  while (frontier.length) {
    const next = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      const candidate = locationOf(state, id)
      if (!candidate) continue
      if (floodLevel(state, id) > 0) return id
      for (const neighbor of candidate.connections || []) if (!seen.has(neighbor)) next.push(neighbor)
    }
    frontier = next
  }
  const anyFlooded = (state.locations || []).find(loc => floodLevel(state, loc.id) > 0)
  return anyFlooded?.id || null
}

/** 猎物：线索最多的存活调查员（并列取更靠前的座位）。 */
export function mostCluesInvestigator(state) {
  const candidates = (state.investigators || [])
    .filter(inv => inv && !inv.defeated && !inv.resigned)
    .slice()
    .sort((left, right) => (Number(right.clues) || 0) - (Number(left.clues) || 0) || left.seat - right.seat)
  return candidates[0] || null
}

/**
 * 生成落点钩子（PRIMITIVES.md 已落地的既有引擎读点）：
 *   scenarioBehavior.spawnLocation(state, code, defaultLocation, engagedSeat, api) → 地点 id。
 * 11605「生成 - 最近的淹没地点」；11606「生成 - 与猎物交战」（落点 = 猎物所在地点，
 * 交战在 enemySpawned 里对猎物补一次 engage）。
 */
export function spawnLocation(state, code, defaultLocation, engagedSeat, api = {}) {
  void engagedSeat
  void api
  const cardCode = String(code)
  if (cardCode === '11605') {
    const anchor = defaultLocation
      || (Number.isInteger(engagedSeat) ? (state.investigators || [])[engagedSeat]?.location : null)
      || 'movingPlatform'
    const flooded = nearestFloodedTo(state, anchor)
    return flooded || defaultLocation
  }
  if (cardCode === '11606') {
    const prey = mostCluesInvestigator(state)
    return prey?.location || defaultLocation
  }
  return defaultLocation
}

/** 生成后钩子：11606 与猎物交战（同一地点时补 engage；引擎随后也会按 engagedSeat 处理）。 */
export function enemySpawned(state, enemy, api = {}) {
  if (!enemy) return false
  if (String(enemy.originalCode || enemy.code) !== '11606') return false
  if (enemy.engagedSeat != null) return false
  const prey = mostCluesInvestigator(state)
  if (!prey || prey.location !== enemy.location) return false
  if (typeof api.engage === 'function') api.engage(enemy, prey.seat)
  else enemy.engagedSeat = prey.seat
  info(api, `秘库随从与猎物「${prey.name}」（线索最多者）交战。`)
  return true
}

// ---------------------------------------------------------------------------
// 混乱标记
// ---------------------------------------------------------------------------
export function resolveChaosToken(state, inv, token) {
  return grandVaultChaosToken(state, inv, token)
}
export function chaosTokenValue(state, tokenFace) {
  return grandVaultChaosToken(state, tokenFace)?.delta ?? null
}

export function applyTokenEffect(state, inv, effect, api = {}) {
  if (!inv || !effect) return false
  const mode = effect.mode
  if (mode === 'deactivateOrHarm' || mode === 'deactivateOrHarmHard') {
    const here = locationOf(state, inv.location)
    const options = []
    if (here && isActivated(state, here.id)) options.push({ id: 'deactivate', label: '使你所在地点失活' })
    options.push({ id: 'damage', label: '受到 1 点伤害' })
    if (mode === 'deactivateOrHarm') options.push({ id: 'horror', label: '受到 1 点恐惧' })
    const choice = typeof api.choose === 'function'
      ? api.choose({ kind: 'token', source: '11587-token', seat: inv.seat, prompt: '[cultist]：选择一项。', options })
      : (options[0]?.id || 'damage')
    if (choice === 'deactivate' && here) return deactivateLocation(state, here.id, api)
    if (choice === 'horror') {
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
      return true
    }
    if (typeof api.damage === 'function') api.damage(inv.seat, 1)
    else inv.damage = (Number(inv.damage) || 0) + 1
    if (mode === 'deactivateOrHarmHard') {
      if (typeof api.horror === 'function') api.horror(inv.seat, 1)
      else inv.horror = (Number(inv.horror) || 0) + 1
    }
    return true
  }
  if (mode === 'searchStillBehindYou' || mode === 'drawStillBehindYou') {
    const candidates = (state.encounterDiscard || [])
      .map((code, index) => ({ code, index }))
      .filter(item => INESCAPABLE_SET_CODES.includes(String(item.code)) && ALL_CARDS[item.code]?.type === 'treachery')
    if (!candidates.length) {
      info(api, `[elder_thing]：遭遇弃牌堆里没有「仍在你身后」。`)
      return false
    }
    const found = candidates[candidates.length - 1]
    if (mode === 'searchStillBehindYou') {
      state.encounterDiscard.splice(found.index, 1)
      state.victoryDisplay ||= []
      state.victoryDisplay.push({
        id: `stillBehindYou-${found.code}`, code: found.code, originalCode: found.code,
        name: ALL_CARDS[found.code]?.nameZh || found.code, victory: 0,
      })
      info(api, '[elder_thing]：「仍在你身后」加入胜利区。')
      return true
    }
    state.encounterDiscard.splice(found.index, 1)
    state.encounterDeck ||= []
    state.encounterDeck.push(found.code)
    if (typeof api.drawEncounter === 'function') api.drawEncounter(inv.seat)
    info(api, '[elder_thing]：抽取「仍在你身后」。')
    return true
  }
  return false
}

export function testAutoFail() { return false }

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------
export function resolution(state, key, events, api = {}) {
  void events
  const records = recordsFor(state)
  records.rlyehMap ||= []
  if (!records.rlyehMap.includes(CHAPTER_ID)) records.rlyehMap.push(CHAPTER_ID)
  if (tidalTabletControlledBy(state)) records.tidalTablet = true
  resolveGoodMoney(state, api)
  setFlag(state, 'grandVaultResolution', key)
  return { award: true }
}

// ---------------------------------------------------------------------------
// Good Money「下一章维护阶段不能获得资源」（campaignRuleFlag 跨章标记）
// 口径统一：读点复用 content/campaigns/theDrownedCity/campaign-rules.js 的
// `tdcCannotGainUpkeepResources(state, inv)`（按 appliesToScenarioIndex + seats 判定；
// 越章后的 stale 标记无害，无需 preScenarioSetup 清理）。本文件只负责「写标记」。
// ---------------------------------------------------------------------------
export function noUpkeepFlag(state) {
  return state?.campaign?.ruleFlags?.[TDC_NO_UPKEEP_RESOURCES] || null
}

/** 结局时写入跨章标记：value = { originScenario, seats, appliesToScenarioIndex }。 */
export function markNoUpkeepResources(state, seats, api = {}) {
  const targets = [...new Set((seats || []).filter(Number.isInteger))]
  if (!targets.length) return null
  const previous = noUpkeepFlag(state) || {}
  const scenarioIndex = Number.isInteger(state?.campaign?.scenarioIndex) ? state.campaign.scenarioIndex : null
  const value = {
    originScenario: CHAPTER_ID,
    seats: [...new Set([...(Array.isArray(previous.seats) ? previous.seats : []), ...targets])],
    appliesToScenarioIndex: scenarioIndex == null ? null : scenarioIndex + 1,
  }
  if (typeof applyCampaignEffect === 'function') {
    applyCampaignEffect(state, { type: 'campaignRuleFlag', key: TDC_NO_UPKEEP_RESOURCES, value },
      text => api.info?.(text))
  } else {
    state.campaign ||= {}
    state.campaign.ruleFlags ||= {}
    state.campaign.ruleFlags[TDC_NO_UPKEEP_RESOURCES] = value
  }
  return value
}

/**
 * phases.js 维护阶段获得资源前读点：复用 campaign-rules 的统一 helper
 * （只对「上一章选择两头下注」的座位、且仅下一章生效；越章后 stale 标记无害）。
 * engine: `if (scenarioBehavior(state).canGainResources?.(state, inv) !== false)`。
 */
export function canGainResources(state, inv) {
  return !tdcCannotGainUpkeepResources(state, inv)
}

/** Good Money 任务结局（Haskell：下一章资源 / 下一章不能获得资源）。 */
export function resolveGoodMoney(state, api = {}) {
  const marks = []
  const noUpkeepSeats = []
  for (const inv of state.investigators || []) {
    if (inv.defeated && !inv.resigned) {
      // 败退调查员也按 Haskell 口径可结算（IncludeEliminated Anyone）；保留。
    }
    // P7 原语口径：轨道固定 'tdcTask'，Good Money 身份由 claim 的 option 表示。
    const entry = typeof api?.mechanics?.progress?.forSeat === 'function'
      ? api.mechanics.progress.forSeat('tdcTask', inv.seat)
      : null
    if (entry?.option !== 'goodMoney') continue
    const choice = typeof api.choose === 'function'
      ? api.choose({
        kind: 'story', source: 'goodMoney', seat: inv.seat, canSkip: false,
        prompt: '任务：好钱（Good Money）', options: [
          { id: 'playItSafe', label: '稳妥行事：下一章开始时额外获得 3 个资源。' },
          { id: 'playBothSides', label: '两头下注：下一章维护阶段不能获得资源。' },
        ],
      })
      : 'playItSafe'
    if (choice === 'playBothSides') {
      noUpkeepSeats.push(inv.seat)
      setFlag(state, `grandVaultGoodMoneyBothSides:${inv.seat}`, true)
      marks.push(`${inv.name}: 两头下注`)
      continue
    }
    if (typeof api?.mechanics?.startingAdjustments?.defer === 'function') {
      api.mechanics.startingAdjustments.defer(inv.seat, {
        receipt: 'grandVault-goodMoney',
        resources: GOOD_MONEY_NEXT_SCENARIO_RESOURCES,
      })
    } else {
      inv.scenarioStartingResources = (Number(inv.scenarioStartingResources) || 0) + GOOD_MONEY_NEXT_SCENARIO_RESOURCES
    }
    marks.push(`${inv.name}: 稳妥行事`)
  }
  const flag = markNoUpkeepResources(state, noUpkeepSeats, api)
  if (flag) info(api, `Good Money：${flag.seats.length} 位调查员下一章维护阶段不能获得资源。`)
  return marks
}

export const events = Object.freeze({
  // 11607 致命机械：意志(3)；失败后选择一项（第二张议程起选择两项）。
  grandVaultDeadlyMechanisms(state, payload = {}, api = {}) {
    const seat = Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat ?? 0)
    const inv = (state.investigators || [])[seat]
    if (!inv) return false
    const result = typeof api.test === 'function'
      ? api.test(seat, 'willpower', 3, null)
      : { success: false }
    if (result?.success) { info(api, '致命机械：意志检定成功。'); return true }
    // 印刷英文为「choose two instead if it is act 2」（中文卡表误译作「场景2」）：
    // 第二幕（GV 只有 2 幕，ACT2_CODE = ACT_CODES[1]）失败时改为选择两项。
    const picks = currentActCode(state) === ACT2_CODE ? 2 : 1
    const used = new Set()
    for (let index = 0; index < picks; index += 1) {
      const options = []
      const nearest = nearestActivatedVault(state, inv.location)
      if (nearest && !used.has('deactivate')) options.push({ id: 'deactivate', label: `使最近的一处已激活[[秘库]]地点（${locationOf(state, nearest)?.name || nearest}）失活` })
      const aside = state.scenarioZones?.setAside || []
      if (aside.includes(VAULT_ATTENDANT_CODE) && !used.has('drawAttendant')) options.push({ id: 'drawAttendant', label: '抽取 1 名放在一边的秘库随从' })
      options.push({ id: 'move', label: '移动到一处相邻地点（尽可能为淹没地点）' })
      const choice = typeof api.choose === 'function'
        ? api.choose({ kind: 'effect', source: DEADLY_MECHANISMS_CODE, seat, prompt: '致命机械：选择一项。', options })
        : options[0].id
      used.add(choice)
      if (choice === 'deactivate' && nearest) deactivateLocation(state, nearest, api)
      else if (choice === 'drawAttendant') {
        const zones = state.scenarioZones ||= {}
        const side = zones.setAside ||= []
        const at = side.indexOf(VAULT_ATTENDANT_CODE)
        if (at >= 0) { side.splice(at, 1); spawnEnemy(state, VAULT_ATTENDANT_CODE, inv.location, api, { engagedSeat: inv.seat }) }
      } else if (choice === 'move') {
        const destinations = (locationOf(state, inv.location)?.connections || [])
          .map(id => locationOf(state, id)).filter(Boolean)
        const flooded = destinations.filter(loc => floodLevel(state, loc.id) > 0)
        const target = (flooded.length ? flooded : destinations)[0]
        if (target) {
          if (typeof api.moveInvestigator === 'function') api.moveInvestigator(seat, target.id)
          else inv.location = target.id
        }
      }
    }
    return true
  },
  // 11608/11609/11610 古代秘库：附属到所在地点（翻译见 actions/`translateGlyph`）。
  grandVaultAncientVault(state, payload = {}, api = {}) {
    const code = String(payload.code || '')
    if (!ANCIENT_VAULT_CODES.includes(code)) return false
    const seat = Number.isInteger(payload.seat) ? payload.seat : (state.currentSeat ?? 0)
    const inv = (state.investigators || [])[seat]
    if (!inv) return false
    const loc = locationOf(state, inv.location)
    if (!loc) return false
    if (typeof api.attachEncounterToLocation === 'function') api.attachEncounterToLocation(code, loc.id)
    else {
      loc.attachments ||= []
      loc.attachments.push({ code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code })
    }
    info(api, `「${ALL_CARDS[code]?.nameZh || code}」附属到「${loc.name}」。`)
    return true
  },
})

export const behavior = {
  id: CHAPTER_ID,
  preScenarioSetup,
  introduction,
  setupScenario,
  setupLocations,
  setupEnemies,
  locationPlaced,
  locationRevealed,
  afterDeckSetup,
  actions,
  performAction,
  afterInvestigate,
  roundEnded,
  checkObjectives,
  allResigned,
  actReveal,
  agendaReveal,
  enemyStatModifier,
  enemyConnections,
  enemyPhaseStart,
  enemyDefeated,
  enemySpawned,
  spawnLocation,
  locationShroudModifier,
  moveError,
  canGainResources,
  resolveChaosToken,
  afterTest(state, inv, result, api, { resolvedTokens = [], ignoredSymbols } = {}) {
    if (!isHardSide(state) || ignoredSymbols) return
    for (const token of resolvedTokens) {
      if (token === 'cultist') applyTokenEffect(state, inv, { mode: 'deactivateOrHarmHard' }, api)
    }
  },
  applyTokenEffect,
  testAutoFail,
  resolution,
  events,
  // 供测试/工具读取的内容层工具（纯函数，无引擎依赖）。
  locationIdAtCell,
  hiddenValueOf,
  translateAncientVaultAction,
  markNoUpkeepResources,
  noUpkeepFlag,
  currentGrid,
  allVaultActivated,
  maybeRevealCore,
  translateGlyph,
  translatedGlyphCount,
  glyphCardsInVictory,
  giveTidalTablet,
  tidalTabletControlledBy,
  vaultCoreInterlude,
  activateLocation,
  deactivateLocation,
  swapPlatform,
  increaseFloodLevel,
  decreaseFloodLevel,
  locationCannotFlood,
  moveError,
  enemyDefeated,
  enemyPhaseStart,
  removeStillBehindYouCopies,
  nearestFloodedToMovingPlatform,
  nearestFloodedTo,
  mostCluesInvestigator,
  spawnLocation,
  enemySpawned,
}

export function implementedEntryFlags(code) {
  return registeredEntry(String(code))?.flags || {}
}

export function scenarioSummary() {
  return {
    id: CHAPTER_ID, referenceCode: '11587',
    locationCount: Object.keys(LOCATIONS).length,
    fixedLocations: [...FIXED_LOCATION_IDS],
    vaultSlotCells: [...VAULT_SLOT_CELLS],
    encounterDeckSize: ENCOUNTER_DECK.length,
    tokenFaces: Object.keys(GRAND_VAULT_TOKEN_MEANINGS.standard),
    glyphRunes: [...GLYPH_RUNE_ORDER],
    resolutionKeys: [...RESOLUTION_KEYS],
    isHardSide: false,
    skullValue,
    activatedCount,
  }
}
