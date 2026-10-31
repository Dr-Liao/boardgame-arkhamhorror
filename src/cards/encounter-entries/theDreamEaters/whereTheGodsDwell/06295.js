// 06295 冷原（Plateau of Leng）
// 卡面：强制 - 在敌人试图生成在无人地点，且场上没有无人地点时：改为将该敌人生成在此。
//
// 行为位置：`locationRule.emptySpawnFallback` 由章节 behavior.spawnLocation 读取
// （敌方生成钩子；本剧本没有「任意无人地点」敌人时自然不触发，属防御性接线）。
export default {
  code: '06295',
  scope: 'location',
  implemented: true,
  locationRule: { emptySpawnFallback: true },
}
