// 11715 希望消逝 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：放入场并封印 [elder_sign]；幕推进时弃掉。封印走 api.sealChaosTokenFromBag / api.releaseSealedToken。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11715',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：resolveCthulhuCard 用 api.attachToAgenda 把卡以附件实例放在议程旁；先找 [elder_sign]，没有（或被封印）时取混乱袋中最高正数数值标记，再 api.sealChaosTokenFromBag(token, card) 封印到该卡实例（state.chaos.sealed 以 card.id 为 source）；幕推进 behavior.discardHopeFadesCard 用 api.releaseSealedToken(card, token) 放回混乱袋并 api.detachEncounterAttachmentById 移除附件。",
  abilities: [],
}
