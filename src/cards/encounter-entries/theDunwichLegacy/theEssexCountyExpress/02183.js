// 02183 突然出现的巨兽
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：生成 - 你右边的地点(如果你右边没有地点，则在你所在地点。)突然出现的巨兽以横置状态入场。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02183', scope: 'enemy', enemySpawnRule: { spawnMode: 'nextTrain' },
  enemyScript: { onSpawn(state, enemy) { enemy.exhausted = true } },
}
