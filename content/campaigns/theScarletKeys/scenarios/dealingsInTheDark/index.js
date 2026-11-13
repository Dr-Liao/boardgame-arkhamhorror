// 暗中交易（Dealings in the Dark · 09566）· 章节装配。
//
// P7 章节状态 = development：引擎只装 playable/verified，因此本章不进生产组合根；
// 单测直接 import 本章五件套，并在测试进程内用内容 API 注册（不写注册表文件）。
import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  requiredPackIds: ['core', 'notz', 'tskCampaign'],
  // 收齐 7 组：暗中交易 / 犹格斯星使徒 / 黑暗笼罩 / 远古恶魔 / 黑暗异教（core 的 darkCult）/ 上锁的门。
  // 《午夜假面》只取 2 张错误指示 + 3 张追猎鬼影（11xxx），不在 tskCampaign 的组清单里，按卡号直接进遭遇牌库。
  requiredEncounterGroupIds: [
    'agentsOfYuggoth',
    'darkVeiling',
    'dealingsInTheDark',
  ],
  requiredMechanicIds: [],
  requiredInvestigatorIds: [],
  recordReads: ['theCellIsWorkingWithEce', 'theCellIsDecievingEce', 'theCellRefusedEcesOffer', 'time'],
  recordWrites: [
    'theCellIsWorkingWithEce', 'theCellIsDecievingEce', 'theCellRefusedEcesOffer',
    'eceTrustsTheCell', 'eceDoesNotTrustTheCell', 'twistedAntiprismBearer', 'youHaventSeenTheLastOfTheRedGlovedMan',
    'time',
  ],
  behaviorIds: [behavior.id],
  // 放一边：七张大巴扎 + 加拉塔码头地点由 setAsideLocations 声明；敌人/密钥按卡号声明。
  setAsideAliases: ['09585', '09739', '09590a'],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = scenario.referenceCode
