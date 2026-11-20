// 11691b 最终封印 · 特殊议程（同时为当前幕与当前议程）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。
// 卡面：[action] 调查员共同花费 1[per_investigator] 线索并把 1 张[[神器]]放入胜利区：在所在地点放 1 个资源作为印记。
// 强制 - 敌军阶段结束时：抽取克苏鲁牌库顶 1 张カード。
// 目标 - 每名[[克苏鲁]]敌人均在胜利区且有 5 处地点有印记 → 立刻推进。
// 勘误：若本议程因到达毁灭阈值而推进，每位调查员被击败；否则废墟 ≤5 → 结局 2，否则结局 3。
// 读点：见 note。
export default {
  code: '11691b',
  scope: 'agenda',
  implemented: true,
  note: "数据型条目：印记行动在 behavior.actions/placeSigil；目标在 behavior.roundEnded；判定在 behavior.agendaReveal（已按勘误区分「毁灭阈值推进 / 目标推进」）。",
  abilities: [],
}
