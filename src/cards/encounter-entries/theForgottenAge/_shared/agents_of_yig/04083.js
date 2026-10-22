// 04083 伊格之子
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：agents_of_yig
// 卡面：猎手。
// 卡面：胜利区每有一点复仇点数，伊格之子得到+1攻击值。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04083', scope: 'enemy', implemented: true, enemyStatRule: { fightBonusFromVengeance: true } }
