// 11676 · location · sepulchreOfTheSleeper
//
// 梦者安息地（起始地点，[[拉莱耶]][[巢穴]]）。强制：一位调查员在本地点检定失败后 → +1 扰动。读点：卡表数值由 definition 读取；失败加扰动读点未接线（behavior 未接 afterTest 的失败分支，近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11676',
  scope: 'location',
  implemented: true,
  flags: { lair: true, start: true, failedTestDisturbance: 1 },
  
  note: "梦者安息地（起始地点，[[拉莱耶]][[巢穴]]）。强制：一位调查员在本地点检定失败后 → +1 扰动。读点：卡表数值由 definition 读取；失败加扰动读点未接线（behavior 未接 afterTest 的失败分支，近似）。",
}
