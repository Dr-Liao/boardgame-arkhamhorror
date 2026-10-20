// 诡镇奇谈：卡牌版 · 费用表达式（缺口 C3，Phase 2）
//
// 此前的症状：`cost` 只能是静态对象（`{ resources: 2 }`），所以
//   · 「X 费」「每有 1 个线索付 1 资源」「替代费用」「团队支付」都表达不了；
//   · 付不付得起要在引擎里按卡号写 if（`canAffordAbility` 只看数字）；
//   · 牌桌/AI 看到的费用是死的，动态费用没法预览。
//
// 本模块把「费用」变成可求值的表达式：
//   1. 每个费用字段仍可写数字（静态，零成本路径不变）；
//   2. 也可以写函数 `({ state, inv, source }) => number`（与 modifiers.amount 同一套逃生口）；
//   3. 推荐写声明式表达式对象：
//        { per: 'clues', amount: 1, offset: 0, min: 0, max: 4, filter: { trait: 'Tome' } }
//      `per` 取值：clues / resources / damage / horror / assets / investigators /
//      enemiesHere / usesOnSource / cardsInHand / cardsInDiscard / locationsConnected
//   4. 费用对象里可以出现 `x: true` 表示「按 X 支付」，X 由 `state.abilityX` 给出
//      （内容层通过 `api.chooseX()` 询问，结算时写进 state，因此可重放）。
//
// 三个读点，一个求值器：
//   evaluateCost(cost, ctx)    → 全数值的费用对象（引擎付费用它）
//   canPayCost(cost, ctx)      → 付得起吗（与付费共用一份求值结果）
//   describeCost(cost, ctx)    → 给牌桌/AI 的文案（"付 3 资源" / "付等同线索数的资源"）
//
// 约定：求值不修改 state；`x` 只读 `ctx.state.abilityX`；函数抛异常按「付不起」处理，
// 与 matcher 的条件同一条纪律（写错内容不应该炸掉对局）。

// 允许写表达式的费用字段（与 ability.js 的 COST_KEYS 取交集，布尔字段除外）。
export const NUMERIC_COST_KEYS = Object.freeze([
  'resources', 'clues', 'uses', 'horror', 'damageSelf', 'assetDamage', 'discardHand',
])

// 布尔费用字段：只能是 true/false，不参与表达式求值。
export const FLAG_COST_KEYS = Object.freeze(['action', 'exhaust', 'discardSelf', 'exileSelf'])

export const COST_EXPRESSION_KEYS = Object.freeze([
  'per', 'amount', 'offset', 'min', 'max', 'filter', 'fromSource', 'x',
])

export const PER_SOURCES = Object.freeze([
  'clues', 'resources', 'damage', 'horror', 'assets', 'investigators',
  'enemiesHere', 'usesOnSource', 'cardsInHand', 'cardsInDiscard', 'locationsConnected',
])

const isExpression = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).some(key => COST_EXPRESSION_KEYS.includes(key))

export function isCostExpression(value) {
  return typeof value === 'function' || isExpression(value)
}

// 注册期校验：未知字段、未知 per、非法的 min/max 都在模块加载时报错。
export function validateCostValue(key, value, origin = 'cost') {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${origin}: ${key} 必须是非负数字`)
    return
  }
  if (typeof value === 'function') return
  if (!isExpression(value)) throw new Error(`${origin}: ${key} 必须是数字、函数或费用表达式`)
  for (const field of Object.keys(value)) {
    if (!COST_EXPRESSION_KEYS.includes(field)) throw new Error(`${origin}: ${key} 表达式含未知字段 ${field}`)
  }
  if (value.per != null && !PER_SOURCES.includes(value.per)) {
    throw new Error(`${origin}: ${key}.per 只能是 ${PER_SOURCES.join(' / ')} 之一`)
  }
  if (value.per == null && value.x !== true && value.offset == null) {
    throw new Error(`${origin}: ${key} 表达式必须声明 per 或 x: true 或 offset`)
  }
  for (const field of ['amount', 'offset', 'min', 'max']) {
    if (value[field] != null && typeof value[field] !== 'number') throw new Error(`${origin}: ${key}.${field} 必须是数字`)
  }
  if (value.filter != null) {
    if (typeof value.filter !== 'object' || Array.isArray(value.filter)) throw new Error(`${origin}: ${key}.filter 必须是对象`)
    for (const field of Object.keys(value.filter)) {
      if (!['trait', 'type', 'usesType', 'unique'].includes(field)) throw new Error(`${origin}: ${key}.filter 含未知字段 ${field}`)
    }
  }
}

const traitList = card => (card?.traits || []).map(trait => String(trait).toLowerCase())

function countMatching(inv, filter) {
  if (!filter) return (inv?.assets || []).length
  return (inv?.assets || []).filter(asset => {
    if (filter.trait && !traitList(asset).includes(String(filter.trait).toLowerCase())) return false
    if (filter.type && asset.type !== filter.type) return false
    if (filter.usesType) {
      const wanted = String(filter.usesType).toLowerCase()
      const actual = String(asset.usesType || '').toLowerCase()
      if (actual !== wanted && actual !== `${wanted}s`) return false
    }
    if (filter.unique != null && Boolean(asset.unique) !== Boolean(filter.unique)) return false
    return true
  }).length
}

function perValue(per, ctx) {
  const { state, inv, source } = ctx
  switch (per) {
    case 'clues': return inv?.clues || 0
    case 'resources': return inv?.resources || 0
    case 'damage': return inv?.damage || 0
    case 'horror': return inv?.horror || 0
    case 'assets': return countMatching(inv, ctx.filter)
    case 'investigators': return (state?.investigators || []).filter(item => !item.defeated && !item.resigned).length
    case 'enemiesHere':
      return (state?.enemies || []).filter(enemy => enemy.location === inv?.location).length
    case 'usesOnSource': return source?.uses || 0
    case 'cardsInHand': return (inv?.hand || []).length
    case 'cardsInDiscard': return (inv?.discard || []).length
    case 'locationsConnected': {
      const here = (state?.locations || []).find(location => location.id === inv?.location)
      return (here?.connections || []).length
    }
    default: return 0
  }
}

function clamp(value, min, max) {
  let out = value
  if (typeof min === 'number') out = Math.max(min, out)
  if (typeof max === 'number') out = Math.min(max, out)
  return out
}

function evaluateExpression(expression, ctx) {
  // `x: true`：X 由玩家在本次能力里选择（state.abilityX），因此可重放。
  if (expression.x === true) {
    const x = Number(ctx?.state?.abilityX ?? 0)
    const amount = Number(expression.amount ?? 1)
    return clamp(x * amount + Number(expression.offset ?? 0), expression.min, expression.max)
  }
  const per = expression.per ? perValue(expression.per, { ...ctx, filter: expression.filter }) : 0
  const amount = Number(expression.amount ?? 1)
  return clamp(per * amount + Number(expression.offset ?? 0), expression.min, expression.max)
}

/**
 * 把一份（可能带表达式的）费用求值成全数值对象。
 * ctx: { state, inv, source, descriptor, target }
 */
export function evaluateCost(cost, ctx = {}) {
  const out = { ...(cost || {}) }
  for (const key of NUMERIC_COST_KEYS) {
    const value = out[key]
    if (value == null) continue
    if (typeof value === 'number') continue
    try {
      out[key] = typeof value === 'function'
        ? Math.max(0, Number(value(ctx)) || 0)
        : Math.max(0, Number(evaluateExpression(value, ctx)) || 0)
    } catch {
      // 条件写错 → 视为付不起（用 NaN 让 canPayCost 返回 false）。
      out[key] = Number.NaN
    }
  }
  return out
}

export function costIsDynamic(cost) {
  if (!cost) return false
  return NUMERIC_COST_KEYS.some(key => isCostExpression(cost[key]))
}

// 求值并校验：任何字段算出 NaN（内容写错）都返回 null，调用方按"付不起"处理。
// 引擎的 canAffordAbility 与 payAbilityCost 共用它，保证"预览 = 校验 = 扣费"。
export function normalizeCostValues(cost, ctx = {}) {
  const value = evaluateCost(cost, ctx)
  for (const key of NUMERIC_COST_KEYS) {
    // 未声明的字段保持 undefined（不能被当成 NaN）。
    if (value[key] !== undefined && !Number.isFinite(value[key])) return null
  }
  return value
}

// 文案：动态费用必须能解释"为什么是 3"，否则 AI 与牌桌都只能看到结果。
const PER_LABELS = Object.freeze({
  clues: '线索数', resources: '资源数', damage: '已受伤害', horror: '已受恐惧',
  assets: '符合条件的支援数', investigators: '调查员人数', enemiesHere: '此地敌人数量',
  usesOnSource: '本卡剩余使用次数', cardsInHand: '手牌数', cardsInDiscard: '弃牌堆张数',
  locationsConnected: '连接地点数',
})

const COST_LABELS = Object.freeze({
  resources: '资源', clues: '线索', uses: '使用次数', horror: '恐惧',
  damageSelf: '伤害', assetDamage: '自身伤害', discardHand: '手牌',
})

export function describeCost(cost, ctx = {}) {
  if (!cost) return ''
  const parts = []
  if (cost.exhaust) parts.push('横置')
  for (const key of NUMERIC_COST_KEYS) {
    if (cost[key] == null) continue
    const label = COST_LABELS[key] || key
    if (typeof cost[key] === 'number') {
      if (cost[key] > 0) parts.push(`${cost[key]} ${label}`)
      continue
    }
    const expression = cost[key]
    if (typeof expression === 'function') {
      parts.push(`动态 ${label}`)
      continue
    }
    const value = evaluateExpression(expression, { ...ctx, filter: expression.filter })
    parts.push(`${Number.isFinite(value) ? value : '?'} ${label}（按${PER_LABELS[expression.per] || 'X'}）`)
  }
  if (cost.discardSelf) parts.push('弃掉自身')
  if (cost.exileSelf) parts.push('放逐自身')
  return parts.join('、')
}
