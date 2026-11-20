// 大秘库（theGrandVault · 11587）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实读点：preScenarioSetup / setupLocations /
// locationPlaced / locationRevealed / afterDeckSetup / actions + performAction /
// afterInvestigate / roundEnded / checkObjectives / allResigned / actReveal / agendaReveal /
// enemyStatModifier / enemyConnections / locationShroudModifier / resolveChaosToken /
// applyTokenEffect / resolution / events。
//
// 本章 26 张非玩家条目（11587 是提示卡，不建条目）：
//   议程 3（11588–11590）/ 幕 2（11591–11592）/ 地点 11（11593–11596、11598–11604）/
//   敌人 2（11605–11606）/ 诡计 7（11607–11610 + 11608b–11610b 背面）/ 剧情资产 1（11611）。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DEFINITION_CODES, GATHER_GROUPS,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_CELLS,
  FIXED_LOCATION_IDS, CHAMBER_LOCATION_IDS, VAULT_POOL_IDS, VAULT_SLOT_CELLS, VAULT_BOTTOM_ROW_CELLS,
  VAULT_PREACTIVATED_CELLS, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, STAR_SPAWN_ENEMY_CODES,
  ANCIENT_VAULT_CODES, ANCIENT_VAULT_BACK_CODES, TIDAL_TABLET_CODE, VAULT_ATTENDANT_CODE,
  SLITHERER_CODE, START_LOCATION, CONNECTION_POLICY, GLYPH_RECORDS, GLYPH_RUNE_ORDER,
  VAULT_CORE_INTERLUDE, GOOD_MONEY_NEXT_SCENARIO_RESOURCES,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, scenarioSummary, implementedEntryFlags, translatedGlyphCount, glyphCardsInVictory } from './behavior.js'
import {
  GRAND_VAULT_TOKEN_MEANINGS, grandVaultChaosToken, grandVaultChaosTokenValue, grandVaultTokenText,
  skullValue, activatedCount, activatedLocationIds, isActivated, tabletValue, isHardSide,
  CHAOS_TOKEN_FACES, GLYPH_TRAIT, VAULT_TRAIT,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, scenarioSummary, implementedEntryFlags, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, STAGE_CARDS,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, ENCOUNTER_DEFINITION_CODES, GATHER_GROUPS,
  LOCATIONS, LOCATION_IDS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, LOCATION_CELLS,
  FIXED_LOCATION_IDS, CHAMBER_LOCATION_IDS, VAULT_POOL_IDS, VAULT_SLOT_CELLS, VAULT_BOTTOM_ROW_CELLS,
  VAULT_PREACTIVATED_CELLS, SET_ASIDE_ALIASES, SET_ASIDE_LOCATION_IDS, STAR_SPAWN_ENEMY_CODES,
  ANCIENT_VAULT_CODES, ANCIENT_VAULT_BACK_CODES, TIDAL_TABLET_CODE, VAULT_ATTENDANT_CODE,
  SLITHERER_CODE, START_LOCATION, CONNECTION_POLICY, GLYPH_RECORDS, GLYPH_RUNE_ORDER,
  VAULT_CORE_INTERLUDE, GOOD_MONEY_NEXT_SCENARIO_RESOURCES,
  GRAND_VAULT_TOKEN_MEANINGS, grandVaultChaosToken, grandVaultChaosTokenValue, grandVaultTokenText,
  skullValue, activatedCount, activatedLocationIds, isActivated, tabletValue, isHardSide,
  CHAOS_TOKEN_FACES, GLYPH_TRAIT, VAULT_TRAIT, translatedGlyphCount, glyphCardsInVictory,
}

// 本章实现行为的非玩家条目：26 张（议程 3 / 幕 2 / 地点 11 / 敌人 2 / 诡计 7 / 剧情资产 1）。
export const implementedEncounterCodes = Object.freeze([
  '11588', '11589', '11590', '11591', '11592',
  '11593', '11594', '11595', '11596', '11598', '11599',
  '11600', '11601', '11602', '11603', '11604',
  '11605', '11606', '11607', '11608', '11608b', '11609', '11609b', '11610', '11610b', '11611',
])
// 真正有规则行为读点的条目（其余是数据型条目，数值取卡表）。
export const behaviorEntryCodes = Object.freeze([
  '11588', '11589', '11590', '11591', '11592',
  '11593', '11594', '11595', '11596', '11598', '11599',
  '11600', '11601', '11602', '11603', '11604',
  '11606', '11607', '11608', '11609', '11610', '11611',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theDrownedCity',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tdcCampaign'],
  requiredEncounterGroupIds: [
    'theGrandVault', 'alienMachinery', 'tdcFlood', 'theInescapable', 'rlyeh', 'starSpawn',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: [...SET_ASIDE_LOCATION_IDS],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [
    'thePowerWasDiverted', 'theExpeditionHeadedWest', 'theExpeditionHeadedEast',
    'theInnerSanctumWasUnsealed', 'theCreatureWasDefeated', 'discoveredGlyphs', 'rlyehMap', 'tidalTablet',
  ],
  recordWrites: [
    'theInnerSanctumWasUnsealed', 'theCreatureWasDefeated', 'discoveredGlyphs', 'rlyehMap', 'tidalTablet',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '11587'
// 剧情/指南入口：文本语言与状态（中文由 narrative-guides 的 story-text.js 提供）。
manifest.textLanguage = SCENARIO_TEXT.textLanguage
manifest.textStatus = SCENARIO_TEXT.textStatus
// 随机秘库房间：8 张候选里随机移出 1 张异界机械，其余 7 张洗牌入场（静态 zones 声明全部候选）。
manifest.vaultChamberDeck = {
  pool: [...VAULT_POOL_IDS],
  slotCells: VAULT_SLOT_CELLS.map(cell => ({ ...cell })),
  removedCount: 1,
  inPlayCount: 7,
}
// 放一边的 Star Spawn：4 名敌人里随机 2 名移出游戏，其余放一边（静态 zones 全部声明）。
manifest.starSpawnHandling = {
  codes: [...STAR_SPAWN_ENEMY_CODES],
  removedCount: 2,
  dynamicEncounterGroups: ['starSpawn'],
}
