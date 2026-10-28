// 诡镇奇谈：卡牌版 · 上限的作用域与归属（缺口 C4，Phase 2）
//
// 此前的症状：上限只有 5 个字符串（oncePerTest/Phase/Round/Turn/Game），
//   · 缺「每次攻击 / 每次搜索 / 每次窗口 / 整个战役」这些真实存在的频率；
//   · 归属被写死成「实例 id，没有实例就按座位」——「每名调查员一次」「团队一次」
//     「玩家（座位）一次」三种语义混在一起，同名两份支援的账也没法统一；
//   · 上限只能 1 次，不能声明 count。
//
// 本模块把上限做成 (scope, owner, count) 三件事：
//   limit: 'oncePerTurn'                                   // 兼容旧写法
//   limit: { scope: 'oncePerTurn', owner: 'instance' }      // 等价于旧写法
//   limit: { scope: 'perWindow', owner: 'player' }
//   limit: { scope: 'perAttack', owner: 'instance', count: 2 }
//
// scope（何时清零）：
//   perTest / perTurn / perPhase / perRound / perGame / perCampaign
//   perWindow   每次打开同名窗口算一次（引擎传 windowId）
//   perAttack   每次攻击结算算一次（引擎传 attackKey）
//   perSearch   每次搜索结算算一次（引擎传 searchKey）
//   perAction   每次行动算一次（引擎传 moveSerial）
//
// owner（谁共用一个账本）：
//   instance      按来源实例（默认；同名两份支援各用一次）
//   investigator  按调查员（同一人的所有副本共用）
//   player        按座位（没有实例的从手牌打出的能力）
//   group         全队共用（「团队每轮一次」）
//
// 记账格式：state.abilityLimits[key] = { used, round, phase, turn }。
// 读档后仍然有效（纯 JSON），且 legalMoves / validateMove / 结算三处读同一份账。

export const LIMIT_SCOPES = Object.freeze([
  'perTest', 'perTurn', 'perPhase', 'perRound', 'perGame', 'perCampaign',
  'perWindow', 'perAttack', 'perSearch', 'perAction',
])

export const LIMIT_OWNERS = Object.freeze(['instance', 'investigator', 'player', 'group'])

// 旧字符串写法 → 新对象写法。旧表只有 5 个，且语义就是 instance/player 两种归属。
const LEGACY_SCOPES = Object.freeze({
  oncePerTest: { scope: 'perTest', owner: 'instance', count: 1 },
  oncePerPhase: { scope: 'perPhase', owner: 'instance', count: 1 },
  oncePerRound: { scope: 'perRound', owner: 'instance', count: 1 },
  oncePerTurn: { scope: 'perTurn', owner: 'instance', count: 1 },
  oncePerGame: { scope: 'perGame', owner: 'instance', count: 1 },
})

export const LEGACY_LIMIT_NAMES = Object.freeze(Object.keys(LEGACY_SCOPES))

const LIMIT_KEYS = new Set(['scope', 'owner', 'count'])

/**
 * 规范化上限声明。返回 null（无上限）或冻结对象 { scope, owner, count, label }。
 */
export function normalizeLimit(raw, origin = 'limit') {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const mapped = LEGACY_SCOPES[raw]
    if (!mapped) {
      throw new Error(`${origin}: 未知 limit ${JSON.stringify(raw)}`
        + `（旧写法可选：${LEGACY_LIMIT_NAMES.join(' / ')}；新写法用 { scope, owner, count }）`)
    }
    return Object.freeze({ ...mapped, label: raw })
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${origin}: limit 必须是字符串或对象`)
  for (const key of Object.keys(raw)) if (!LIMIT_KEYS.has(key)) throw new Error(`${origin}: limit 未知字段 ${key}`)
  if (!LIMIT_SCOPES.includes(raw.scope)) {
    throw new Error(`${origin}: limit.scope 必须是 ${LIMIT_SCOPES.join(' / ')} 之一（收到 ${JSON.stringify(raw.scope)}）`)
  }
  const owner = raw.owner || 'instance'
  if (!LIMIT_OWNERS.includes(owner)) {
    throw new Error(`${origin}: limit.owner 必须是 ${LIMIT_OWNERS.join(' / ')} 之一（收到 ${JSON.stringify(owner)}）`)
  }
  const count = raw.count ?? 1
  if (!Number.isInteger(count) || count < 1) throw new Error(`${origin}: limit.count 必须是正整数`)
  return Object.freeze({ scope: raw.scope, owner, count, label: `${raw.scope}/${owner}×${count}` })
}

// scope → 该次结算的作用域串。ctx 里放引擎能提供的最细粒度标识。
function scopeKey(scope, state, ctx = {}) {
  switch (scope) {
    case 'perTest': return `test:${state?.skillTest?.id ?? `${state?.round}:${state?.turnSerial ?? 0}`}`
    case 'perTurn': return `turn:${state?.turnSerial ?? 0}:${state?.currentSeat ?? '-'}`
    case 'perPhase': return `round:${state?.round ?? 0}:phase:${state?.phase ?? '-'}`
    case 'perRound': return `round:${state?.round ?? 0}`
    case 'perGame': return `game:${state?.scenario?.id ?? state?.campaign?.id ?? '-'}`
    case 'perCampaign': return 'campaign'
    case 'perWindow': return `window:${ctx.windowId ?? '-'}:${ctx.windowInstance ?? '-'}`
    case 'perAttack': return `attack:${ctx.attackKey ?? '-'}`
    case 'perSearch': return `search:${ctx.searchKey ?? '-'}`
    case 'perAction': return `action:${ctx.moveSerial ?? state?.moveCount ?? 0}`
    default: return `unknown:${scope}`
  }
}

function ownerKey(owner, descriptor, source, inv) {
  switch (owner) {
    case 'instance': return source?.id ? `card:${source.id}` : `seat:${inv?.seat}:${descriptor.code}`
    case 'investigator': return `inv:${inv?.seat}:${descriptor.code}`
    case 'player': return `seat:${inv?.seat}:${descriptor.code}`
    case 'group': return `group:${descriptor.code}`
    default: return `seat:${inv?.seat}:${descriptor.code}`
  }
}

/**
 * 上限键。descriptor.limit 已经是 normalizeLimit 的结果（对象）。
 * 兼容：旧数据里可能仍是字符串，这里再规范化一次。
 */
export function limitKey(state, inv, descriptor, context = null, windowId = null, source = null) {
  const limit = descriptor?.limit
  if (!limit) return null
  const normalized = typeof limit === 'string' ? normalizeLimit(limit) : limit
  if (!normalized) return null
  const ctx = {
    ...(context || {}),
    ...(windowId ? { windowId } : {}),
  }
  return `${descriptor.id}|${ownerKey(normalized.owner, descriptor, source, inv)}|`
    + `${scopeKey(normalized.scope, state, ctx)}`
}

function usedCount(state, key) {
  const record = state?.abilityLimits?.[key]
  if (record == null) return 0
  // 旧存档写的是 { round, phase, turn }（等价于 used: 1）。
  if (typeof record === 'number') return record
  if (typeof record.used === 'number') return record.used
  return 1
}

// 「窗口实例」键：同一触发窗口内同一描述子只结算一次，但不同触发窗口可以再次使用。
// 取「窗口名 + 轮/阶段/回合 + 行动序号 + 窗口主体」的组合，既跨续算稳定（纯数据、可重放），
// 也能区分同一轮里对同一个敌人的两次躲避（两次躲避是两次行动，moveCount 不同）。
function windowInstanceKey(state, context = null, windowId = null) {
  const subject = context?.enemy?.id ?? context?.cardCode ?? context?.location ?? ''
  return [windowId ?? '', state?.round ?? 0, state?.phase ?? '', state?.turnSerial ?? 0,
    state?.moveCount ?? 0, subject].join('|')
}

export function limitUsed(state, inv, descriptor, context = null, windowId = null, source = null) {
  const key = limitKey(state, inv, descriptor, context, windowId, source)
  if (!key) return false
  // 「直到本轮结束，忽略这条能力的限制」（05005 丽塔·杨的旧印）：
  // 忽略期间上限本身不挡（能在后续触发里再次使用），但**同一窗口实例**内仍然只结算一次，
  // 否则能力窗口的询问循环会对同一次躲避反复提供同一条反应。
  if (limitIgnored(state, descriptor)) {
    const record = state.abilityLimits?.[key]
    return Boolean(record && record.windowInstance != null
      && record.windowInstance === windowInstanceKey(state, context, windowId))
  }
  const limit = typeof descriptor.limit === 'string' ? normalizeLimit(descriptor.limit) : descriptor.limit
  return usedCount(state, key) >= (limit?.count ?? 1)
}

export function markLimitUsed(state, inv, descriptor, context = null, windowId = null, source = null) {
  const key = limitKey(state, inv, descriptor, context, windowId, source)
  if (!key) return
  state.abilityLimits ||= {}
  const used = usedCount(state, key) + 1
  state.abilityLimits[key] = {
    used,
    round: state.round,
    phase: state.phase,
    turn: state.turnSerial ?? 0,
    // 窗口实例键（忽略上限时用来去重同一窗口）。
    windowInstance: windowInstanceKey(state, context, windowId),
  }
}

// 「忽略某条能力的限制」的开关注账：只记轮次，过轮自动失效（读点 limitIgnored）。
// 存的是描述子 id 而非卡号，任何卡都能用同一条原语（旧印 / 「无视每轮一次」类效果）。
export function ignoreLimitForRound(state, descriptorId) {
  const id = descriptorId == null ? '' : String(descriptorId)
  if (!id) return false
  state.limitOverrides ||= {}
  state.limitOverrides[id] = { round: state.round }
  return true
}

export function limitIgnored(state, descriptor) {
  const id = descriptor?.id
  if (!id) return false
  const override = state?.limitOverrides?.[id]
  return Boolean(override && override.round === state?.round)
}

const SCOPE_TEXT = Object.freeze({
  perTest: '每次检定', perTurn: '每回合', perPhase: '每阶段', perRound: '每轮',
  perGame: '每场游戏', perCampaign: '整个战役', perWindow: '每次窗口', perAttack: '每次攻击',
  perSearch: '每次搜索', perAction: '每次行动',
})

const OWNER_TEXT = Object.freeze({
  instance: '每张卡', investigator: '每名调查员', player: '每个玩家', group: '团队',
})

function normalizedOf(descriptor) {
  const limit = descriptor?.limit
  if (!limit) return null
  return typeof limit === 'string' ? normalizeLimit(limit) : limit
}

// 审计/AI 上下文：把一条上限翻成中文。
export function describeLimit(descriptor) {
  const normalized = normalizedOf(descriptor)
  if (!normalized) return null
  const scope = SCOPE_TEXT[normalized.scope] || normalized.scope
  const owner = OWNER_TEXT[normalized.owner] || normalized.owner
  return `${owner}${scope} ${normalized.count} 次`
}

// 牌桌文案：省略「每张卡」这种实例归属，只留频率本身（实例能力默认就是每张一次）。
export function describeLimitShort(descriptor) {
  const normalized = normalizedOf(descriptor)
  if (!normalized) return null
  const scope = SCOPE_TEXT[normalized.scope] || normalized.scope
  const owner = normalized.owner === 'instance' ? '' : (OWNER_TEXT[normalized.owner] || normalized.owner)
  return `${owner}${scope} ${normalized.count} 次`
}
