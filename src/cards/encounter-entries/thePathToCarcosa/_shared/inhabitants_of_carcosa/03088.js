// 03088 毕宿五的野兽
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：inhabitants_of_carcosa
// 卡面：庞大。
// 卡面：分配毕宿五的野兽攻击的伤害和恐惧时，你必须对单张卡牌分配尽可能多的伤害和恐惧之后，才能分配到另一张卡牌上。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '03088', scope: 'enemy', flags: { spawnGuard: true }, enemyRule: { harmStrategy: 'fillOne' } }
