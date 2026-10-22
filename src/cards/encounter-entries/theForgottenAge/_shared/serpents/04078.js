// 04078 蝮蛇
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：serpents
// 卡面：强制 - 在蝮蛇的攻击对你造成伤害后：如果你未中毒，将放在一边的一张中毒弱点卡牌放置入场，放到你的威胁区域。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04078', implemented: true, scope: 'enemy', enemyRule: { prey: 'poisoned', vengeance: 1 },
  enemyScript: {
    onAttackResolved(state, enemy, inv, api, attack) {
      if ((attack ? attack.damage > 0 : true) && !api.isPoisoned?.(inv.seat)) api.poison(inv.seat)
    },
  },
}
