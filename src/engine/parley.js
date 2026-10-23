// 通用谈判（Parley）原语 —— 第 2 步 P2.7。
//
// 印刷规则：带「谈判 - …」的**敌人 / 地点 / 剧情资产**可以在其卡面上声明一次行动；
// 谈判是普通行动（消耗 1 个行动点），但**不会引发借机攻击**。第四循环大量使用它
// （05020/05076/05085/05095–05097/05217/05218 等），其中有 19 张中文卡面含「谈判」。
//
// 声明方式（非玩家条目的 abilities 里）：
//   { kind: 'action', actionKind: 'parley', label: '谈判：…', cost: { action: 1 },
//     target: { kind: 'enemy', query: … }?,          // 可选：需要选目标时逐目标展开
//     resolve: ({ inv, api, target }) => … }
// 读点：
//   · legalMoves 由 `parleyMoves(state, inv)` 枚举（地点 / 同地点敌人 / 同地点剧情资产）；
//   · 执行走 ability-exec 的 `doEntityAbility`（与能力层同一条 `executeDescriptor` 管线，
//     费用、上限、日志、目标注入共用一套）；
//   · actionKind：`actionKind()` 先读描述子的 `actionKind`，再回落 `countsAs`；
//   · 借机攻击豁免：dispatch 把 `actionKind === 'parley'` 与 entityAbility 都视为不引发借机攻击；
//   · 构筑：`isParleyCard(card, code)` 供调查员能力（如普雷斯顿）判断「这张牌带谈判」。
//
// 本模块是纯函数（只读注册表与 state）：不 import 引擎装配点，也不改状态。

import { registeredEntry } from './ability.js'
import { all as matchAll } from './matcher.js'
import { enumerateTargets } from './targets.js'

export const PARLEY_ACTION_KIND = 'parley'

// 描述子是否是一条谈判能力：新写法 actionKind，兼容旧的 countsAs。
export function isParleyDescriptor(descriptor) {
  if (!descriptor) return false
  return descriptor.actionKind === PARLEY_ACTION_KIND || descriptor.countsAs === PARLEY_ACTION_KIND
}

export function isParleyAbility(ability) {
  return isParleyDescriptor(ability?.descriptor)
}

// 非玩家实体的谈判能力（按声明顺序；`abilityIndex` 就是这个数组的下标）。
export function entityParleyDescriptors(entity) {
  const entry = registeredEntry(entity?.originalCode || entity?.code)
  return (entry?.abilities || []).filter(ability =>
    ability.kind === 'action' && isParleyDescriptor(ability))
}

// 构筑读点：卡面文本含「谈判 / Parley」，或条目里声明了谈判能力。
export function cardMentionsParley(card) {
  const text = `${card?.textZh || ''}\n${card?.text || ''}`
  return /谈判|Parley/i.test(text)
}

export function isParleyCard(card, code = card?.code) {
  if (cardMentionsParley(card)) return true
  return (registeredEntry(code)?.abilities || []).some(ability =>
    isParleyDescriptor(ability) || ability.parley === true)
}

// 某个实体此刻可以执行的谈判行动（每个目标展开成一条）。
// `matchAll(descriptor.criteria)` 与玩家卡能力共用同一份条件组合子；成本与上限在执行时再校验
// （与 legalMoves 对玩家卡的处理一致：缺条件的能力不出现在列表里）。
export function parleyMoves(state, inv, entity, entityType) {
  const out = []
  const descriptors = entityParleyDescriptors(entity)
  descriptors.forEach((descriptor, abilityIndex) => {
    if (descriptor.criteria) {
      const matched = matchAll(descriptor.criteria)({ state, inv, source: entity, windowId: state.timingWindow, context: {} })
      if (!matched) return
    }
    const base = { action: 'entityAbility', entityType, entityId: entity.id, abilityIndex }
    if (!descriptor.target) {
      out.push({ ...base, actionKind: PARLEY_ACTION_KIND, label: `🤝 ${descriptor.label}` })
      return
    }
    const targets = enumerateTargets(state, inv, descriptor.target, { source: entity })
    for (const target of targets) {
      out.push({ ...base, targetId: target.id, actionKind: PARLEY_ACTION_KIND,
        label: `🤝 ${descriptor.label} → ${target.label || target.name || target.id}` })
    }
  })
  return out
}

// 当前调查员能用的全部谈判行动：本地点、同地点敌人、同地点剧情资产。
export function parleyMovesFor(state, inv) {
  if (!inv) return []
  const out = []
  const here = (state.locations || []).find(location => location.id === inv.location)
  if (here) out.push(...parleyMoves(state, inv, here, 'location'))
  for (const enemy of (state.enemies || []).filter(item => item.location === inv.location)) {
    out.push(...parleyMoves(state, inv, enemy, 'enemy'))
  }
  for (const asset of (state.storyAssets || []).filter(item => item.location === inv.location)) {
    out.push(...parleyMoves(state, inv, asset, 'storyAsset'))
  }
  return out
}

// 执行前的目标合法性：返回 null 表示可用，否则返回原因（validateMove 与 dispatch 共用）。
export function parleyTargetError(state, inv, entity, descriptor, move) {
  if (!descriptor) return '该实体没有这条谈判能力'
  if (!descriptor.target) return null
  const targets = enumerateTargets(state, inv, descriptor.target, { source: entity })
  if (!targets.length) return '没有合法的谈判目标'
  if (move.targetId == null) return '需要选择谈判目标'
  return targets.some(target => String(target.id) === String(move.targetId)) ? null : '谈判目标不合法'
}
