// 04126b 阿卡姆警察局
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将阿卡姆警察局放置入场。
// 卡面：东城区与阿卡姆警察局相互连接。
// 卡面：[action]：查找你牌库顶的6张卡牌，找出一张[[武器]]卡牌并将其加入你的手牌。混洗你的牌库。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04126b', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'policeSearchWeapon', label: '🔫 查找牌库顶 6 张中的一张武器' })
    },
  },
}
