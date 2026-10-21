// 诡镇奇谈：卡牌版 · 打出条件单一读点（Phase 1 的 playCondition 收敛）
//
// 此前的症状：可用性散在 10 个顶层字段里（ownTurnOnly / duringOwnTurn /
// firstActionOnly / requiresClue / requiresClueAtLocation / requiresNoEnemies /
// requiresRemainingSanity / requiresResign / playableFromDiscard / playableWeakness），
// engine.js 在 legalMoves 与 validateMove 两处各读一遍，读点与文案容易漂移。
//
// Phase 1 起只有一个读点：
//   · 描述子化卡牌在条目上写 `playCondition: [ownTurn(), noEnemiesHere()]`；
//   · 旧 DSL 卡牌的 10 个字段在 LEGACY_RULES 里翻译成同样的 predicate + 文案；
//   · 引擎只调用 playConditionError() / playAccess()，不再读这些字段。
//
// 收敛规则：
//   · 描述子与旧字段可以同时生效（迁移期 hybrid 卡）；先判描述子，再判旧字段。
//   · 条件抛异常一律按「不满足」处理（与 matcher.js 一致）。
//   · 文案就是玩家/AI 看到的拒绝原因，迁移时必须逐字保留。

import { EFFECTS } from '../cards/card-effects.js'
import { descriptorOfKind, playConditionFor, registeredEntry } from './ability.js'
import {
  clueAtLocation, investigatorClues, noEnemiesHere, ownFirstAction, ownTurn,
  remainingSanityAtLeast, resignAvailable,
} from './matcher.js'

// 冻结清单：新增可用性字段必须先把它并进 playCondition（架构守卫会比对这份列表）。
export const LEGACY_PLAY_CONDITION_FIELDS = Object.freeze([
  'ownTurnOnly', 'duringOwnTurn', 'firstActionOnly', 'requiresClue', 'requiresClueAtLocation',
  'requiresNoEnemies', 'requiresRemainingSanity', 'requiresResign', 'playableFromDiscard', 'playableWeakness',
])

// 判定顺序与 engine 原实现一致：同样的多处条件同时不满足时，报错文案不变。
const LEGACY_RULES = Object.freeze([
  {
    field: 'requiresClueAtLocation',
    message: () => '当前地点没有线索',
    test: clueAtLocation(),
  },
  {
    field: 'requiresClue',
    message: () => '需要至少 1 个线索才能打出',
    test: investigatorClues(1),
  },
  {
    field: 'requiresRemainingSanity',
    message: requirement => `剩余神志不足 ${requirement} 点`,
    test: (ctx, requirement) => remainingSanityAtLeast(requirement)(ctx),
  },
  {
    field: 'firstActionOnly',
    message: () => '只能作为本回合的第一个行动打出',
    test: ownFirstAction(),
  },
  {
    field: 'requiresNoEnemies',
    message: () => '当前地点有敌人',
    test: noEnemiesHere(),
  },
  {
    field: 'ownTurnOnly',
    message: () => '只能在自己的回合打出',
    test: ownTurn(),
  },
  {
    field: 'duringOwnTurn',
    message: () => '只能在自己的回合打出',
    test: ownTurn(),
  },
  {
    field: 'requiresResign',
    message: () => '场上没有带「撤退」能力的剧本卡',
    test: resignAvailable(),
  },
])

// 旧 DSL 条目（未迁移的卡）仍然提供这些字段；迁移后条目消失，规则自然失效。
export function legacyPlayFields(code) {
  return EFFECTS[code] || {}
}

// 描述子条目声明的打出条件（能力层写法）。
export function declaredPlayConditions(code) {
  return playConditionFor(code) || []
}

// 区域/类型级许可：哪些区域可以打出、能否作为弱点打出、是否只能走反应窗口。
// 与上面的「条件」分开，因为这些会改变 legalMoves 的候选集合，而不是给出拒绝原因。
function entryPlayableFromDiscard(code) {
  const entry = registeredEntry(code)
  return entry?.playableFromDiscard === true
}

export function playAccess(code) {
  const effect = legacyPlayFields(code)
  // 快速事件搬到能力层后，fast + trigger 的 played 描述子同样只能在反应窗口打出。
  const descriptor = descriptorOfKind(code, 'played')
  const reactionOnly = Boolean(effect.reaction) || (descriptor?.fast === true && descriptor.trigger.length > 0)
  return {
    fromDiscard: effect.playableFromDiscard === true || descriptor?.playableFromDiscard === true
      || (descriptorOfKind(code, 'played') ? false : false) || entryPlayableFromDiscard(code),
    playableWeakness: registeredEntry(code)?.playableWeakness === true || effect.playableWeakness === true,
    reactionOnly,
    limitPerInvestigator: Boolean(registeredEntry(code)?.limitPerInvestigator ?? effect.limitPerInvestigator),
  }
}

function evaluate(item, ctx) {
  try {
    return item.when(ctx) === true
  } catch {
    return false
  }
}

/**
 * 打出条件判定：返回第一条不满足的文案，全部满足返回 null。
 * @param {object} state 权威状态
 * @param {object} inv 打牌的人
 * @param {string} code 卡号
 * @param {object} helpers 引擎注入的读数（maxSanity / resignAvailable），避免本模块反向依赖引擎
 */
export function playConditionError(state, inv, code, helpers = {}) {
  const ctx = { state, inv, source: { code }, helpers }
  for (const item of declaredPlayConditions(code)) {
    if (!evaluate(item, ctx)) return item.message || '不满足卡面的打出条件'
  }
  const legacy = legacyPlayFields(code)
  for (const rule of LEGACY_RULES) {
    const requirement = legacy[rule.field]
    if (!requirement) continue
    if (rule.test(ctx, requirement)) continue
    return rule.message(requirement)
  }
  return null
}

// 审计/报告用：把「这张卡的可用性由什么决定」汇总成一份可读清单。
export function describePlayCondition(code) {
  const rows = []
  for (const item of declaredPlayConditions(code)) rows.push({ source: 'descriptor', message: item.message || null })
  const legacy = legacyPlayFields(code)
  for (const rule of LEGACY_RULES) {
    if (!legacy[rule.field]) continue
    rows.push({ source: 'legacy', field: rule.field, message: rule.message(legacy[rule.field]) })
  }
  return rows
}
