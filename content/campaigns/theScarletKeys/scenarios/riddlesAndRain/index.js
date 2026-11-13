// 谜雨（riddlesAndRain · 09501）· 章节装配。
//
// P7 阶段：status 保持 development（引擎只装 playable/verified），单测直接 import 本章五件套，
// 不依赖 content/registered.js；主进程合并后统一重建索引/注册。
import { scenario, identities, RAW_CODES, SET_ASIDE_ALIASES } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEntryCodes, RECORD_KEYS, FLAG_KEYS } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, RAW_CODES, implementedEntryCodes, RECORD_KEYS, FLAG_KEYS }
export const implementedEncounterCodes = Object.freeze([...implementedEntryCodes])

export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theScarletKeys',
  status: 'playable',
  layout,
  // `notz`：指南 setup 要求 gather「The Midnight Masks」遭遇组里的 5 张诡计（01135 ×3 / 01136 ×2），
  // 这两张卡在卡表里属于 notz 包；content/schema.js 会校验「关卡用到的原卡必须由所需卡包声明」，
  // 因此这里显式依赖 notz（core + notz = 原版核心两盒，与实体产品要求一致）。
  requiredPackIds: ['core', 'notz', 'tskCampaign'],
  // gather 的 9 组（专属组 + 指南点名的共享组）；Crimson Conspiracy / Outsiders 放一边后洗入。
  // 注意：The Midnight Masks 的 5 张诡计（01135/01136）在 core 包里、卡包清单没有登记 `arkham`
  // 这个遭遇组 id（对应 id 是 notz 包的 `theMidnightMasks`，而本关只取 5 张诡计、不取该组的
  // 地点/幕/议程），所以这里不把它写进 requiredEncounterGroupIds（content/schema.js 会校验
  // 「遭遇组必须由所需卡包声明」）；GATHER_GROUPS 仍保留 `arkham` 作为 gather 口径。
  requiredEncounterGroupIds: [
    'crimsonConspiracy',
    'darkVeiling',
    'outsiders',
    'riddlesAndRain',
    'shadowOfADoubt',
    'strangeHappenings',
  ],
  requiredInvestigatorIds: [],
  // 本章实际使用的 TSK P2 原语：隐匿迷你卡、绯红密钥/变换、空洞区容器、同志会乱入、世界地图时间轴。
  requiredMechanicIds: ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskCoterie', 'tskMap'],
  setAsideLocations: scenario.setAsideLocations,
  setAsideAliases: [...SET_ASIDE_ALIASES],
  // 记录键只用战役 recordSchema（content/campaigns/theScarletKeys/records.js）里已有的三项。
  recordReads: [RECORD_KEYS.time, RECORD_KEYS.keysHeld, RECORD_KEYS.chapters],
  recordWrites: [RECORD_KEYS.time, RECORD_KEYS.keysHeld, RECORD_KEYS.chapters],
  behaviorIds: [behavior.id],
})
manifest.contentVersion = '0.1.0'
manifest.referenceCode = '09501'
