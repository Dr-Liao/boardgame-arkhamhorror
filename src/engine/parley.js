// 通用谈判（Parley）原语 —— 第 12 步 P2.7。
//
// 印刷规则：带「谈判 - ……」的**敌人 / 地点 / 剧情资产**可以在其卡面上声明一次行动；
// 谈判是普通行动（消耗 1 个行动点），但**不会引发借机攻击**。第四循环大量使用它
// （05020/05076/05085/05095…/05097/05217/05218 等），其中有 19 张中文卡面含「谈判」。
//
// 声明方式（非玩家条目的 abilities 里）：
//   { kind: 'action', actionKind: 'parley', label: '谈判：…', cost: { action: 1 },
//     target: { kind: 'enemy', query: … }?,          // 可选：需要选目标时逐目标展开
//     resolve: ({ inv, api, target }) => … }
// 读点：
//   · legalMoves 由 `parleyMoves(state, inv)` 枚举（地点 / 同地点敌人 / 同地点剧情资产）；
//   · 执行走 ability-exec 的 `doEntityAbility`（与能力层同一条 `executeDescriptor` 管线；
//     费用、上限、日志、目标注入共用一套）；
//   · actionKind：`actionKind()` 先读描述子的 `actionKind`，再回退 `countsAs`；
//   · 借机攻击豁免：dispatch 把 `actionKind === 'parley'` 的 entityAbility 都视为不引发借机攻击；
//   · 构筑：`isParleyCard(card, code)` 供调查员能力（如普雷斯顿）判断「这张牌带谈判」。
//
// 本模块是纯函数（只读注册表与 state）：不 import 引擎装配点，也不改状态。

import { registeredEntry } from './ability.js'
import { all as matchAll } from './matcher.js'
import { enumerateTargets } from './targets.js'
import { capabilityBlocked, entityRuleActive } from './modifiers.js'

export function scenarioReferenceEntity(state) {
  return registeredEntry(state.scenario?.originalCode || state.scenario?.code)?.scope === 'scenario' ? state.scenario : null
}
export function activeStageEntities(state) {
  return [state.acts?.[state.actIndex], state.agendas?.[state.agendaIndex]].filter(Boolean)
}
export function actionEntityById(state, id) {
  return [...(state.enemies || []), ...(state.locations || []), ...(state.storyAssets || []),
    ...(state.locations || []).flatMap(location => location.attachments || []),
    ...activeStageEntities(state), scenarioReferenceEntity(state)].filter(Boolean).find(entity => entity.id === id)
}
// 地点附属实体（07299 石障）：附属对象本身没有 location 字段，宿主地点由归属扫描得到。
export function locationOfAttachment(state, attachment) {
  if (!attachment) return null
  return (state.locations || []).find(location => (location.attachments || []).includes(attachment))?.id || null
}
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
  return entityActionDescriptors(entity).filter(isParleyDescriptor)
}

export function entityActionDescriptors(entity) {
  const entry = registeredEntry(entity?.originalCode || entity?.code)
  // 07299 这类「地点附属卡自身行动」：描述子放在 treacheryRule.attachmentAbilities，
  // 枚举/执行与实体 abilities 共用同一条管线（actionEntityById 会把附属对象本身交进来）。
  if (entry?.treacheryRule?.attachmentAbilities?.length) return entry.treacheryRule.attachmentAbilities
  return (entry?.abilities || []).filter(ability =>
    ['action', 'free'].includes(ability.kind) && typeof ability.actionKind === 'string')
}

// 「附属支援上的“[action]”能力不能触发」（07099 机械故障）：宿主实体上挂了声明该规则的附属时，
// 宿主的 action 类描述子不进入合法表；forced/reaction 照常。
export function hostActionsSuppressed(state, entity) {
  return (entity?.attachments || []).some(attachment =>
    registeredEntry(attachment.originalCode || attachment.code)?.treacheryRule?.suppressesHostActions === true)
}

export function entityAbilityInRange(state, inv, entity, descriptor) {
  if (descriptor.range === 'anywhere') return true
  const location = state.locations.includes(entity) ? entity.id : entity.location
    ?? locationOfAttachment(state, entity)
    ?? state.investigators.find(owner => [...(owner.assets || []), ...(owner.threat || [])].includes(entity))?.location
  if (location === inv.location) return !state.locations.includes(entity) || entity.revealed
  return descriptor.range === 'connecting' && state.locations.find(loc => loc.id === inv.location)?.connections?.includes(location)
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

// 「不能谈判」的唯一读点（合法性枚举与执行前校验共用，避免只有选择器受保护）：
//   · 目标实体侧：`cannot:parley` 实体规则——敌人自己的条目、所在地点，以及幕/议程
//     （07124–07127「每个[[嫌犯]]敌人…不能与之谈判」、07061「绑架犯…不能与之谈判」）；
//   · 调查员侧：`capability:parley` 能力禁止（07107「调查员不能谈判」）。
// 剧本 chapter 自己声明的临时限制仍走 scenarioBehavior.parleyBlocked（既有通道）。
export function parleyForbidden(state, inv, entity) {
  if (!entity) return false
  if (capabilityBlocked(state, inv, 'parley')) return true
  return entityRuleActive(state, entity, 'cannot:parley')
}

// 某个实体此刻可以执行的谈判行动（每个目标展开成一条）。
// `matchAll(descriptor.criteria)` 与玩家卡能力共用同一份条件组合子；成本与上限在执行时再校验
// （与 legalMoves 对玩家卡的处理一致：缺条件的能力不出现在列表里）。
export function parleyMoves(state, inv, entity, entityType, usable = null) {
  const out = []
  const descriptors = entityActionDescriptors(entity)
  descriptors.forEach((descriptor, abilityIndex) => {
    if (!entityAbilityInRange(state, inv, entity, descriptor)) return
    if (descriptor.kind === 'action' && hostActionsSuppressed(state, entity)) return
    if (isParleyDescriptor(descriptor) && parleyForbidden(state, inv, entity)) return
    if (usable && !usable(entity, descriptor)) return
    if (!usable && descriptor.criteria) {
      const matched = matchAll(descriptor.criteria)({ state, inv, source: entity, windowId: state.timingWindow, context: {} })
      if (!matched) return
    }
    const base = { action: 'entityAbility', entityType, entityId: entity.id, abilityIndex,
      ...(['act','agenda','scenario'].includes(entityType)?{scriptCard:entityType}:{uiKey:`${entityType==='storyAsset'?'asset':entityType}:${entity.id}`}) }
    if (!descriptor.target) {
      out.push({ ...base, actionKind: descriptor.actionKind, label: `${isParleyDescriptor(descriptor) ? '🤝' : '📍'} ${descriptor.label}` })
      return
    }
    const targets = enumerateTargets(state, inv, descriptor.target, { source: entity })
    for (const target of targets) {
      out.push({ ...base, targetId: target.id, actionKind: descriptor.actionKind,
        label: `🤝 ${descriptor.label} → ${target.label || target.name || target.id}` })
    }
  })
  return out
}

// 当前调查员能用的全部谈判行动：本地点、同地点敌人、同地点剧情资产。
export function parleyMovesFor(state, inv, usable = null) {
  if (!inv) return []
  const out = []
  for (const location of state.locations || []) out.push(...parleyMoves(state, inv, location, 'location', usable))
  for (const enemy of state.enemies || []) {
    out.push(...parleyMoves(state, inv, enemy, 'enemy', usable))
  }
  for (const asset of state.storyAssets || []) {
    out.push(...parleyMoves(state, inv, asset, 'storyAsset', usable))
  }
  // 地点附属卡自身行动（07299 石障）：宿主地点上的调查员才能用；entityId 是附属对象 id。
  for (const location of state.locations || []) {
    for (const attachment of location.attachments || []) {
      if (!registeredEntry(attachment.originalCode || attachment.code)?.treacheryRule?.attachmentAbilities?.length) continue
      out.push(...parleyMoves(state, inv, attachment, 'locationAttachment', usable))
    }
  }
  // 剧情支援/敌人身上的附属卡自身行动（07099 机械故障的「[action] 智力(3) 弃掉本卡」）。
  for (const host of [...(state.storyAssets || []), ...(state.enemies || [])]) {
    for (const attachment of host.attachments || []) {
      if (!registeredEntry(attachment.originalCode || attachment.code)?.treacheryRule?.attachmentAbilities?.length) continue
      out.push(...parleyMoves(state, inv, attachment, 'encounterAttachment', usable))
    }
  }
  const reference=scenarioReferenceEntity(state)
  if(reference)out.push(...parleyMoves(state,inv,reference,'scenario',usable))
  for (const stage of activeStageEntities(state)) out.push(...parleyMoves(state, inv, stage, registeredEntry(stage.originalCode || stage.code)?.scope || 'act', usable))
  return out
}

// 执行前的目标合法性：返回 null 表示可用，否则返回原因（validateMove 与 dispatch 共用）。
export function parleyTargetError(state, inv, entity, descriptor, move) {
  if (!descriptor) return '该实体没有这条谈判能力'
  if (isParleyDescriptor(descriptor) && parleyForbidden(state, inv, entity)) return '不能与之谈判'
  if (!descriptor.target) return null
  const targets = enumerateTargets(state, inv, descriptor.target, { source: entity })
  if (!targets.length) return '没有合法的谈判目标'
  if (move.targetId == null) return '需要选择谈判目标'
  return targets.some(target => String(target.id) === String(move.targetId)) ? null : '谈判目标不合法'
}
