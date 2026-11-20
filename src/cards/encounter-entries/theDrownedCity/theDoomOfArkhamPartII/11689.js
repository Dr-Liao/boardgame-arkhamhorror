// 11689 阿卡姆的毁灭 · 议程 1
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。
// 卡面：强制 - 敌军阶段结束时：提高克苏鲁所在地点的淹没等级，并抽取克苏鲁牌库顶的 1 张卡牌。
// 强制 - 一轮结束时：位于完全淹没地点的每位调查员受到 1 点伤害/恐惧。
// 背面：克苏鲁移动到最近的[[废墟]]以外的完全淹没地点并降低其水位、与该地点的[[废墟]]版本交换；若未交换则抽克苏鲁牌；7 处[[废墟]]→全员阵亡；否则补线索并把 1 名星之眷族洗回遭遇牌库。
// 读点：见 note。
export default {
  code: '11689',
  scope: 'agenda',
  implemented: true,
  note: "数据型条目：阈值 3 与背面流程在 definition.stage() 与 behavior.agendaDoomBackEffect；强制能力在 behavior.phaseBegan / roundEnded。",
  abilities: [],
}
