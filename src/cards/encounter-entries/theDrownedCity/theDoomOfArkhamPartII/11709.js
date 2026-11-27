// 11709 拆毁 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：在最近屋顶放废墟标记。达到 2 个时，杀死该屋顶上每位调查员、弃掉该处敌人，再移除屋顶和本卡。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11709',
  scope: 'storyAsset',
  implemented: true,
  note: '由终章下篇的克苏鲁牌库结算最近屋顶、废墟标记和当地角色。未拆除屋顶时，本卡与克苏鲁弃牌堆一起洗入克苏鲁牌库。',
  abilities: [],
}
