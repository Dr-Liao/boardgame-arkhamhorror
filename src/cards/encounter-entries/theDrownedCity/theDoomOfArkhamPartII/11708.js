// 11708 恐惧凝视 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：敏捷检定、失去资源、三选一群体效果（失去行动走 api.loseActions）。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11708',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：灰白双翼→敏捷最高者检定[敏捷]，失败选择 1 伤/1 恐；凶恶面容→所在地点每人失去 2 资源；邪恶利爪→调查员共同三选一（下回合各失 1 行动走 api.loseActions / 攻击每人 / 每人 1 直接恐惧走 api.directHorror）。",
  abilities: [],
}
