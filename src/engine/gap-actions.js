// 0 行动空档期的剧本 [fast] 行动补全。
//
// 2026-11-13 行为调整：行动点用尽后不再自动结束回合，也不再弹「收尾玩家窗口」。
// 收尾窗口原本提供的三样东西：
//   · 手牌/通道里的 0 行动快速卡 —— legalMoves 的正常 play 条目（行动费用 = 0，校验天然通过）；
//   · 场上支援 / 调查员的 [free] 能力 —— legalMoves 的 ability 条目（⚡免费，cost.action=false）；
//   · 剧本层的 behavior.fastActions（[fast]、0 行动、任意玩家窗口可发动）—— 原本只有
//     encounter.js#playerWindow 这一个出口。
// 本模块补上第三样：空档期把它们折进 legalMoves / validateMove / actionCost 的同一份读点，
// 玩家点按钮即可直接结算（dispatch 的 scenarioAction 分支调用 behavior.performAction）。
//
// 只在「行动点用尽、仍在本回合、没有待决选择」时提供：有行动点时这些条目仍由行动结算后的
// 玩家窗口列出（窗口路径保持原样），两边不重复。behavior 由调用方注入（引擎的
// scenarioBehavior(state)），本模块不反向依赖 engine 工厂。

/** 空档期是否成立：本回合、行动点用尽、无待决选择。 */
export function inGapPeriod(state, inv) {
  if (!state || !inv || state.pendingChoice) return false
  if (state.phase !== 'investigation' || state.currentSeat !== inv.seat) return false
  if ((inv.actionsLeft || 0) > 0) return false
  return true
}

/** behavior.fastActions 里「[fast]、0 行动」的条目；统一折成 scenarioAction 形状。 */
export function gapFastActionMoves(state, inv, behavior) {
  if (!inGapPeriod(state, inv)) return []
  if (typeof behavior?.fastActions !== 'function') return []
  let moves
  try {
    moves = behavior.fastActions(state, inv, 'investigation.afterAction') || []
  } catch {
    // 剧本钩子异常不应该影响「基础合法性」：空档期入口不提供，但普通行动与窗口路径照常。
    return []
  }
  return moves
    .filter(move => move && !move.reason && move.fast === true && (move.actions ?? 1) === 0)
    .map(move => ({ ...move, action: 'scenarioAction' }))
}

/** 同一个剧本行动（规则名 + 可选目标）：legalMoves 去重与 validateMove 匹配共用。 */
export function sameScenarioAction(a, b) {
  if (!a || !b || a.rule !== b.rule) return false
  if ((a.enemyId ?? null) !== (b.enemyId ?? null)) return false
  if ((a.deckId ?? null) !== (b.deckId ?? null)) return false
  return true
}
