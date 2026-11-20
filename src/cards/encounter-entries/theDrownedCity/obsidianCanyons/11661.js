// 11661 · location · obsidianCanyons
//
// 磁性尖塔（×2）。[[峰顶]]；位于此处不能触发[[枪械]]支援的能力（locationRule.cannotTriggerAbilityTraits:['Firearm']，读点 ability-rules.js#traitTriggerBlocked）；[action] 本地点每人花 1 线索，与至多 2 格外开阔天空交换位置（每场团队限一次；behavior.magneticSpiresSwap）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11661',
  scope: 'location',
  implemented: true,
  // 印刷「你在此地时不能触发[[枪械]]支援的能力」：读点 ability-rules.js#traitTriggerBlocked（action/free/reaction；forced 不受影响）。
  locationRule: { cannotTriggerAbilityTraits: ['Firearm'] },
  flags: { summit: true, magneticSpires: true, firearmAbilityLocked: true },
  
  note: "磁性尖塔（×2）。[[峰顶]]；位于此处不能触发[[枪械]]能力（近似：未接线，仅数据）；[action] 本地点每人花 1 线索，与至多 2 格外开阔天空交换位置（每场团队限一次；behavior.magneticSpiresSwap）。",
}
