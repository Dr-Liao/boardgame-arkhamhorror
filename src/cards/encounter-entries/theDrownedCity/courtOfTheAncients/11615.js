// 11615 不稳地基 · 议程 2：敌军阶段上下相邻视为相连；大升降机移动后其上调查员敏捷(2)检定，失败 1 伤害。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
export default {
  code: '11615',
  scope: 'agenda',
  implemented: true,
  flags: {"enemyPhaseVerticalConnections":true,"liftMovedAgilityTest":{"difficulty":2,"damage":1}},
  note: "数据型条目：印刷数值/正文取卡表，规则读点在 definition/behavior。",
  abilities: [],
}
