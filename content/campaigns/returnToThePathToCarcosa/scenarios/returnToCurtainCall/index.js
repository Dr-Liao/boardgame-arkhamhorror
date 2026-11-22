// 重返谢幕（returnToCurtainCall）· 章节装配与注册期清单。
//
// 引擎读取的钩子：startLocation / setupPlan / setupLocations / resolveChaosToken /
// locationEntered / locationLeft / actReveal / agendaReveal / enemyDefeated /
// enemyDiscarded / actions + performAction / allResigned / resolution。
// 基础规则来自基础章节 behavior，重返差异见 behavior.js 文件头。
import { scenario, identities, CARD_DATA } from './definition.js'
import { layout } from './layout.js'
import { behavior } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, CARD_DATA }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'returnToThePathToCarcosa',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'carcosaCampaign', 'rtptcCampaign'],
  requiredEncounterGroupIds: [
    // 基础组
    'curtainCall', 'evilPortents', 'hauntings', 'cultOfTheYellowSign', 'rats',
    // 重返替换组 + 新组
    'maddeningDelusions', 'neuroticFear', 'returnToCurtainCall',
  ],
  requiredMechanicIds: ['carcosaEncounterEffects', 'carcosaChaosEffects', 'curtainCallHazards'],
  setAsideAliases: ['03059', '03060', '52018', '52019'],
  recordWrites: [
    'theStrangerIsOnToYou', 'chasingTheStranger', 'youTriedToWarnThePolice',
    'thePoliceAreSuspiciousOfYou', 'youChoseNotToGoToThePolice', 'doubt', 'conviction',
    'pallidMaskBearer',
  ],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '1.0.0'
// 桌牌提示卡映射（web/ui-cards.js）由 Lead 统一补：本章印刷剧本参考卡是 52014。
manifest.referenceCode = CARD_DATA.REFERENCE_CODE
