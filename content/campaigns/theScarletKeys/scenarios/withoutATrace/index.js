// 不留痕迹（Without a Trace · 09681）· 章节装配。
//
// P7 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import {
  CHAPTER_ENTRY_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_CODES, identities, scenario,
} from './definition.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps,
}

// 放一边的实体卡按印刷份数展开：两张敌人各 1、红手套男子 1、天启噩兆 1。
const SET_ASIDE_ALIASES = SET_ASIDE_CODES.flatMap(code => Array(ALL_CARDS[code]?.quantity || 1).fill(code))

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tskCampaign'],
  requiredEncounterGroupIds: [
    'agentsOfTheOutside',
    'beyondTheBeyond',
    'outsiders',
    'secretWar',
    'spreadingCorruption',
    'withoutATrace',
  ],
  requiredMechanicIds: [],
  requiredInvestigatorIds: [],
  setAsideAliases: [...SET_ASIDE_ALIASES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
// 剧本参考卡 09681：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '09681'

export const implementedCodes = CHAPTER_ENTRY_CODES
