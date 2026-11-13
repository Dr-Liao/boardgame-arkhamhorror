// 苦痛之影（Shades of Suffering · 09660）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified 的关卡），
// 单测直接 import 本章五件套，不依赖 content/registered.js；主进程合并后统一重建索引/注册。
import {
  CHAPTER_ENTRY_CODES, GATHER_GROUPS, IN_PLAY_CODES, LOCATIONS, RAW_CODES, RECORD_READS, RECORD_WRITES,
  SET_ASIDE_CODES, identities, scenario,
} from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export {
  scenario, identities, layout, behavior, implementedEncounterCodes, scenarioApproximations, scenarioGaps,
  CHAPTER_ENTRY_CODES, RAW_CODES, RECORD_READS, RECORD_WRITES, GATHER_GROUPS, LOCATIONS,
}

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'tskCampaign'],
  // gatherSets 点名的六组：专属组 + 五个共享组（共享组的行为由共享组 worker 交付）。
  requiredEncounterGroupIds: [
    'darkVeiling',
    'mysteriesAbound',
    'scarletSorcery',
    'shadesOfSuffering',
    'spreadingCorruption',
  ],
  requiredInvestigatorIds: [],
  // 本章实际使用的 P2 原语：隐匿迷你卡（Concealed/Expose）与绯红密钥（影穑/Shift）。
  // 机制 id 由 Lead 在 P7 收口时登记到 content/mechanics.js，本 worker 只声明。
  requiredMechanicIds: ['tskConcealed', 'tskScarletKeys'],
  // 放一边：三对灵怪（Setup 时各随机留一张、另一张移出游戏）+ 三张放一边的地点。
  // 朱三娘与影穑开局就在场（她在阴影中、影穑附属在她身上），因此登记在 inPlayAliases 而不是放一边。
  setAsideAliases: [...SET_ASIDE_CODES],
  recordReads: [...RECORD_READS],
  recordWrites: [...RECORD_WRITES],
  behaviorIds: [behavior.id],
  inPlayAliases: [...IN_PLAY_CODES],
})
manifest.referenceCode = RAW_CODES.scenario
manifest.contentVersion = '0.1.0'

export const implementedCodes = CHAPTER_ENTRY_CODES
