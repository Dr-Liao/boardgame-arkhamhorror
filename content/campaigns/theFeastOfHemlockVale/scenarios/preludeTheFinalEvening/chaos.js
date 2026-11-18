// 最终之夜（preludeTheFinalEvening · 10704「山谷」）· 混乱标记。
//
// 参考：Campaigns/TheFeastOfHemlockVale/TokenHelpers.hs
//   · hemlockPreludeChaosTokenValue —— 四个 symbol 的取值（三个序曲/勘察共用同一张参考卡）；
//   · hemlockPreludeResolveChaosToken —— [cultist]（简单/普通）谈判自动成功、[elder_thing] 谈判再揭示。
// 印刷文本：提示卡 10704 正/背面（cards-data 的 text/textZh 与 input.chaosSymbols 同源）。
//
// 简单/普通（正面）：
//   [skull]       -X。X 为当前天数。
//   [cultist]     +1。如果是谈判尝试，你自动成功。
//   [tablet]      -2。如果你的手牌少于 3 张，改为将本标记的修正值视为 0。
//   [elder_thing] -1。如果是谈判尝试，再揭示一个标记。
// 困难/专家（背面）：
//   [skull]       -X。X 为当前天数加 1。
//   [cultist]     -1。如果是谈判尝试，改为将本标记的修正值视为 +1。
//   [tablet]      -4。如果你的手牌少于 2 张，改为将本标记的修正值视为 -2。
//   [elder_thing] -3。如果是谈判尝试，再揭示一个标记。
//
// 引擎契约（treachery-tokens.js#resolveSpecialToken）：`resolveChaosToken` 返回
// `{ delta, drawAnother, onDraw, onFail }`；`onDraw`/`onFail` 的 `{type:'scenarioToken'}` 由
// skill-effects.js#applyTokenFx 回派到 `behavior.applyTokenEffect`。
// 注意「谈判」是检定上下文而不是标记面：困难/专家的 [cultist] 修正随谈判变化，因此在取值时就要
// 知道本次检定是不是谈判（见 isParleyAttempt）。

export const THE_FINAL_EVENING_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前天数。', delta: 0, rider: 'dayNumber' }),
    cultist: Object.freeze({ text: '+1。如果是谈判尝试，你自动成功。', delta: 1, rider: 'parleyAutoSuccess' }),
    tablet: Object.freeze({ text: '-2。如果你的手牌少于 3 张，改为将本标记的修正值视为 0。', delta: -2,
      rider: 'tabletHandThreshold', handThreshold: 3, otherwise: 0 }),
    elderthing: Object.freeze({ text: '-1。如果是谈判尝试，再揭示一个标记。', delta: -1, rider: 'parleyRevealAnother' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前天数。', delta: 0, rider: 'dayNumber' }),
    cultist: Object.freeze({ text: '+1。如果是谈判尝试，你自动成功。', delta: 1, rider: 'parleyAutoSuccess' }),
    tablet: Object.freeze({ text: '-2。如果你的手牌少于 3 张，改为将本标记的修正值视为 0。', delta: -2,
      rider: 'tabletHandThreshold', handThreshold: 3, otherwise: 0 }),
    elderthing: Object.freeze({ text: '-1。如果是谈判尝试，再揭示一个标记。', delta: -1, rider: 'parleyRevealAnother' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前天数加 1。', delta: 0, rider: 'dayNumberPlusOne' }),
    cultist: Object.freeze({ text: '-1。如果是谈判尝试，改为将本标记的修正值视为 +1。', delta: -1,
      rider: 'parleyPositive' }),
    tablet: Object.freeze({ text: '-4。如果你的手牌少于 2 张，改为将本标记的修正值视为 -2。', delta: -4,
      rider: 'tabletHandThreshold', handThreshold: 2, otherwise: -2 }),
    elderthing: Object.freeze({ text: '-3。如果是谈判尝试，再揭示一个标记。', delta: -3, rider: 'parleyRevealAnother' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前天数加 1。', delta: 0, rider: 'dayNumberPlusOne' }),
    cultist: Object.freeze({ text: '-1。如果是谈判尝试，改为将本标记的修正值视为 +1。', delta: -1,
      rider: 'parleyPositive' }),
    tablet: Object.freeze({ text: '-4。如果你的手牌少于 2 张，改为将本标记的修正值视为 -2。', delta: -4,
      rider: 'tabletHandThreshold', handThreshold: 2, otherwise: -2 }),
    elderthing: Object.freeze({ text: '-3。如果是谈判尝试，再揭示一个标记。', delta: -3, rider: 'parleyRevealAnother' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
const DAY_PERIODS = Object.freeze(['day', 'night'])

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const difficultySide = state => (isHardSide(state) ? 'hard' : 'easy')

/** 当前天数：优先读引擎日期原语（scenarioFlags.mechanics.scenarioDate / hemlockDate 记录），回退场景声明。 */
export function dayNumber(state) {
  const date = state?.scenarioFlags?.mechanics?.scenarioDate
  if (date && Number.isSafeInteger(Number(date.day))) return Number(date.day)
  const record = state?.scenario?.mechanics?.calendar?.record
  const raw = record ? state?.campaign?.records?.[record] : null
  const parsed = typeof raw === 'string' ? Number(raw.split(':')[0]) : NaN
  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed
  return Number(state?.scenario?.day) || 3
}

/** 当前时段（day/night）：同上，读引擎日期原语。 */
export function periodOfDay(state) {
  const date = state?.scenarioFlags?.mechanics?.scenarioDate
  if (date && DAY_PERIODS.includes(String(date.period))) return String(date.period)
  const record = state?.scenario?.mechanics?.calendar?.record
  const raw = record ? state?.campaign?.records?.[record] : null
  const period = typeof raw === 'string' ? raw.split(':')[1] : null
  if (DAY_PERIODS.includes(period)) return period
  return String(state?.scenario?.time || 'night')
}

/** 本次检定是不是谈判尝试：显式上下文 > 检定帧的 testTarget.actionKind > 当前行动种类。 */
export function isParleyAttempt(state, context = {}) {
  if (typeof context.parley === 'boolean') return context.parley
  if (typeof context.test?.actionKind === 'string') return context.test.actionKind === 'parley'
  if (typeof context.actionKind === 'string') return context.actionKind === 'parley'
  const frame = state?.skillTest
  if (frame?.testTarget?.actionKind) return frame.testTarget.actionKind === 'parley'
  if (typeof frame?.actionKind === 'string') return frame.actionKind === 'parley'
  if (typeof state?.currentActionKind === 'string') return state.currentActionKind === 'parley'
  return false
}

const handSizeOf = inv => (Array.isArray(inv?.hand) ? inv.hand.length : 0)

/** 单个 symbol 的取值与追加效果（纯函数；behavior.resolveChaosToken 直接转出）。 */
export function theFinalEveningChaosToken(state, inv, token, context = {}) {
  const hard = isHardSide(state)
  const day = dayNumber(state)
  const parley = isParleyAttempt(state, context)
  switch (token) {
    case 'skull':
      return { delta: -(hard ? day + 1 : day), drawAnother: false, onDraw: [], onFail: [] }
    case 'cultist':
      // 简单/普通恒 +1；困难/专家平时 -1、谈判时改为 +1（印刷「treat this token's modifier as a +1」）。
      if (!hard) {
        return { delta: 1, drawAnother: false,
          onDraw: parley ? [{ type: 'scenarioToken', token: 'cultist', mode: 'parley' }] : [], onFail: [] }
      }
      return { delta: parley ? 1 : -1, drawAnother: false, onDraw: [], onFail: [] }
    case 'tablet': {
      const threshold = hard ? 2 : 3
      const otherwise = hard ? -2 : 0
      const delta = handSizeOf(inv) < threshold ? otherwise : (hard ? -4 : -2)
      return { delta, drawAnother: false, onDraw: [], onFail: [] }
    }
    case 'elderthing':
      return { delta: hard ? -3 : -1, drawAnother: parley, onDraw: [], onFail: [] }
    default:
      return null
  }
}

/** 兼容展示/旧测试读点：只返回签名修正值。 */
export function theFinalEveningChaosTokenValue(state, tokenFace, inv = null, context = {}) {
  return theFinalEveningChaosToken(state, inv, tokenFace, context)?.delta ?? null
}

/** 当前难度下的符号表（含 delta/rider），供指南面板与测试读取。 */
export const tokenMeaningsFor = state => (isHardSide(state)
  ? THE_FINAL_EVENING_TOKEN_MEANINGS.hard
  : THE_FINAL_EVENING_TOKEN_MEANINGS.standard)

export { THE_FINAL_EVENING_TOKEN_MEANINGS as TOKEN_MEANINGS }
