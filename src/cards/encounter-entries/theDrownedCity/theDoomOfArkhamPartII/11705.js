// 11705 无情冲锋 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：按在场部位（灰白双翼/凶恶面容/邪恶利爪）分别结算随机弃牌、攻击与战斗检定。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
// approximation：卡面里依赖「本回合攻击/移动上下文」与阶段窗口的子句按 behavior 文件头声明的近似结算。
export default {
  code: '11705',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：灰白双翼→克苏鲁地点每人随机弃 1 手牌；凶恶面容→攻击该地点意志最高者，若没有进行攻击则该调查员抽遭遇牌库顶（api.drawEncounter 的 cannotCancel + suppressSurge 选项）；邪恶利爪→该地点战斗最高者检定[combat](X=狂怒值)，失败被攻击。",
  abilities: [],
}
