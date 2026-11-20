// 11649 · location · obsidianCanyons
//
// 中央尖塔。不能移动/离场（locationRule 声明，引擎读点）；未揭示面强制「进入时若不控制黑曜石之爪：
// 花 1 线索或[敏捷](2)，失败取消移动」由 locationRule.entryToll 声明（读点 movement.js#relocateInvestigator）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11649',
  scope: 'location',
  implemented: true,
  locationRule: { cannotLeavePlay: true, cannotBeMoved: true,
    entryToll: { unlessControls: ['11672a', '11672b'], cost: { clues: 1 },
      test: { skill: 'agility', difficulty: 2 }, cancelOnFail: true, onlyUnrevealed: true } },
  flags: { central: true, immovable: true, entryToll: true, cluesByResources: true },

  note: "中央尖塔。不能移动/离场（locationRule）；未揭示面「进入时若不控制黑曜石之爪：花 1 线索或[敏捷](2)，失败取消移动」由 locationRule.entryToll 接线（movement.js#relocateInvestigator：支付/失败取消/控制爪免收）；按印刷仅未揭示面生效（onlyUnrevealed: true，引擎 entryTollFor 已门控，揭示后不再收费）。",
}
