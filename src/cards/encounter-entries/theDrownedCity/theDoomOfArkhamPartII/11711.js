// 11711 地震踩踏 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：无调查员时弃掉并再抽；否则敏捷/意志检定失败 1 伤/恐或随机弃牌（近似：二选一随机）。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
// approximation：卡面里依赖「本回合攻击/移动上下文」与阶段窗口的子句按 behavior 文件头声明的近似结算。
export default {
  code: '11711',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：克苏鲁地点无调查员→弃卡并抽克苏鲁牌库顶；否则所在地点每位调查员检定[敏捷]，失败由该调查员选择 1 伤/1 恐/随机弃 1 手牌（api.choose）。",
  abilities: [],
}
