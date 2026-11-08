// 08680 未封幻影（Unsealed Phantasm）· 深潜组敌人
// 卡面：Spawn - 最近的未坍塌迷雾高塔（没有则在你的地点）。
// 当它已重整且在迷雾高塔时，该高塔不能受到伤害。
// 强制 - 敌人阶段结束时，如果它已重整：朝最近的未坍塌迷雾高塔移动 1 格。
export default {
  code: '08680',
  scope: 'enemy',
  implemented: true,
  flags: {
    unsealedPhantasm: true,
    spawnNearestStandingPylon: true,
    protectsReadyPylon: true,
    moveTowardPylonAtEnemyPhaseEnd: true,
  },
}
