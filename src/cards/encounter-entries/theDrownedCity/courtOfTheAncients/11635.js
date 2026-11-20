// 11635 巨型暴君 · 敌人（庞大；+3[per_investigator] 生命且不能移动；敌军阶段结束强制直接恐惧）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 近似：「不能移动」由 behavior.enemyStatModifier 加生命；移动限制未接线（近似），敌军阶段结束效果未接线。
export default {
  code: '11635',
  scope: 'enemy',
  implemented: true,
  flags: {"massive":true,"cannotMove":true},
  note: "「不能移动」由 behavior.enemyStatModifier 加生命；移动限制未接线（近似），敌军阶段结束效果未接线。",
  abilities: [],
}
