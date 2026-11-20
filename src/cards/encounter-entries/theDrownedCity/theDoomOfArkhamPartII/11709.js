// 11709 拆毁 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：在最近屋顶放废墟标记；2 个则全员阵亡并移除屋顶与本体；否则与弃牌堆一起洗回克苏鲁牌库。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
// approximation：卡面里依赖「本回合攻击/移动上下文」与阶段窗口的子句按 behavior 文件头声明的近似结算。
export default {
  code: '11709',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：最近[[屋顶]]取 api.mechanics.map.nearest(from, eligible)；在该地点实例上 api.addCardCounter(rooftop,'ruin',1) 落实体废墟标记（api.cardCounterOf 读回计数）；达到 2 个→全员阵亡、弃该地点每名敌人、移除该地点与本卡（demolitionRemoved）；否则将本卡与克苏鲁弃牌堆一起洗回克苏鲁牌库。",
  abilities: [],
}
