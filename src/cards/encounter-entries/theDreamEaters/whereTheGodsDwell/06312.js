// 06312 荒土蠕虫（Dhole of the Wastes）
// 卡面：生成 - 冰封荒土或大礼堂。猎物 - [agility]最低。猎手。
//
// 生成地点在两张地点里二选一（06296 冰封荒土 / 06299 大礼堂），
// 由章节 behavior.spawnLocation 读 `enemySpawnRule.spawnAtAnyOfCodes` 分派（不写死卡号）。
// 猎物由卡文解析进 definition（card-data 的 printedPrey），猎手关键词同样由卡文解析。
export default {
  code: '06312',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: { spawnAtAnyOfCodes: ['06296', '06299'] },
}
