// 11649 · location · obsidianCanyons
//
// 中央尖塔。不能移动/离场；背面未揭示面强制「进入时若不控制黑曜石之爪：花 1 线索或[敏捷](2)，失败取消移动」。未揭示面入场费在 behavior.movementError 近似为「无爪且无线索时禁止进入」。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11649',
  scope: 'location',
  implemented: true,
  flags: { central: true, immovable: true, entryToll: true, cluesByResources: true },
  
  note: "中央尖塔。不能移动/离场；背面未揭示面强制「进入时若不控制黑曜石之爪：花 1 线索或[敏捷](2)，失败取消移动」。未揭示面入场费在 behavior.movementError 近似为「无爪且无线索时禁止进入」。",
}
