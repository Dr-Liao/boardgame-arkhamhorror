// 04084 幽嘶蛇人
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：agents_of_yig
// 卡面：胜利区内有至少1点复仇点数时，幽嘶蛇人获得反击。
// 卡面：胜利区内有至少2点复仇点数时，幽嘶蛇人获得猎手。
// 卡面：胜利区内有至少3点复仇点数时，幽嘶蛇人每次受到攻击时少受到1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04084', implemented: true, scope: 'enemy', enemyRule: {"victory":1}, enemySpawnRule: { vengeanceThresholds: { retaliate: 1, hunter: 2, damageReduction: 3 } } }
