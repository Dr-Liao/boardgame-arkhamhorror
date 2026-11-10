// 受限额外行动（P6 原语 `investigator.restrictedAction`）。
//
// 印刷场景：
//   · 玛丽·朗博「你控制的卡牌上有毁灭标记时，获得 1 个只能用于法术的额外行动」（第四循环 P6）；
//   · 托尼·摩尔根「你回合期间可以额外进行 1 次行动，该行动只能用于与带赏金的敌人交战、
//     或攻击带赏金的敌人」（本循环 P6）。
//
// 两者形状相同：**额外的行动点，但只能花在规定用途上**。此前的实现（`spell-actions.js`）
// 把「法术」写死在字段名与函数名里；本模块把「哪种受限行动」抽成 kind，字段按 kind 命名，
// 因此第三个同类调查员只需在条目里声明 `investigator.restrictedAction` 并登记一个 kind。
//
// 计数口径（与法术专用行动一致）：`actionsLeft` 包含受限额度，受限额度是**最后 N 个行动**。
// 因此：
//   · 花用某个 kind 的行动时，可用数 = actionsLeft − 探索专用 − 其它 kind 的受限额度；
//   · 普通行动（kind = null）要扣掉全部受限额度；
//   · 花掉之后把各额度收窄到不超过剩余 actionsLeft。
//
// 状态形状（纯 JSON）：`inv[<field>]` 为该 kind 的剩余额度；`inv[<field>Turn]` 记录授权回合。
// `spell` 沿用旧字段名 `spellOnlyActions` / `spellCreditTurn`，保证第四循环的存档与测试不变。

import { registeredEntry } from './ability.js'
import { assetTextBlankedExceptForced } from './card-text.js'
export const availableEngageCredit = inv => (inv.assets || []).filter(asset => !assetTextBlankedExceptForced(asset)
  && registeredEntry(asset.code)?.assetRule?.restrictedAction === 'engage' && !asset.restrictedActionSpent).length
export const RESTRICTED_ACTION_FIELDS = Object.freeze({
  spell: 'spellOnlyActions',
  bounty: 'bountyOnlyActions',
  engage: 'engageOnlyActions',
  // 地球边缘 P5：08016 鲍勃「只能用于代打队友手牌 [[道具]] 支援的额外行动」。
  itemPlay: 'itemPlayOnlyActions',
  // 地球边缘 P5：08014a 陈丽丽的免费战斗/躲避行动。
  fightEvade: 'fightEvadeOnlyActions',
  // 八循环 P5：09001 卡森「额外行动只能用于本能力」的受限额度。
  crossSeatAction: 'crossSeatActionOnlyActions',
})

export const RESTRICTED_ACTION_KINDS = Object.freeze(Object.keys(RESTRICTED_ACTION_FIELDS))

export function assertRestrictedKind(kind) {
  if (kind != null && !RESTRICTED_ACTION_KINDS.includes(kind)) {
    throw new Error(`未知受限行动类型 ${JSON.stringify(kind)}（可选：${RESTRICTED_ACTION_KINDS.join(' / ')}）`)
  }
  return kind
}

export function restrictedCount(inv, kind) {
  assertRestrictedKind(kind)
  if (!inv || kind == null) return 0
  return Math.max(0, inv[RESTRICTED_ACTION_FIELDS[kind]] || 0)
}

/** 所有受限额度的合计（普通行动要扣掉它）。 */
export function restrictedTotal(inv) {
  return RESTRICTED_ACTION_KINDS.reduce((sum, kind) => sum + restrictedCount(inv, kind), 0)
}

/** 某个 kind 的行动（kind=null 表示普通行动）现在还能花几个。 */
export function actionsAvailable(inv, kind = null) {
  assertRestrictedKind(kind)
  const total = Math.max(0, inv?.actionsLeft || 0)
  const explore = Math.min(inv?.exploreOnlyActions || 0, total)
  // 别的受限额度必须先扣掉：它们是「最后 N 个行动」。
  const others = Math.min(restrictedTotal(inv) - restrictedCount(inv, kind), total)
  const assetCredits = kind === 'engage' ? availableEngageCredit(inv) : 0
  return Math.max(0, total - explore - others) + assetCredits
}

/** 花掉行动：先消耗同 kind 的受限额度，再消耗普通行动。 */
export function consumeAction(inv, cost, kind = null) {
  assertRestrictedKind(kind)
  if (!inv) return
  let remaining = Math.max(0, Number(cost) || 0)
  if (kind === 'engage') for (const asset of inv.assets || []) {
    if (!remaining || asset.restrictedActionSpent || assetTextBlankedExceptForced(asset) || registeredEntry(asset.code)?.assetRule?.restrictedAction !== 'engage') continue
    asset.restrictedActionSpent = true; remaining--
  }
  let fromCredit = 0
  const credit = restrictedCount(inv, kind)
  if (kind != null && credit) {
    fromCredit = Math.min(remaining, credit)
    inv[RESTRICTED_ACTION_FIELDS[kind]] = credit - fromCredit
    remaining -= fromCredit
  }
  inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - fromCredit - remaining)
  for (const each of RESTRICTED_ACTION_KINDS) {
    if (!inv[RESTRICTED_ACTION_FIELDS[each]]) continue
    inv[RESTRICTED_ACTION_FIELDS[each]] = Math.min(restrictedCount(inv, each), inv.actionsLeft)
    if (!inv[RESTRICTED_ACTION_FIELDS[each]]) delete inv[RESTRICTED_ACTION_FIELDS[each]]
  }
}

/** 授权：额外 +1 行动，并把它记为只能用于 `kind`。返回新额度。 */
export function grantRestrictedAction(state, inv, kind) {
  assertRestrictedKind(kind)
  if (!inv || kind == null) return 0
  inv.actionsLeft = (inv.actionsLeft || 0) + 1
  const field = RESTRICTED_ACTION_FIELDS[kind]
  inv[field] = restrictedCount(inv, kind) + 1
  inv[`${field}Turn`] = state?.turnSerial ?? null
  return inv[field]
}

/** 本回合是否已经授权过某个 kind（同回合只授权一次）。 */
export function restrictedGrantedThisTurn(state, inv, kind) {
  assertRestrictedKind(kind)
  const field = RESTRICTED_ACTION_FIELDS[kind]
  return inv?.[`${field}Turn`] === (state?.turnSerial ?? null)
}

/** 收回尚未使用的额度（例如能力失效时）。返回收回的点数。 */
export function revokeRestrictedAction(inv, kind) {
  assertRestrictedKind(kind)
  const unused = restrictedCount(inv, kind)
  if (unused > 0) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - unused)
  if (kind != null) {
    delete inv[RESTRICTED_ACTION_FIELDS[kind]]
    delete inv[`${RESTRICTED_ACTION_FIELDS[kind]}Turn`]
  }
  return unused
}

/** 回合/阶段重置：丢掉授权记录（额度本身由 actionsLeft 重置带走）。 */
export function clearRestrictedAction(inv, kind) {
  assertRestrictedKind(kind)
  if (!inv || kind == null) return
  delete inv[RESTRICTED_ACTION_FIELDS[kind]]
  delete inv[`${RESTRICTED_ACTION_FIELDS[kind]}Turn`]
}

/**
 * 条目声明的受限行动规则：`investigator.restrictedAction = { kind, requireBounty: true }`。
 * 返回 null 或规则对象；未知 kind 在注册期报错（调用方是注册校验）。
 */
export function restrictedActionRule(code, rules) {
  const rule = rules?.(code)?.restrictedAction
  if (!rule) return null
  if (typeof rule !== 'object' || !RESTRICTED_ACTION_KINDS.includes(rule.kind)) {
    throw new Error(`调查员 ${code} 的受限行动声明不合法：${JSON.stringify(rule)}`)
  }
  return rule
}
