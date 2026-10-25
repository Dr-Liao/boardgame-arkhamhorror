// 2026-10-25 第五轮：结算作用域的进程内读点（不写入 state，避免改变存档指纹与 golden replay）。
//
// - 显现作用域：`pushRevelation(code)` / `popRevelation()` 在遭遇诡计与玩家弱点结算期间维护；
//   内容的反应/条件可通过引擎注入的 api 读（api.revelationResolving）。
// - 抽牌时被强制的「险境/不可取消」标记：`markForcedRevelation(code, flags)` 由 drawEncounter
//   写入、揭示结束清理；只覆盖本次揭示，不进入 state。
const revelationStack = []
let revelationCode = null
const forced = new Map()

export function pushRevelation(code) {
  revelationStack.push(revelationCode)
  revelationCode = code ?? null
}

export function popRevelation() {
  revelationCode = revelationStack.length ? revelationStack.pop() : null
}

export function currentRevelation() {
  return revelationCode
}

export function revelationResolving() {
  return revelationCode != null
}

// 供 scenarioRuntime 注入给内容层读取（05049「显现效果期间」）。
export function revelationScopeCode() {
  return revelationCode
}

export function markForcedRevelation(code, flags) {
  if (!code || !flags) return
  forced.set(code, { ...(forced.get(code) || {}), ...flags })
}

export function forcedRevelationOf(code) {
  return forced.get(code) || null
}

export function clearForcedRevelation(code) {
  forced.delete(code)
}

// 2026-10-25 第七轮修复 05158：当前正在进行的「调查行动」帧（重定向目标用，进程内）。
const investigationStack = []
let investigationFrame = null

export function beginInvestigationFrame(frame) {
  investigationStack.push(investigationFrame)
  investigationFrame = frame || null
}

export function investigationFrameRef() {
  return investigationFrame
}

export function endInvestigationFrame() {
  investigationFrame = investigationStack.length ? investigationStack.pop() : null
}

// 取消记账的「本次描述子结算」帧：避免在 state 上放临时标记（会改存档指纹）。
let cancelNoteFrame = false

export function beginCancelNoteFrame() {
  cancelNoteFrame = false
}

export function cancelNoteFrameNoted() {
  return cancelNoteFrame
}

export function noteCancelInFrame() {
  cancelNoteFrame = true
}
