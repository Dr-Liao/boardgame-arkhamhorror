// 法术专用额外行动 —— 第 5 步 M1 调查员批次（P6）。
//
// 印刷场景：玛丽·朗博「你控制的卡牌上有至少 1 个毁灭标记时，你可以在自己的回合期间进行
// 一个额外行动，但该额外行动只能用于打出[[法术]]卡牌或激活[[法术]][action]能力。」
//
// 建模方式与引擎已有的「探索专用额外行动」（`inv.exploreOnlyActions`）完全同构：
//   · 授予时 `actionsLeft += 1` 且 `spellOnlyActions += 1`；
//   · 计数口径是「剩下的最后 N 个行动只能用于法术」，所以普通行动要求
//     `actionsLeft - spellOnlyActions` 足够；
//   · 花掉行动之后把 `spellOnlyActions` 收窄到不超过 `actionsLeft`。
// 读点只有三处：授权（回合开始 / 毁灭标记增量）、校验（validateMove）、扣费（executeAction /
// spendAction）。`isSpellAction` 需要卡面数据，因此留在有 cardDef 注入的模块里，本文件只做算术。
//
// 状态形状（纯 JSON）：`inv.spellOnlyActions`、`inv.spellCreditTurn`（本回合已授权）。

import { investigatorRule } from '../cards/card-rules.js'

export function spellCreditRule(code) {
  return investigatorRule(code)?.spellActionCredit || null
}

// 「你控制的卡牌上有至少 1 个毁灭标记」：支援、威胁区、以及调查员自身。
export function doomAmongControlled(inv) {
  if (!inv) return 0
  let total = inv.doom || 0
  for (const card of inv.assets || []) total += card.doom || 0
  for (const card of inv.threat || []) total += card.doom || 0
  return total
}

export function spellOnlyActionsOf(inv) {
  return Math.max(0, inv?.spellOnlyActions || 0)
}

// 本次行动可以用来花的「可用行动数」：法术行动看总数（探索专用额度只管探索），
// 普通行动要同时扣掉法术专用额度与探索专用额度。
export function actionsAvailable(inv, spell) {
  const total = Math.max(0, inv?.actionsLeft || 0)
  const explore = Math.min(inv?.exploreOnlyActions || 0, total)
  if (spell) return Math.max(0, total - explore)
  const restricted = Math.min(spellOnlyActionsOf(inv), total)
  return Math.max(0, total - restricted - explore)
}

// 花掉行动之后的收窄：法术行动优先消耗「法术专用额度」，用完后才动普通行动。
// 2026-10-25 修复 05006（审计第三轮发现真算术 bug）：只扣 spellOnlyActions 不扣 actionsLeft 时，
// 「先花法术专用行动」会让 actionsLeft 残留 1（5 个行动可用），必须把用掉的法术额度同时从
// actionsLeft 里扣掉——因为额度在 grantSpellCredit 时已经加到 actionsLeft 上。
export function consumeAction(inv, cost, spell) {
  if (!inv) return
  let remaining = Math.max(0, Number(cost) || 0)
  let fromCredit = 0
  if (spell && inv.spellOnlyActions) {
    fromCredit = Math.min(remaining, inv.spellOnlyActions)
    inv.spellOnlyActions -= fromCredit
    remaining -= fromCredit
  }
  inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - fromCredit - remaining)
  if (inv.spellOnlyActions) inv.spellOnlyActions = Math.min(inv.spellOnlyActions, inv.actionsLeft)
  if (!inv.spellOnlyActions) delete inv.spellOnlyActions
}

// 授权：有毁灭标记且本回合还没授权过时，给一个只能用于法术的额外行动。
// 返回是否新授权（调用方据此写日志）。
export function grantSpellCredit(state, inv, { info = () => {}, blanked = false } = {}) {
  const rule = spellCreditRule(inv?.code)
  if (!rule || blanked) return false
  if (doomAmongControlled(inv) < (rule.doomAtLeast ?? 1)) return false
  if (inv.spellCreditTurn === state.turnSerial) return false
  inv.actionsLeft = (inv.actionsLeft || 0) + 1
  inv.spellOnlyActions = spellOnlyActionsOf(inv) + 1
  inv.spellCreditTurn = state.turnSerial
  info(`${inv.name} 因控制的卡牌上有毁灭标记，获得 1 个只能用于法术的额外行动。`)
  return true
}

// 2026-10-25 第七轮修复 05006：卡上毁灭减少到阈值以下时，收回尚未使用的「只能用于法术」额度。
export function syncSpellCredit(state, inv) {
  const rule = spellCreditRule(inv?.code)
  if (!rule) return false
  if (doomAmongControlled(inv) >= (rule.doomAtLeast ?? 1)) return false
  const unused = Math.max(0, spellOnlyActionsOf(inv))
  if (unused > 0) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - unused)
  delete inv.spellOnlyActions
  delete inv.spellCreditTurn
  return unused > 0
}

// 回合/阶段重置：上一回合的授权标记随之失效（额度本身由 actionsLeft 重置带走）。
export function clearSpellCredit(inv) {
  if (!inv) return
  delete inv.spellOnlyActions
  delete inv.spellCreditTurn
}
