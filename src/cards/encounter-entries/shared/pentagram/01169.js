// 01169 祭司
// 归属：跨战役通用
// 遭遇组：pentagram
// 卡面：生成 - 任意无人地点。
// 卡面：强制 - 在祭司入场后：在祭司上放置1个毁灭标记。
//
// 生成点用 enemyRule.spawnAnyEmpty（引擎按卡号读这条，不依赖剧本敌人别名）。
// 入场毁灭用 enemySpawnRule.doomOnSpawn（生成后若战役钩子还没放，引擎补上）。
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  implemented: true,
  code: '01169',
  scope: 'enemy',
  enemyRule: { spawnAnyEmpty: true },
  enemySpawnRule: { doomOnSpawn: 1 },
}
