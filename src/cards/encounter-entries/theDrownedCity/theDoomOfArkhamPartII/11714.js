// 11714 涨潮 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：降低克苏鲁地点水位并提高另一地点；完全淹没地点的调查员敏捷检定失败受 1 伤。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11714',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：降低克苏鲁地点水位；选择另一处可提高淹没等级的地点（优先有调查员，api.choose）并提高；完全淹没地点的每位调查员检定[敏捷]，失败选择 1 伤或弃一张自己控制的资产。",
  abilities: [],
}
