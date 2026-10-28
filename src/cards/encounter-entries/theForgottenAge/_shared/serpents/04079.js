// 04079 蟒蛇
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：serpents
// 卡面：猎手。
// 卡面：强制 - 在蟒蛇攻击你后：在下一个补给阶段期间，你处于横置状态的卡牌不能重整。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04079', implemented: true, scope: 'enemy', enemyRule: { vengeance: 2 },
  enemyScript: { onAttackResolved(state, enemy, inv, api) { api.preventReadyNextUpkeep(inv.seat) } },
}
