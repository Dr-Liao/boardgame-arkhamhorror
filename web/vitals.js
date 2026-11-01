// 生命 / 理智仪表的显示换算。
//
// 通常 `current = max - loss` 不会小于 0：伤害达到生命上限或恐惧达到理智上限时调查员
// 立即被击败。但卡城幽影（Dim Carcosa）的特殊规则是「调查员不会因恐惧被击败」
// （content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js 的
// investigatorCanBeDefeated 对 'horror' 返回 false），恐惧可以超过理智上限，
// 剩余理智因此可以为负——这不是显示错误，而是本关多张卡（「如果你没有剩余神智值」、
// 「恐惧大于理智值两倍」）的判定依据，所以理智必须如实显示负数。
//
// 生命保持钳制：伤害达到上限即被击败，负的生命值没有规则意义；进度条宽度始终按
// 0–100% 裁切，只有数字保留真实差值。
export function vitalDisplay(max, remaining, { allowNegative = false } = {}) {
  const total = Math.max(0, Math.floor(Number(max) || 0))
  const raw = Math.floor(Number(remaining) || 0)
  const current = allowNegative ? raw : Math.max(0, Math.min(total, raw))
  const fill = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0
  return { total, current, overflow: current < 0, fill }
}
