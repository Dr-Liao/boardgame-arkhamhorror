// 06227 敌人「月之拜亚基」（Moonbound Byakhee · [[怪物]]·[[拜亚基]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// 生成 - 最近的[[月面]]地点。猎物 - 警报等级最高（并且至少为 3）。警戒。猎手。
// 月之拜亚基移动或交战时，其忽略警报等级小于等于 2 的调查员。
//
// 依据 Haskell Enemy/Cards/.../MoonboundByakhee.hs（SpawnAt NearestLocationToYou (LocationWithTrait Surface)、
// Prey MostToken AlarmLevel <> HasTokens AlarmLevel atLeast 3、CannotBeEngagedBy/CannotBeHuntedBy 警报<=2）：
//   · 生成点 → enemySpawnRule.spawnNearestTrait: 'Surface'（behavior.spawnLocation 读数据，不需要 def.spawn）；
//   · 忽略低警报调查员 → enemyStatRule.huntIgnoresAlarmBelow: 3：
//     behavior.hunterMove 取警报 ≥3 的最近目标；behavior.canEngageEnemy 拒绝警报 ≤2 的调查员与它交战。
export default {
  code: '06227',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: { spawnNearestTrait: 'Surface' },
  enemyStatRule: { huntIgnoresAlarmBelow: 3 },
  note: '「猎物 - 警报等级最高（≥3）」的并列裁决由引擎 preyRank 读印刷 prey 文本；警报 ≤2 的忽略由 behavior.hunterMove / canEngageEnemy 落实。',
}
