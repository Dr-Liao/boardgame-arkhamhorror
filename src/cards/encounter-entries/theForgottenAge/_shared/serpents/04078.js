// 04078 蝮蛇
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：serpents
// 卡面：强制 - 在蝮蛇的攻击对你造成伤害后：如果你未中毒，将放在一边的一张中毒弱点卡牌放置入场，放到你的威胁区域。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  // 印刷卡面没有「猎物」行（cards-data 文本与 Haskell Serpents/PitViper.hs 均无 prey）；
  // 旧实现多写的一条 prey: 'poisoned' 会让遭遇定义带上未印刷的猎物数据，已移除。
  code: '04078', implemented: true, scope: 'enemy', enemyRule: { vengeance: 1 },
  enemyScript: {
    onAttackResolved(state, enemy, inv, api, attack) {
      if ((attack ? attack.damage > 0 : true) && !api.isPoisoned?.(inv.seat)) api.poison(inv.seat)
    },
  },
}
