// 致命幻景（fatalMirage）· 章节装配。
//
// 引擎钩子契约见 behavior.js 文件头；真实引擎读点：setupLocations / locationPlaced / locationStory /
// enemyDefeated / actions+performAction / agendaReveal / actReveal / afterTest / resolveChaosToken / resolution。
import { scenario, identities, PARTNER_CODES, MEMORY_ENEMY_CODES, ALL_STORY_CODES, LOCATION_TABLE } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryFlags } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEntryFlags, PARTNER_CODES, MEMORY_ENEMY_CODES, ALL_STORY_CODES }
export const implementedEncounterCodes = Object.freeze([
  '08549', '08550', '08551', '08552', '08553', '08554', '08555',
  ...LOCATION_TABLE.map(([, code]) => code),
  '08584', '08585', '08586', ...MEMORY_ENEMY_CODES, ...PARTNER_CODES,
  ...ALL_STORY_CODES,
])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'edgeOfTheEarth',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'eoteCampaign'],
  requiredEncounterGroupIds: [
    'fatalMirage', 'agentsOfTheUnknown', 'leftBehind', 'miasma',
    'namelessHorrors', 'silenceAndMystery', 'tekelili', 'chillingCold',
  ],
  requiredInvestigatorIds: [],
  requiredMechanicIds: [],
  setAsideLocations: scenario.setAsideLocations,
  recordReads: ['memoriesBanished', 'memoriesDiscovered', 'partnersFacedInnerDemon'],
  recordWrites: [
    'memoriesBanished', 'memoriesDiscovered', 'fatalMirageResolution', 'fatalMirageTimes',
    'fatalMirageCompleted', 'partnersFacedInnerDemon', 'resolutePartners', 'xp',
    // 参考 Key.hs：9 位伙伴「直面内心恶魔」布尔记录。
    'claypoolHasConfrontedHisDemons', 'cookieHasConfrontedHisDemons', 'danforthHasConfrontedHisDemons',
    'drKenslerHasConfrontedHerDemons', 'drSinhaHasConfrontedHerDemons', 'dyerHasConfrontedHisDemons',
    'eliyahHasConfrontedHisDemons', 'ellsworthHasConfrontedHisDemons', 'takadaHasConfrontedHerDemons',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '08549'
