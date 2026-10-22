// 04327 犹格斯星
// 归属：关卡专用 · shatteredAeons（失落的时代 · 破碎永世）
// 遭遇组：shattered_aeons
// 卡面：[action]：将犹格斯星上的一个线索翻至毁灭标记面。抽取1张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 犹格斯星（04327）：[action] 把 1 个线索翻至毁灭标记面，然后抽 1 张卡。

export default {
  code: '04327', scope: 'location',
  locationRule: {
    actions({ location, moves }) {
      moves.push({
        action: 'scenarioAction', rule: 'yuggothFlip',
        label: '🌀 把犹格斯星的 1 个线索翻至毁灭标记面，然后抽 1 张卡',
        // 卡面要求「把 1 个线索翻面」：没有线索时不能发动。
        reason: (location.clues || 0) > 0 ? null : '犹格斯星上没有线索可以翻面',
      })
    },
  },
}
