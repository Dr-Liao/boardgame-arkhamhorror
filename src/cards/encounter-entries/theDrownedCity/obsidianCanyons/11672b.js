// 11672b · storyAsset · obsidianCanyons
//
// 黑曜石之爪（力量面）。[action] 横置攻击，可用[敏捷]代[战斗]且技能值 +1；目标横置时伤害 +1；[fast] 翻面（每轮一次）。数据型条目：战斗替代/翻面未接线（近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11672b',
  scope: 'storyAsset',
  implemented: true,
  flags: { obsidianClaw: true, face: 'power', cannotLeavePlay: true, attackBonus: { damageIfExhaustedTarget: 1 } },
  
  note: "黑曜石之爪（力量面）。[action] 横置攻击，可用[敏捷]代[战斗]且技能值 +1；目标横置时伤害 +1；[fast] 翻面（每轮一次）。数据型条目：战斗替代/翻面未接线（近似）。",
}
