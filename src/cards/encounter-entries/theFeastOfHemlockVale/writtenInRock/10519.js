// 10519 发狂矿工 · 敌人（writtenInRock）
// 卡面：猎手。X 为发狂矿工的列号。强制 - 发狂矿工攻击你后：对此地点的其他每位调查员与
// 每个[[居民]]支援各造成 1 点伤害。
// X 的战斗/躲避值由 behavior.enemyStatModifier 用列号覆盖（卡表把 X 记成 -2 占位）；
// 攻击后的溅射在 behavior.enemyAttackResolved。
export default {
  code: '10519',
  scope: 'enemy',
  implemented: true,
  flags: {
    frenziedMiner: true,
    hunter: true,
    fightByColumn: true,
    evadeByColumn: true,
    attackSplash: true,
  },
  note: '近似：卡表把战斗/躲避的 X 记成 -2 占位；运行期以「列号 - 印刷值」的修正回到列号，避免叠加。',
}
