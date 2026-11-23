// 11706 飓风之力 · 克苏鲁牌库行动卡（story）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 效果：巡逻/意志/敏捷检定按在场部位结算；「额外巡逻」= api.runEnemyPatrol（与敌人阶段 patrolMove 同一入口）。
// 读点：behavior.resolveCthulhuCard 按卡号结算；behavior.drawCthulhuCard 抽牌并在结算后弃回克苏鲁弃牌堆
//       （11709/11710/11715 保留在场或洗回）。独立牌库读点见 scenario-decks.js。
export default {
  code: '11706',
  scope: 'storyAsset',
  implemented: true,
  note: "数据型条目：结算在 behavior.resolveCthulhuCard：灰白双翼→api.runEnemyPatrol(克苏鲁本体) 额外执行一次巡逻（与敌人阶段同一 patrolMove，成功移动写 lastPatrolRound）；凶恶面容→最近调查员检定[意志]；邪恶利爪→一名调查员检定[敏捷]，失败由该调查员选择 提高克苏鲁地点水位/1 伤/1 恐（api.choose）。",
  abilities: [],
}
