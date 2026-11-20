// 11605 黑暗中的滑行者 · 敌人（生成 - 最近的淹没地点；不能进入未淹没地点；
//       强制 - 敌军阶段开始若所在地点没有调查员：攻击一处连接地点[战斗]最低的调查员；
//       如果未攻击，移动到距离移动平台最近的淹没地点）。
// 归属：关卡专用 · theDrownedCity/theGrandVault（TDC P7）。
// 读点：
//   · behavior.spawnLocation（生成落点 = 距离抽牌者最近的淹没地点）；
//   · behavior.enemyPhaseStart（强制攻击/移动）；
//   · 不能进入未淹没地点 = enemyRule.enterOnlyFlooded（引擎 enemy-entry#enemyCanEnterLocation，
//     移动/生成/猎人移动共用同一校验）。
export default {
  code: '11605',
  scope: 'enemy',
  implemented: true,
  enemyRule: { enterOnlyFlooded: true },
  flags: {"spawnNearestFlooded":true},
  note: "生成落点（behavior.spawnLocation）与敌军阶段强制（behavior.enemyPhaseStart）已接线；「不能进入未淹没地点」由 enemyRule.enterOnlyFlooded 声明（进入/生成/猎人移动共用 enemyCanEnterLocation）。",
  abilities: [],
}
