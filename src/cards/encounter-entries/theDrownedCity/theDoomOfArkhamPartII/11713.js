// 11713 灵能斥责 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：胜利区无克苏鲁敌人时弃掉并再抽；否则意志检定失败把胜利区 1 名克苏鲁敌人以狂怒面放回面板。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11713',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：胜利区无[[克苏鲁]]敌人→弃卡并抽克苏鲁牌库顶；否则选择一位调查员检定[意志]（api.choose），失败选择胜利区一名[[克苏鲁]]敌人以[[狂怒]]面放回面板（api.spawn + linkCthulhuParts）。",
  abilities: [],
}
