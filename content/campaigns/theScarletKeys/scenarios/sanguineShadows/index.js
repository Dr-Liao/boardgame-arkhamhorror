// 血色阴影（Sanguine Shadows · 09545）· 章节装配。
//
// P7 章节状态 = development（引擎只装 playable/verified，因此单测直接 import 本章五件套，
// 不依赖 content/registered.js）。正式「framework ready」后由 Lead 统一重建索引/注册。
import { scenario, identities, CHAPTER_ENTRY_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_CODES, IN_PLAY_CODES, GATHER_GROUPS } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tskCampaign'],
  requiredEncounterGroupIds: [
    'darkVeiling',
    'mysteriesAbound',
    'sanguineShadows',
    'shadowOfADoubt',
    'strangeHappenings',
  ],
  requiredInvestigatorIds: [],
  // 本章只用 P2 已落地的 TSK 原语（隐匿/密钥/巡逻/地图）；机制 id 由 Lead 在 P7 收口时登记到
  // content/mechanics.js，本 worker 不写共享层，因此这里先声明空集合。
  requiredMechanicIds: [],
  setAsideAliases: [...SET_ASIDE_CODES],
  inPlayAliases: [...IN_PLAY_CODES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
})
// 剧本参考卡 09545：check-scenario 的遭遇记录覆盖用它（type=scenario 不建条目）。
manifest.referenceCode = '09545'

export const implementedCodes = CHAPTER_ENTRY_CODES
