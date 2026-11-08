// frost.js · EotE 寒霜（frost）标记原语（P2）。
//
// 规则口径（《地球边缘》规则书）：
//   · 寒霜是固定 8 枚的实物标记；袋内、已揭示区、封印区共用同一批实物，效果「加入/移除
//     1 个 [frost]」只能在这 8 枚的物理池里增减，满池时不再加入（不凭空造标记）。
//   · 揭示 1 枚 frost：本次检定 -1，并额外揭示 1 枚混乱标记。
//   · 同一次技能检定揭示第 2 枚 frost：本次检定立即自动失败。
//
// 状态口径（诚实最小设计）：frost 不需要新的持久状态容器 —— 8 枚实物本来就存放在既有的
// `state.chaosBag / state.chaos.revealed / state.chaos.sealed` 里，计数、上限与支付全部复用
// `chaos-token-pool.js`（袋内＋揭示区＋封印区共用一个物理池）。因此本模块导出
// `EOTE_FROST_STATE = null`，**不**创建 `scenarioFlags.mechanics.eote.frost`，也不提升存档
// 版本；旧存档/旧战役不会因为加载本模块多出字段。
// 「本次检定第一枚 frost 视为 -3」这类按地点/章节生效的数值规则属于内容层，由单卡/章节通过
// `setTokenTreatment({ modifier })` 声明，不落新字段。
//
// 本模块是叶子模块：只依赖 chaos-token-pool.js，供 `ctx.api` 与测试读取。
import { POOL_LIMITS, addPoolTokens, payPoolTokens, poolTokenCount, poolTokenRoom } from './chaos-token-pool.js'

// 8 枚寒霜实物；与 chaos-token-pool.js#POOL_LIMITS.frost 同一个真源。
export const FROST_POOL_LIMIT = POOL_LIMITS.frost

// 寒霜没有独立的持久状态子记录：状态就是既有的混乱袋/揭示区/封印区。
export const EOTE_FROST_STATE = null

/** 全池寒霜枚数：袋内＋本次检定已揭示＋封印区，同一批 8 枚实物。 */
export function frostPoolCount(state) {
  return poolTokenCount(state, 'frost')
}

/** 还能加入几枚寒霜（0…8）。 */
export function frostPoolRoom(state) {
  return poolTokenRoom(state, 'frost')
}

/** 加入寒霜：走有限池校验（非负整数、上限 8）；满池时 `exact:true` 返回 false 且不写入。 */
export function addFrost(state, count, { exact = false } = {}) {
  return addPoolTokens(state, 'frost', count, { exact })
}

/** 支付/移除寒霜：默认只从袋内支付；不足时返回 false 且不产生部分写入。 */
export function payFrost(state, count, options) {
  return payPoolTokens(state, 'frost', count, options)
}

/** 揭示寒霜会让本次检定额外揭示 1 枚混乱标记。 */
export function extraRevealForFrost(token) {
  return token === 'frost'
}

/** 同一次技能检定揭示第 2 枚寒霜立即自动失败；入参为本次检定已揭示的标记面数组。 */
export function shouldAutoFailForFrost(drawn) {
  if (!Array.isArray(drawn)) throw new TypeError('揭示标记记录必须为数组')
  return drawn.filter(token => token === 'frost').length >= 2
}
