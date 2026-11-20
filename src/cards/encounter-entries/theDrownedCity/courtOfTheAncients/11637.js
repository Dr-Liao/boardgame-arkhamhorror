// 11637 飞翼守护者 · 敌人 ×2（警戒；生成：最高层且没有调查员处；猎物：[敏捷]最低者；敌军阶段开始移动到猎物所在地）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：生成「最高层无调查员」与敌军阶段移动未接线（近似），条目声明 spawnHighestLevel/prey。
export default {
  code: '11637',
  scope: 'enemy',
  implemented: true,
  flags: {"alert":true,"prey":"lowestAgility","spawnHighestLevel":true},
  note: "生成「最高层无调查员」与敌军阶段移动未接线（近似），条目声明 spawnHighestLevel/prey。",
  abilities: [],
}
