// 08547 渗出梦魇
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart3（P7 亡命冰原 III）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；底下卡牌由 behavior.setupScenario 放置。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08547',
  scope: 'enemy',
  implemented: true,
  enemyRule: { hunterWhenNoBeneath: true, removeBeneathOnDefeat: true },
  flags: { eidolon: true, elite: true, beneathHolder: true, seepingNightmare: true },
}
