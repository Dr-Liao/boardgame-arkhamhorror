// 11707 凶险狂风 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：随机弃牌 + 额外巡逻；意志检定失败 1 恐惧；未巡逻时利爪攻击全员。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
// approximation：卡面里依赖「本回合攻击/移动上下文」与阶段窗口的子句按 behavior 文件头声明的近似结算。
export default {
  code: '11707',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：灰白双翼→每人随机弃 1 手牌 + api.runEnemyPatrol 额外巡逻；凶恶面容→意志最高者检定[意志]，失败选择 1 点恐惧或弃一张自己控制的资产（api.choose + discardAsset）；邪恶利爪→若克苏鲁本体 enemy.lastPatrolRound !== state.round（本轮未以巡逻移动）则攻击其所在地点每名调查员。",
  abilities: [],
}
