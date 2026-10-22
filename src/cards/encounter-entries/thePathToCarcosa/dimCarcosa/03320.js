// 03320 失落的卡尔克萨
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：目标 - 在调查员搜集的线索总计达到所需数量时，必须立即花费这些线索并推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔克萨终章「暗淡的卡尔克萨」的幕/密谋脚本。

export default {
  code: '03320', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      if (!state.enemies.some(enemy => enemy.code === '03059')) api.spawn('03059', 'palaceOfTheKing')
    },
  },
}
