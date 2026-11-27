// 02090 夜鹰
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：whippoorwills
// 卡面：冷漠。猎手。
// 卡面：夜鹰所在地点的每位调查员得到-1[willpower]、-1[intellect]、-1[combat]和-1[agility]。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
export default {
  code: '02090', scope: 'enemy',
  enemySpawnRule: { spawnAtFirstInvestigator: true },
  enemyStatRule: { skillAura: { amount: -1, locationBound: true } },
}
