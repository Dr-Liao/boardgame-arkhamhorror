// 06128 斯凯河（theSearchForKadath）· 地点（斯凯 / 城市，线索0，帷幕2）
// 卡面：强制 - 在你尝试离开斯凯河时，如果它还没有被翻面过：检定[willpower](2)或[agility](2)。
//       如果你检定失败，将本卡牌翻面并结算另一面的文本。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 读取：
//   · beforeMove：离开前询问玩家选择意志/敏捷（卡面「或」）；
//   · locationLeaveTest：只有未翻面时返回检定；
//   · locationLeaveFailed：翻面并结算背面故事卡 06128b。
export default {
  code: '06128', scope: 'location', implemented: true,
  locationRule: {
    onLeave: {
      forcedTest: { skillChoice: ['willpower', 'agility'], difficulty: 2, beforeFlipOnly: true },
      cancelMessage: '🌀 「斯凯河」：你没有离开——河水与梦魇拖住了你。',
    },
  },
}
