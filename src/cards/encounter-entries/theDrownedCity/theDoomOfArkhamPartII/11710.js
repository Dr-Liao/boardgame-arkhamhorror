// 11710 第五只眼 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：放入场（密谋牌库旁）；调查阶段结束放毁灭并弃掉（behavior.phaseBegan('enemy') 结算）。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11710',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：resolveCthulhuCard 放在密谋牌库旁；强制「调查阶段结束时」由 behavior.phaseBegan(phase===\"enemy\") 结算：在克苏鲁面板一名无毁灭标记的敌人上放 1 毁灭（api.placeDoomOnCard）并弃掉本卡。",
  abilities: [],
}
