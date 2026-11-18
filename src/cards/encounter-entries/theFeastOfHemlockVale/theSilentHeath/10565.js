// 10565 族群虫后 · 濒死的主母 · 敌人（寂静荒野，放一边）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：生成 - （[codex] Σ）。庞大。警戒。
//       [[昆虫]]敌人失去冷漠。（原文：族群虫后所在地点的[[昆虫]]敌人失去冷漠。）
//       场上每有一个其他[[昆虫]]敌人，族群虫后得到 +1 攻击值。
//       族群虫后得到 +X[per_investigator] 生命值，其中 X 为当前天数。
// 印刷：战斗 1 / 躲避 3 / 生命 5 / 伤害 2 / 恐惧 2 / 特性 [[Creature]][[Insect]][[Mutated]][[Elite]] / 胜利 2。
// 读点：behavior.spawnBroodQueen（法典 Σ / 议程强制）读 broodQueen + definition 敌人的
//       healthPerDay / fightPerOtherInsect；behavior.enemyStatModifier 返回每其他昆虫 +fight；
//       behavior.syncInsectKeywords 处理「所在位置的昆虫失去冷漠」。
export default {
  code: '10565',
  scope: 'enemy',
  implemented: true,
  flags: { broodQueen: true },
  note: '生成时的 +X 生命（X = 当前天数 × 每调查员）在 behavior.spawnBroodQueen 写入实例 health；'
    + '引擎没有敌人生命上限的持续修正读点，因此只在生成时结算一次（天数在一关内不变）。',
}
