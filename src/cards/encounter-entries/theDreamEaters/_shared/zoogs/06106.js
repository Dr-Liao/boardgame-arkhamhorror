// 06106 鬼祟的祖格鼠（Furtive Zoog，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 与你所在地点 [combat] 最低的调查员交战。猎物 - [combat] 最低。
//       反击（Retaliate）。Swarming 1。
// 实现：反击与 Swarming 1 由 definition 解析（card-data + 共享层蜂拥自动放置）；
//   猎物 key 用条目规则覆盖（lowestCombat）；生成规则写 flags.spawn 由共享层 spawnLocation
//   数据分派（生成并交战）。
export default {
  code: '06106',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'lowestCombat' },
  flags: { spawn: { kind: 'engagedWithLowestSkill', skill: 'combat', colocated: true } },
  simplified: true,
  note: '「与你所在地点最低战斗调查员交战」的生成需要共享层 spawnLocation 数据分派；已登记 coordinator request。',
}
