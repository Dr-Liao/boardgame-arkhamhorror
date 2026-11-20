// 11710 第五只眼 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：放入场（密谋牌库旁）；调查阶段结束放毁灭并弃掉（近似：阶段强制未接线）。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
// approximation：卡面里依赖「本回合攻击/移动上下文」与阶段窗口的子句按 behavior 文件头声明的近似结算。
export default {
  code: '11710',
  scope: 'storyAsset',
  implemented: true,
  note: '数据型条目：克苏鲁牌库 action 卡，结算在 behavior.resolveCthulhuCard（近似见 worker 报告）。',
  abilities: [],
}
