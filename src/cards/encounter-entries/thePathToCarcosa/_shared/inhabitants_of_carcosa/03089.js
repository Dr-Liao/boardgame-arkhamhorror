// 03089 哈利湖水怪
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：inhabitants_of_carcosa
// 卡面：猎物 - 恐惧最多。
// 卡面：反击。
// 卡面：强制 - 在你成功躲避哈利湖水怪且至多超过难度2点后：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03089', implemented: true, scope: 'enemy', enemyRule: { prey: 'mostHorror' },
  enemyScript: {
    onEvade(state, inv, enemy, result, api) {
      if (result?.success && result.value - result.difficulty <= 2) api.horror(inv.seat, 1)
    },
  },
}
