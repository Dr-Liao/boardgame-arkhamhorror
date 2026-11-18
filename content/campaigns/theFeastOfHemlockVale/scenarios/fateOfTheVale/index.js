// 山谷的命运（fateOfTheVale）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / setupLocations /
// locationPlaced / setupEnemies / afterDeckSetup / actions + performAction / turnEnded /
// afterTest / roundEnded / locationEntered / enemyDamageAllowed / enemyCannotAttack /
// enemyStatModifier / enemyAttackResolved / enemyDefeated / enemyAttackedSuccessfully /
// actReveal / agendaReveal / checkObjectives / resolveChaosToken / applyTokenEffect /
// testAutoFail / resolution / events。
import {
  scenario, identities, ACT_CODES, ACT3_VARIANT_CODES, ALL_ACT_CODES, AGENDA_CODES,
  ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS, ACT3_CODE_BY_CHOICE, ACT3_RULES, INTERLUDE_CHOICES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS,
  LOCATION_SET_ASIDE_GROUPS, DECK_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES,
  SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS, MIRROR_NEST_POSITIONS, MIRROR_NEST_CODES,
  MIRROR_NEST_CODE_BY_POSITION, EMISSARY_FORMATION, EMISSARY_CODES, ABYSS_LOCATION_ID,
  ABYSS_LOCATION_CODE, STORY_CARD_CODE, SHATTERED_SELF_CODE, OLD_MEMORY_CODE,
  CRYSTAL_MIMIC_CODE, FRENZIED_REVELER_CODE, FIRE_CODE, TREACHERY_CODES,
  RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES, RESIDENT_ENEMY_BY_ASSET,
  VALE_LOCATION_CODES, VALE_LOCATION_IDS, CAVE_LOCATION_CODES, CAVE_LOCATION_IDS,
  SCENARIO_TEXT, RESOLUTION_KEYS, CARD_DATA, START_LOCATION,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import {
  FATE_TOKEN_MEANINGS, EMISSARY_COLOUR_CODES, EMISSARY_SHATTERED_CODES,
  fateChaosToken, fateChaosTokenValue, currentActNumber, colourEnemyCount, againstCosmicEmissary,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags,
  ACT_CODES, ACT3_VARIANT_CODES, ALL_ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, ACTS, AGENDAS,
  ACT3_CODE_BY_CHOICE, ACT3_RULES, INTERLUDE_CHOICES, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, LOCATION_SET_ASIDE_GROUPS, DECK_GROUPS,
  LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, SET_ASIDE_CARDS, SET_ASIDE_LOCATION_IDS,
  MIRROR_NEST_POSITIONS, MIRROR_NEST_CODES, MIRROR_NEST_CODE_BY_POSITION, EMISSARY_FORMATION,
  EMISSARY_CODES, EMISSARY_COLOUR_CODES, EMISSARY_SHATTERED_CODES, ABYSS_LOCATION_ID,
  ABYSS_LOCATION_CODE, STORY_CARD_CODE, SHATTERED_SELF_CODE, OLD_MEMORY_CODE, CRYSTAL_MIMIC_CODE,
  FRENZIED_REVELER_CODE, FIRE_CODE, TREACHERY_CODES, RESIDENT_ASSET_CODES, RESIDENT_ENEMY_CODES,
  RESIDENT_ENEMY_BY_ASSET, VALE_LOCATION_CODES, VALE_LOCATION_IDS, CAVE_LOCATION_CODES,
  CAVE_LOCATION_IDS, SCENARIO_TEXT, RESOLUTION_KEYS, CARD_DATA, START_LOCATION,
  FATE_TOKEN_MEANINGS, fateChaosToken, fateChaosTokenValue, currentActNumber, colourEnemyCount,
  againstCosmicEmissary,
}

// 本章实现行为的非玩家条目（30 个卡号，含 a/b 关联面与双面密使）。
// 地点/幕/议程/scenario 按批次约定不建单卡条目（规则在 definition/scenario 与 behavior）。
export const implementedEncounterCodes = Object.freeze([
  '10651',
  '10652', '10653', '10654',
  '10655', '10656', '10657', '10658', '10659', '10660',
  '10661', '10661b', '10662a', '10662b', '10663a', '10663b', '10664a', '10664b',
  '10665a', '10665b',
  '10666', '10667', '10668', '10669', '10670', '10670b', '10671',
  '10672', '10673', '10674',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  // setup.gatherSets 的十个遭遇组（camelCase 与 FHV shared.js#encounterGroupId 同口径）。
  requiredEncounterGroupIds: [...GATHER_GROUPS],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_CARDS],
  recordReads: [
    'drMarquesHasAHunch', 'drMarquezHasAPlan', 'gideonFinishedTheTaleOfAnnabelleLee',
    'theHemlocksMadeATruce', 'thePetersFamilyWereReunited', 'theValeIsFullOfFireworks',
    'theInvestigatorsFoundGas', 'theInvestigatorsFoundTheosTruck', 'theRoadIsClear',
    'theSurveyNotesWereRecovered', 'bertieIsFleeing', 'theSamplesWereFound',
    'residentRelationships', 'crossedOutResidents',
  ],
  recordWrites: [
    'fateOfTheValeResolution', 'fateOfTheValeXpBonus', 'fateInterlude', 'xp',
    'drMarquezSacrificedHerselfForTheVale', 'theInvestigatorsSacrificedThemselvesForTheVale',
    'theValeWasSaved', 'theValeBurned', 'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale',
    'theInvestigatorsBecameTheTrueFeastOfHemlockVale', 'theInvestigatorsWereDevoured',
    'motherRachelCrossedOut', 'crossedOutResidents', 'drMarquezRemovedFromDecks',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10651'
