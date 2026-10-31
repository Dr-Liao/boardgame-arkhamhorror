// 食梦者（The Dream Eaters）· 55 个战役记录键的中文名、类型与默认值（P8 战役层）。
//
// 事实源：参考实现 `Campaigns/TheDreamEaters/Key.hs` 的 55 个构造子，与锁定英文包
// `参考资源/.../locales/en/theDreamEaters/base.json` 的 `key` 段逐键对齐（55 条全）。
// 中文名直接取 `参考资源/.../locales/zh/theDreamEaters/base.json` 的 `key` 段（55 条全已译，
// 缺项时向内容层返回英文 id；本文件不为缺项自造剧情译名——P8-T 统一走译校流程）。
// locale 键路径固定为 `theDreamEaters.key.<id>`（`en/campaignLog.json` 与 `zh/campaignLog.json`
// 都不含 TDE 键，记录标签只能走这个命名空间）。
//
// 类型口径（P8-CAMPAIGN-FACTS §4、§8）：
//   · 2 个计数型（number）：`stepsOfTheBridge`（桥梁进度）、`evidenceOfKadath`（卡达斯的证据）；
//   · 2 个逐调查员布尔（序列化成被标记的调查员 id 数组 → `string[]`）：
//     `hasBrokenTheLawOfUlthar`、`wasCaptured`；
//   · 其余 51 个布尔（boolean）。
// `recordDefaults` 是建局/读旧档时的初始值；`recordTypes` 同时充当 `manifest.recordSchema`，
// 场景 manifest 的 `recordReads` / `recordWrites` 必须都在这里声明（注册期校验）。

/** 记录标签（英文 id → 中文名；顺序与 `Key.hs` 一致）。 */
export const RECORD_LABELS = Object.freeze({
  theDreamersStrayedFromThePath: "入梦者偏离了道路",
  theInvestigatorsWereSavedByRandolphCarder: "调查员被伦道夫·卡特救下",
  theCatsCollectedTheirTributeFromTheZoogs: "猫群收到了祖格鼠的贡品",
  theInvestigatorsParleyedWithTheZoogs: "调查员和祖格鼠谈判",
  drMaheswaranJoinedTheInvestigation: "马斯沃伦医生与你一同调查",
  drMaheswaranStayedWithHerPatients: "马斯沃伦医生留在病人身边",
  stepsOfTheBridge: "桥梁进度",
  drMaheswaransFateIsUnknown: "马斯沃伦医生生死未卜",
  randolphEscapedTheHospitalOnHisOwn: "伦道夫自己逃出了医院",
  randolphEscapedTheHospitalWithTheInvestigators: "伦道夫和调查员一起逃出了医院",
  drMaheswaranIsAlive: "马斯沃伦医生生还",
  drMaheswaranIsMissing: "马斯沃伦医生失踪",
  theBlackCatDeliveredNewsOfYourPlight: "黑猫带去你们陷入困境的消息",
  theBlackCatSharedKnowledgeOfTheDreamlands: "黑猫告知了幻梦境的事情",
  theBlackCatWarnedTheOthers: "黑猫提醒其他调查员",
  okayFineHaveItYourWayThen: "那好吧，随你便",
  theDreamersGrowWeaker: "入梦者渐渐衰弱",
  youAreOnYourOwn: "你独自前行",
  theBlackCatHasAHunch: "黑猫察觉到了什么",
  theBlackCatIsAtYourSide: "黑猫在你身边",
  youAskedForIt: "这是你自找的",
  theInvestigatorsForcedTheirWayIntoTheTemple: "调查员强行进入神庙",
  evidenceOfKadath: "卡达斯的证据",
  hasBrokenTheLawOfUlthar: "已打破乌撒的法则",
  wasCaptured: "被俘",
  virgilWasCaptured: "维吉尔被俘",
  randolphEludedCapture: "伦道夫未遭俘虏",
  randolphWasCaptured: "伦道夫被俘",
  randolphSurvivedTheDescent: "伦道夫安全下降到地下世界",
  randolphDidNotSurviveTheDescent: "伦道夫在下降到地下世界的途中遇难",
  theInvestigatorsPossessTheSilverKey: "调查员持有银钥匙",
  theBlackCatRequestedAidFromTheOthers: "黑猫向其他调查员寻求帮助",
  theBlackCatSharedKnowledgeOfTheUnderworld: "黑猫告知了地下世界的事情",
  theBlackCatIsSearchingForTheTruth: "黑猫调查真相",
  theDreamersKnowOfAnotherPath: "入梦者知道了另一条路",
  theInvestigatorsWereCarriedToTheColdWastes: "调查员被带到冰封荒土",
  theInvestigatorsTraveledToTheColdWastes: "调查员前往冰封荒土",
  randolphCarterDidNotSurviveTheVoyage: "伦道夫在这趟航程中遇难",
  randolphSurvivedTheVoyage: "伦道夫安全地经历了航程",
  theInvestigatorsFoundAWayOutOfTheUnderworld: "调查员找到了离开地下世界的路",
  theBlackCatSpokeOfNyarlathotep: "黑猫提到了奈亚拉托提普",
  theBlackCatSpokeOfAtlachNacha: "黑猫提到了阿特拉克·纳克亚",
  theBlackCatKnowsTheTruth: "黑猫得知真相",
  nyarlathotepsInvasionHasBegun: "奈亚拉托提普开始入侵",
  theDreamersEscapedFromNyarlathotepsGrasp: "调查员逃离了奈亚拉托提普的魔掌",
  theDreamersBanishedNyarlathotep: "调查员驱逐了奈亚拉托提普",
  theDreamersAwoke: "入梦者醒来",
  theDreamersStayedInTheDreamlandsForever: "入梦者永远留在了幻梦境",
  theDreamersTraveledBeneathTheMonastery: "入梦者进入隐修院底下",
  theInvestigatorsAreTrappedInAtlachNachasRealm: "调查员被困在阿特拉克·纳克亚的领域",
  theBridgeWasCompleted: "桥梁已经建成",
  theBridgeWasDestroyed: "桥梁已被摧毁",
  theInvestigatorsReturnedToReality: "调查员回到现实世界",
  theInvestigatorsNeverEscaped: "调查员永远无法逃离",
  theInvestigatorsAreStillInTheDreamlands: "调查员仍在幻梦境",
})

/** 计数型记录（number，累加语义）。 */
export const COUNT_RECORDS = Object.freeze(['stepsOfTheBridge', 'evidenceOfKadath'])

/**
 * 逐调查员布尔（`campaignLogRecordedSets`，序列化成调查员 id 数组）。
 * 注意：`hasBrokenTheLawOfUlthar` 在参考实现里没有任何写入点（见 P8-CAMPAIGN-FACTS §9），
 * 结局子步 17 实际读的是 `wasCaptured`；本层保留键与类型，写入点由章节/结局接线决定。
 */
export const PER_INVESTIGATOR_RECORDS = Object.freeze(['hasBrokenTheLawOfUlthar', 'wasCaptured'])

/** 布尔型记录（其余 51 个）。 */
export const BOOLEAN_RECORDS = Object.freeze(
  Object.keys(RECORD_LABELS).filter(key => !COUNT_RECORDS.includes(key) && !PER_INVESTIGATOR_RECORDS.includes(key)),
)

/** 全部记录键（顺序同 `Key.hs`）。 */
export const RECORD_KEYS = Object.freeze(Object.keys(RECORD_LABELS))

/** `manifest.recordSchema`：键 → 引擎记录类型（boolean / number / string[]）。 */
export const recordTypes = Object.freeze({
  theDreamersStrayedFromThePath: 'boolean',
  theInvestigatorsWereSavedByRandolphCarder: 'boolean',
  theCatsCollectedTheirTributeFromTheZoogs: 'boolean',
  theInvestigatorsParleyedWithTheZoogs: 'boolean',
  drMaheswaranJoinedTheInvestigation: 'boolean',
  drMaheswaranStayedWithHerPatients: 'boolean',
  stepsOfTheBridge: 'number',
  drMaheswaransFateIsUnknown: 'boolean',
  randolphEscapedTheHospitalOnHisOwn: 'boolean',
  randolphEscapedTheHospitalWithTheInvestigators: 'boolean',
  drMaheswaranIsAlive: 'boolean',
  drMaheswaranIsMissing: 'boolean',
  theBlackCatDeliveredNewsOfYourPlight: 'boolean',
  theBlackCatSharedKnowledgeOfTheDreamlands: 'boolean',
  theBlackCatWarnedTheOthers: 'boolean',
  okayFineHaveItYourWayThen: 'boolean',
  theDreamersGrowWeaker: 'boolean',
  youAreOnYourOwn: 'boolean',
  theBlackCatHasAHunch: 'boolean',
  theBlackCatIsAtYourSide: 'boolean',
  youAskedForIt: 'boolean',
  theInvestigatorsForcedTheirWayIntoTheTemple: 'boolean',
  evidenceOfKadath: 'number',
  hasBrokenTheLawOfUlthar: 'string[]',
  wasCaptured: 'string[]',
  virgilWasCaptured: 'boolean',
  randolphEludedCapture: 'boolean',
  randolphWasCaptured: 'boolean',
  randolphSurvivedTheDescent: 'boolean',
  randolphDidNotSurviveTheDescent: 'boolean',
  theInvestigatorsPossessTheSilverKey: 'boolean',
  theBlackCatRequestedAidFromTheOthers: 'boolean',
  theBlackCatSharedKnowledgeOfTheUnderworld: 'boolean',
  theBlackCatIsSearchingForTheTruth: 'boolean',
  theDreamersKnowOfAnotherPath: 'boolean',
  theInvestigatorsWereCarriedToTheColdWastes: 'boolean',
  theInvestigatorsTraveledToTheColdWastes: 'boolean',
  randolphCarterDidNotSurviveTheVoyage: 'boolean',
  randolphSurvivedTheVoyage: 'boolean',
  theInvestigatorsFoundAWayOutOfTheUnderworld: 'boolean',
  theBlackCatSpokeOfNyarlathotep: 'boolean',
  theBlackCatSpokeOfAtlachNacha: 'boolean',
  theBlackCatKnowsTheTruth: 'boolean',
  nyarlathotepsInvasionHasBegun: 'boolean',
  theDreamersEscapedFromNyarlathotepsGrasp: 'boolean',
  theDreamersBanishedNyarlathotep: 'boolean',
  theDreamersAwoke: 'boolean',
  theDreamersStayedInTheDreamlandsForever: 'boolean',
  theDreamersTraveledBeneathTheMonastery: 'boolean',
  theInvestigatorsAreTrappedInAtlachNachasRealm: 'boolean',
  theBridgeWasCompleted: 'boolean',
  theBridgeWasDestroyed: 'boolean',
  theInvestigatorsReturnedToReality: 'boolean',
  theInvestigatorsNeverEscaped: 'boolean',
  theInvestigatorsAreStillInTheDreamlands: 'boolean',
})

/** 初始值：计数 0、逐调查员集合 []、布尔 false。 */
export const recordDefaults = Object.freeze(Object.fromEntries(
  Object.entries(recordTypes).map(([key, type]) => [key,
    type === 'string[]' ? [] : type === 'number' ? 0 : false])))

/** locale 键路径（记录标签在 `theDreamEaters.key` 命名空间下）。 */
export function recordLabelKey(key) {
  return `theDreamEaters.key.${key}`
}

/** 中文名；未知键返回 id 本身（UI 不暴露内部键名之外的东西，也不崩）。 */
export function recordLabel(key) {
  return RECORD_LABELS[key] || String(key)
}

/** 记录类型；未知键返回 null。 */
export function recordTypeOf(key) {
  return recordTypes[key] || null
}
