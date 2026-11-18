// 汉洛克庄园（hemlockHouse）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：startLocation / preScenarioSetup /
// setupLocations / locationPlaced / afterDeckSetup / actions + performAction / mythosEnded /
// roundEnded / afterInvestigate / enemySpawned / enemyStatModifier / actReveal /
// actIndexAfterAdvance / agendaReveal / checkObjectives / resolveChaosToken / applyTokenEffect /
// resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, ACT_CODES, SET_ASIDE_ACT_CODES, AGENDA_CODES,
  AGENDA_VARIANT_CODES, ACT_STAGES, AGENDA_STAGES, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  DAY_ENCOUNTER_DECKS, DAY_ENCOUNTER_GROUPS, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS,
  PREDATION_BAG_ID, PREDATION_BASE_TOKENS, PREDATION_DAY_CULTISTS, RESOLUTION_KEYS, RESOLUTION_RECORD,
  RECORD_KEYS, CODEX_ENTRY_IDS, CODEX_BRANCH_IDS, RESIDENT_CODES, RESIDENT_SETUP,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_TABLE, ROOM_IDS, ALL_LOCATION_IDS, CELLAR_ID,
  ENEMY_LOCATION_FACES, ENEMY_LOCATION_CODE_BY_LOCATION, ENEMY_LOCATION_REVEAL_EFFECTS,
  FIRST_FLOOR, RANDOM_SLOTS, TOP_BEDROOM_SLOT, CELLAR_SLOT, SHUFFLE_POOL_IDS, BEDROOM_IDS,
  GRID_ADJACENCY, START_LOCATION, SHAPELESS_CELLAR_CODE, LITTLE_SYLVIE_CODE, PREDATORY_HOUSE_CODE,
  PREDATION_TEST_CODE, GRAPPLING_SPAWN_CODE, OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE, FIRE_CODE,
  AREAS_SURVEYED_HEMLOCK_HARBOR, agendaDeckForDate, agendaUseV1, predationBagTokens,
} from './definition.js'
import {
  HEMLOCK_TOKEN_MEANINGS, hemlockHouseChaosToken, hemlockHouseChaosTokenValue, isHardSide,
  tabletHealAmount, skullValue, floorOf as chaosFloorOf,
} from './chaos.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, implementedEncounterCodes, CARD_DATA,
  SCENARIO_TEXT, ACT_CODES, SET_ASIDE_ACT_CODES, AGENDA_CODES, AGENDA_VARIANT_CODES, ACT_STAGES,
  AGENDA_STAGES, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, DAY_ENCOUNTER_DECKS, DAY_ENCOUNTER_GROUPS,
  GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS, PREDATION_BAG_ID, PREDATION_BASE_TOKENS,
  PREDATION_DAY_CULTISTS, RESOLUTION_KEYS, RESOLUTION_RECORD, RECORD_KEYS, CODEX_ENTRY_IDS,
  CODEX_BRANCH_IDS, RESIDENT_CODES, RESIDENT_SETUP, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_TABLE,
  ROOM_IDS, ALL_LOCATION_IDS, CELLAR_ID, ENEMY_LOCATION_FACES, ENEMY_LOCATION_CODE_BY_LOCATION,
  ENEMY_LOCATION_REVEAL_EFFECTS, FIRST_FLOOR, RANDOM_SLOTS, TOP_BEDROOM_SLOT, CELLAR_SLOT,
  SHUFFLE_POOL_IDS, BEDROOM_IDS, GRID_ADJACENCY, START_LOCATION, SHAPELESS_CELLAR_CODE,
  LITTLE_SYLVIE_CODE, PREDATORY_HOUSE_CODE, PREDATION_TEST_CODE, GRAPPLING_SPAWN_CODE,
  OUT_OF_THE_WALLS_CODE, PULLED_IN_CODE, FIRE_CODE, AREAS_SURVEYED_HEMLOCK_HARBOR,
  agendaDeckForDate, agendaUseV1, predationBagTokens,
  HEMLOCK_TOKEN_MEANINGS, hemlockHouseChaosToken, hemlockHouseChaosTokenValue, isHardSide,
  tabletHealAmount, skullValue, chaosFloorOf,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: ['hemlockHouse'],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  inPlayAliases: [LITTLE_SYLVIE_CODE],
  recordReads: ['day', 'time', 'remembered'],
  recordWrites: [
    'day', 'time', 'remembered', 'areasSurveyed', 'relationships',
    RECORD_KEYS.foundLittleSylvie, RECORD_KEYS.resolution, 'hemlockHouseResolutionEntry',
    'hemlockHouseSeals', 'hemlockHouseEnemyLocations', 'hemlockHouseBonusXp',
    'hemlockHousePredationTokens', 'hemlockHouseLittleSylvie', 'hemlockHarborSurveyed',
    RECORD_KEYS.gideonRelationship, RECORD_KEYS.williamRelationship, RECORD_KEYS.judithRelationship,
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10523'
manifest.textLanguage = SCENARIO_TEXT.textLanguage
manifest.textStatus = SCENARIO_TEXT.textStatus
manifest.chineseGaps = [...SCENARIO_TEXT.chineseGaps]
// 当日遭遇组（第一日/第二日/最终日）按当前天数并入牌库，静态 zones 只覆盖固定 7 组。
manifest.dynamicEncounterGroups = Object.values(DAY_ENCOUNTER_GROUPS)
// 敌人-地点是本关新增卡种：把双面身份（地点面 / 敌人-地点面）登记给展示层与审计读点。
manifest.enemyLocations = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_LOCATION_CODE_BY_LOCATION)
    .map(([id, code]) => [id, Object.freeze({
      locationCode: LOCATIONS[id].code, enemyLocationCode: code,
      name: ENEMY_LOCATION_FACES[id]?.name || '',
    })]),
))
manifest.grid = layout.grid
