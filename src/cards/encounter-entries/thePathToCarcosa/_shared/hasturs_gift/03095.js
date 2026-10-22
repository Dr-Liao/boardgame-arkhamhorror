// 03095 见印者
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：hasturs_gift
// 卡面：强制 - 在见印者与你交战后：受到1点伤害并对见印者造成1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03095', scope: 'enemy', implemented: true,
  enemyScript: {
    onEngage(state, enemy, inv, api) {
      api.damage(inv.seat, 1)
      api.damageEnemy(enemy.id, 1, inv.seat, 'encounter')
    },
  },
}
