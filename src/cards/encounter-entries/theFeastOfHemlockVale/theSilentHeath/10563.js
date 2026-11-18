// 10563 无彩幼虫 · 敌人（寂静荒野，×3）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：冷漠。强制 - 无彩幼虫攻击后：击败它。
// 印刷：战斗 1 / 躲避 1 / 生命 1 / 伤害 0 / 恐惧 1 / 特性 [[Creature]][[Insect]][[Mutated]] / 胜利 0。
// 读点：behavior.enemyAttackResolved 读 defeatAfterAttack：攻击结算后把该敌人移出场面（击败）。
export default {
  code: '10563',
  scope: 'enemy',
  implemented: true,
  flags: { defeatAfterAttack: true },
  note: 'approximation：「攻击后击败」在 enemyAttackResolved 里直接移出敌人（走 api.defeatEnemy，'
    + '失败时从 state.enemies 移除），不产生额外的「被击败」胜利区结算（印刷 Victory 0）。',
}
