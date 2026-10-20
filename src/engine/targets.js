// 诡镇奇谈：卡牌版 · 描述子目标枚举（缺口 B1，Phase 1）
//
// 此前的症状：描述子虽然有 `target` 字段，但**没人读**——目标只能在 resolve() 里
// 再问一轮 requestChoice；牌桌因此没法先选目标，AI 也要多走一轮。
//
// 本模块把「这条能力能指向谁」变成一个可枚举的纯函数：
//   · 描述子声明 `target: { kind, query?, optional? }`；
//   · `enumerateTargets()` 返回候选 [{ id, label, kind, entity }]；
//   · legalMoves 按候选展开成逐目标行动，validateMove 用同一份枚举校验，
//     执行时由引擎把命中的实体注入 `ctx.target`。
//
// 约定位：
//   · query 是 matcher.js 风格的 predicate（或数组，全部满足），ctx 里带 `candidate`；
//   · 候选集合是「默认范围」——query 只能收窄，不能扩大：
//       enemy        同地点的敌人
//       investigator 同地点（含自己）且未败退/未撤退的调查员
//       location     当前地点与所有连接地点
//       asset        自己控制的支援与威胁区卡牌
//       cardInHand   手牌里的卡号（去重）
//   · 目标枚举只读 state，不修改任何东西，也没有随机性。

import { all } from './matcher.js'

export const TARGET_KINDS = Object.freeze(['enemy', 'investigator', 'location', 'asset', 'cardInHand'])

const TARGET_KEYS = new Set(['kind', 'query', 'optional', 'label'])

function normalizedQuery(raw, origin) {
  if (raw == null) return null
  if (typeof raw === 'function') return raw
  if (Array.isArray(raw)) {
    if (!raw.every(item => typeof item === 'function')) {
      throw new Error(`${origin}: target.query 数组的元素必须是函数`)
    }
    return all(...raw)
  }
  throw new Error(`${origin}: target.query 必须是函数或其数组`)
}

export function normalizeTarget(raw, origin = 'target') {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: target 必须是对象`)
  for (const key of Object.keys(raw)) {
    if (!TARGET_KEYS.has(key)) throw new Error(`${origin}: target 未知字段 ${key}`)
  }
  if (!TARGET_KINDS.includes(raw.kind)) {
    throw new Error(`${origin}: target.kind 必须是 ${TARGET_KINDS.join(' / ')} 之一（收到 ${JSON.stringify(raw.kind)}）`)
  }
  return Object.freeze({
    kind: raw.kind,
    query: normalizedQuery(raw.query, origin),
    optional: raw.optional === true,
    label: raw.label ? String(raw.label) : null,
  })
}

function cardNameOf(state, code) {
  const def = state?.cards?.[code]
  return def?.nameZh || def?.name || code
}

function cardTraits(state, code) {
  return (state?.cards?.[code]?.traits || []).map(trait => String(trait).toLowerCase())
}

function candidateList(state, inv, kind) {
  const location = inv?.location
  switch (kind) {
    case 'enemy':
      return (state?.enemies || []).filter(enemy => enemy.location === location)
        .map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code, kind, entity: enemy }))
    case 'investigator':
      return (state?.investigators || [])
        .filter(other => !other.defeated && !other.resigned && other.location === location)
        .map(other => ({ id: String(other.seat), label: other.name, kind, entity: other }))
    case 'location': {
      const here = (state?.locations || []).find(entry => entry.id === location)
      const ids = new Set([location, ...(here?.connections || [])])
      return (state?.locations || []).filter(entry => ids.has(entry.id))
        .map(entry => ({ id: entry.id, label: entry.name || entry.id, kind, entity: entry }))
    }
    case 'asset':
      return [...(inv?.assets || []), ...(inv?.threat || [])]
        .map(card => ({ id: card.id, label: cardNameOf(state, card.code), kind, entity: card }))
    case 'cardInHand':
      return [...new Set(inv?.hand || [])]
        .map(code => ({ id: code, label: cardNameOf(state, code), kind, entity: { code } }))
    default:
      return []
  }
}

// ctx: { state, inv, source, windowId, context }（与 matcher.js 的 predicate ctx 一致）
export function enumerateTargets(state, inv, target, ctx = {}) {
  if (!target) return []
  const base = { state, inv, source: ctx.source ?? null, windowId: ctx.windowId ?? null, context: ctx.context ?? {} }
  const candidates = candidateList(state, inv, target.kind)
  if (!target.query) return candidates
  return candidates.filter(candidate => {
    try {
      return target.query({ ...base, candidate, entity: candidate.entity, cardTraits: code => cardTraits(state, code) }) === true
    } catch {
      return false
    }
  })
}

// 供 AI 上下文/测试使用的轻量描述：把一条 target 声明翻成「可读的中文范围」。
export function describeTarget(target) {
  if (!target) return null
  const scope = {
    enemy: '同地点的敌人',
    investigator: '同地点的调查员',
    location: '当前或连接地点',
    asset: '你控制的支援或威胁卡',
    cardInHand: '你手牌中的卡牌',
  }[target.kind] || target.kind
  return target.label || scope
}

// 执行期解析：把 move.targetId 还原成实体（校验已在 validateMove 里做过，
// 这里再走一次同一份枚举，保证「能选的」与「能执行的」永远一致）。
export function resolveTarget(state, inv, target, targetId, ctx = {}) {
  if (!target || targetId == null) return null
  const id = String(targetId)
  return enumerateTargets(state, inv, target, ctx).find(candidate => String(candidate.id) === id) || null
}
