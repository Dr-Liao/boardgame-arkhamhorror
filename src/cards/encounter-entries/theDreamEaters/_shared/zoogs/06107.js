// 06107 潜行的祖格鼠（Stealthy Zoog，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 与你所在地点 [agility] 最低的调查员交战。猎物 - [agility] 最低。
//       警戒（Alert）。Swarming 1。
// 实现：警戒与 Swarming 1 由 definition 解析；猎物 key 用条目规则覆盖（lowestAgility）；
//   生成规则写 flags.spawn 由共享层 spawnLocation 数据分派（生成并交战）。
export default {
  code: '06107',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'lowestAgility' },
  flags: { spawn: { kind: 'engagedWithLowestSkill', skill: 'agility', colocated: true } },
  simplified: true,
  note: '「与你所在地点最低敏捷调查员交战」的生成需要共享层 spawnLocation 数据分派；已登记 coordinator request。',
}
