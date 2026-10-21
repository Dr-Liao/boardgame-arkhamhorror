// 生命周期读点（Phase 1，对应 docs/card-model.md §3）。
//
// 一张牌的行为有五种进入引擎的方式：
//   1. 主动/免费/反应/强制/常驻 → ability.js 描述子（P0-A 已落地）
//   2. 事件卡打出          → 本文件的 playedEffect(code)
//   3. 投入技能检定        → 本文件的 commitProfile(code)
//   4. 入场/离场           → 本文件的 entersPlayEffect(code) / leavesPlayEffect(code)
//   5. 弱点揭示            → 本文件的 weaknessProfile(code)
//
// 后面四种都有两条数据来源，本模块是唯一的读取入口：
//   · 能力层：src/cards/entries/<code>.js 里对应 kind 的描述子；
//   · 旧 DSL：card-effects.js 的 EFFECTS[code].event / .skill / .onEnter / .weakness
//     （离场没有旧字段：`millOnLeave` 是引擎内联特判，已随 03315 迁移删除）。
// 描述子优先。迁移一张卡 = 把它的数据从 EFFECTS 搬到描述子、删掉旧条目，
// 引擎侧不需要任何改动（这正是"读点切换"要证明的事）。
//
// 约定：读点函数一律返回**纯数据**（交给 effect 解释器或对应流程），
// 不返回函数、不读 state，因此可以在 legalMoves / 校验 / 结算里反复调用。
// 需要 `resolve()` 的钩子（例如自定义弱点）由 ability.js 的 descriptorOfKind 单独取，
// 不混进这些纯数据读点。

import { EFFECTS } from '../cards/card-effects.js'
import { descriptorOfKind, registeredEntry } from './ability.js'

// 事件卡打出（含从弃牌堆、背包、彩绘世界复制等路径）。
export function playedEffect(code) {
  const descriptor = descriptorOfKind(code, 'played')
  if (descriptor) return descriptor.effect || null
  return EFFECTS[code]?.event || null
}

// 投入技能检定时的检定档案（onSuccess / successBy / 各种投入限制）。
export function commitProfile(code) {
  const descriptor = descriptorOfKind(code, 'commit')
  if (descriptor) return descriptor.skill || null
  return EFFECTS[code]?.skill || null
}

// 弱点档案：揭示时的数据（type / threat 字段 / effects 等）。
export function weaknessProfile(code) {
  const descriptor = descriptorOfKind(code, 'weakness')
  if (descriptor) return descriptor.weakness || null
  return EFFECTS[code]?.weakness || null
}

// 入场钩子：支援放置入场时结算（原 EFFECTS[code].onEnter）。
export function entersPlayEffect(code) {
  const descriptor = descriptorOfKind(code, 'entersPlay')
  if (descriptor) return descriptor.entersPlay || null
  return EFFECTS[code]?.onEnter || null
}

// 离场钩子：支援离开场上时结算（原引擎内联的 millOnLeave 特判）。
export function leavesPlayEffect(code) {
  const descriptor = descriptorOfKind(code, 'leavesPlay')
  if (descriptor) return descriptor.leavesPlay || null
  return EFFECTS[code]?.leavesPlay || null
}

// 事件卡的打出关键字（fast / noOpportunityAttack）：描述子优先、旧 DSL 回落。
// 引擎的 cardPlayFlag 与本文件的读点共用这份实现，测试也不必知道自己拿的是哪条通道。
// Phase 5：资产/调查员的同名关键字写成**条目级**字段（它们没有 played 钩子），
// 因此这里按「played 描述子 → 条目级字段 → EFFECTS」的顺序回落。
export function playFlag(code, flag) {
  const descriptor = descriptorOfKind(code, 'played')
  if (descriptor && descriptor[flag] === true) return true
  const entry = registeredEntry(code)
  if (entry && entry[flag] === true) return true
  return EFFECTS[code]?.[flag] === true
}

// 审计用：这张卡的生命周期数据现在在哪条通道上。
export function lifecycleChannel(code) {
  const channel = (kind, legacy) => {
    if (descriptorOfKind(code, kind)) return 'descriptor'
    return legacy ? 'legacy' : null
  }
  return {
    played: channel('played', EFFECTS[code]?.event),
    commit: channel('commit', EFFECTS[code]?.skill),
    weakness: channel('weakness', EFFECTS[code]?.weakness),
    entersPlay: channel('entersPlay', EFFECTS[code]?.onEnter),
    leavesPlay: channel('leavesPlay', EFFECTS[code]?.leavesPlay),
  }
}
