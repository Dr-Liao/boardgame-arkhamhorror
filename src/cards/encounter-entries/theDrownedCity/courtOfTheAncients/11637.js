// 11637 飞翼守护者 · 敌人 ×2（警戒；生成：最高层且没有调查员处；猎物：[敏捷]最低者；
//       敌军阶段开始如果重整且未交战 → 移动到猎物所在地）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：behavior.spawnLocation（生成落点 = 最高层且无调查员的地点，用本章 1–4 层数据）、
//       behavior.enemyPhaseStart（移动到猎物所在地，条目 phaseStartMoveToPrey）。
export default {
  code: '11637',
  scope: 'enemy',
  implemented: true,
  flags: {"alert":true,"prey":"lowestAgility","spawnHighestLevel":true,"phaseStartMoveToPrey":true},
  note: "数据型条目：印刷数值/关键词取卡表；生成落点与敌军阶段移动到猎物均在 behavior（spawnLocation / enemyPhaseStart）。",
  abilities: [],
}
