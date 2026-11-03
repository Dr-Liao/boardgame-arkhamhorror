// 06295 冷原（Plateau of Leng）
// 卡面：强制 - 在敌人试图生成在无人地点，且场上没有无人地点时：改为将该敌人生成在此。
//
// 行为位置：`locationRule.emptySpawnFallback` 由章节 behavior.spawnLocation 读取；
// 只有原生成请求的 targetMatcher 是 emptyLocation、且没有合法无人地点时才改道。
export default {
  code: '06295',
  scope: 'location',
  implemented: true,
  locationRule: { emptySpawnFallback: true },
}
