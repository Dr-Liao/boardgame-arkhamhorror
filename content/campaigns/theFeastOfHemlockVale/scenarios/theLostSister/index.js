// 消失的姐妹（theLostSister）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：preScenarioSetup / modifyDeck /
// setupLocations / locationPlaced / locationRevealed / afterDeckSetup / cluesGained /
// investigatorEntryError / beforeMove / locationEntered / actions + performAction /
// enemySpawned / enemyMoved / enemyDefeated / enemyStatModifier / enemyAttackModifier /
// enemyDamageAmount / canOpportunityAttack / phaseBegan / roundEnded / turnEnded /
// actReveal / agendaReveal / checkObjectives / resolveChaosToken / testAutoFail /
// applyTokenEffect / resolution。
import {
  scenario, identities, CARD_DATA, SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, encounterDeckForDay, dayGroupCards, DAY_GATHER_GROUPS,
  GATHER_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, LOCATION_COORDINATES,
  LOCATION_TABLE, CAVERN_LOCATION_IDS, HORRORS_CAVERN_POOL_IDS, CAVERNS_DECK_SIZE,
  SET_ASIDE_CARDS, SET_ASIDE_ENEMY_CODES, HYBRID_FACES, LIMULUS_CODES, CRUSTACEAN_CODES,
  CRYSTAL_PARASITE_CODE,
  REMEMBERED, REMEMBERED_LABELS, RESIDENT_ASSETS, START_LOCATION, FUNGAL_CAVE_ID,
  UNREVEALED_CAVERN_TRAITS, CONNECTION_POLICY, DAY_NUMBERS, INTRO_BRANCHES,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags, scenarioSummary, CODEX_IDS } from './behavior.js'
import {
  THE_LOST_SISTER_TOKEN_MEANINGS, locationIsDark, revealedCaveCount, skullValue,
  theLostSisterChaosToken, theLostSisterChaosTokenValue, CHAOS_TOKEN_FACES,
} from './chaos.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEntryFlags, scenarioSummary, CODEX_IDS, CARD_DATA,
  SCENARIO_TEXT, RESOLUTION_KEYS, SETUP_STEPS, INTRO_BRANCHES,
  ACT_CODES, AGENDA_CODES, ACT_CODE_BY_STAGE, AGENDA_CODE_BY_STAGE, ACT_STAGES, AGENDA_STAGES,
  ENCOUNTER_DECK, ENCOUNTER_DECK_CODES, encounterDeckForDay, dayGroupCards, DAY_GATHER_GROUPS,
  GATHER_GROUPS, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_IDS, LOCATION_COORDINATES, LOCATION_TABLE,
  CAVERN_LOCATION_IDS, HORRORS_CAVERN_POOL_IDS, CAVERNS_DECK_SIZE, SET_ASIDE_CARDS,
  SET_ASIDE_ENEMY_CODES, HYBRID_FACES, LIMULUS_CODES, CRUSTACEAN_CODES, REMEMBERED, REMEMBERED_LABELS,
  RESIDENT_ASSETS, START_LOCATION, FUNGAL_CAVE_ID, UNREVEALED_CAVERN_TRAITS, CONNECTION_POLICY,
  DAY_NUMBERS, THE_LOST_SISTER_TOKEN_MEANINGS, locationIsDark, revealedCaveCount, skullValue,
  theLostSisterChaosToken, theLostSisterChaosTokenValue, CHAOS_TOKEN_FACES,
}

// 本章实现行为的非玩家条目：20 张（幕 3 / 议程 2 / 双面地点 10 / 敌人 5 面 / 诡计 2）。
// 10569 是本关提示卡（scenario 自身，按 input.entryPaths 不建单卡条目）。
export const implementedEncounterCodes = Object.freeze([
  '10570', '10571', '10572', '10573', '10574',
  '10575', '10576', '10577', '10578', '10579', '10580', '10581', '10582',
  '10583a', '10583b', '10584a', '10584b', '10585', '10586', '10587',
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theFeastOfHemlockVale',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'fhvCampaign'],
  requiredEncounterGroupIds: [
    'theLostSister', 'blight', 'horrorsInTheRock', 'mutations', 'myconids',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_ENEMY_CODES, CRYSTAL_PARASITE_CODE, ...CRUSTACEAN_CODES.slice(0, 1)],
  inPlayAliases: [RESIDENT_ASSETS.helen],
  recordReads: ['day', 'time'],
  recordWrites: [
    'day', 'remembered', 'lostSisterDay', 'lostSisterResolution', 'lostSisterNoResolution',
    'lostSisterResolutionFinal', 'lostSisterResolutionNext', 'lostSisterBonusXp',
    'theoReconciledWithHelen', 'thePetersFamilyWasReunited', 'elizabethPetersWasSaved',
    'gideonFoundHisTreasure', 'areasSurveyed', 'akwanShorelineSurveyed', 'relationships', 'codexRead',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '10569'
// 当日遭遇组（第一日/第二日/最终日）按当前天数并入牌库，静态 zones 只覆盖固定 5 组。
manifest.dynamicEncounterGroups = Object.values(DAY_GATHER_GROUPS)
