// 02104 门阈潜伏者之仆
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：hideous_abominations
// 卡面：猎物 - [agility]最低。
// 卡面：猎手。
// 卡面：强制 - 在门阈潜伏者之仆攻击你时：弃掉你牌库顶2张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02104', scope: 'enemy', enemyRule: { prey: 'lowestAgility' },
  enemyScript: { onAttackStarted(state, enemy, inv, api) { api.discardTop(inv.seat, 2) } },
}
