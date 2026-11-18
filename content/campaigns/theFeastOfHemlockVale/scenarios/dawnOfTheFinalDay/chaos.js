// 最终日黎明（dawnOfTheFinalDay · 序曲 3 · 提示卡 10704「山谷 The Vale」）· 混乱标记与疲劳降级。
//
// 事实源：
//   · Scenario/Scenarios/TheFeastOfHemlockVale/PreludeDawnOfTheFinalDay.hs#HasChaosTokenValue →
//     hemlockPreludeChaosTokenValue；
//   · Campaigns/TheFeastOfHemlockVale/TokenHelpers.hs#hemlockPreludeChaosTokenValue /
//     #hemlockPreludeResolveChaosToken（cultist 谈判自动成功、elderThing 谈判再揭示一枚）；
//   · Campaigns/TheFeastOfHemlockVale/Helpers.hs#lowerChaosTokenValue / #replaceFatigueChaosTokens
//     （序曲开场 Intro 3 的「漫长一夜的疲劳」：替换 2 枚非符号标记为低 1 点的标记）；
//   · frontend/src/locales/en/theFeastOfHemlockVale/base.json#tokens（提示卡 10704 正/背面印刷文本）。
//
// 四档：简单/普通 = 提示卡正面，困难/专家 = 提示卡背面。
//   [skull]       简单/普通 -X（X = 当前天数）；困难/专家 -X（X = 当前天数 + 1）。
//   [cultist]     简单/普通 +1，谈判检定自动成功；困难/专家 -1，谈判时改为 +1。
//   [tablet]      简单/普通 -2，手牌少于 3 张时改为 0；困难/专家 -4，手牌少于 2 张时改为 -2。
//   [elder_thing] 简单/普通 -1；困难/专家 -3；谈判时都再揭示一枚标记。
//
// 本章是序曲，天数固定为第 3 日；`dayNumber` 仍按 campaign.records / 机制日期 / 默认 3 依次读取，
// 便于单测与战役层复用同一读点。

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 卡面/输入里 elder_thing 的多种写法统一成引擎 token 键。 */
export function normalizeTokenFace(face) {
  const raw = String(face ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  if (raw === 'elder_thing' || raw === 'elderthing') return 'elderthing'
  return raw
}

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const isEasyStandard = state => !isHardSide(state)

/** 当前天数：scenarioFlags → 机制日期(scenarioDate) → campaign.records.day / hemlockDate → 3。 */
export function dayNumber(state) {
  const flags = state?.scenarioFlags || {}
  const fromFlags = Number(flags.dawnOfTheFinalDayDay ?? flags.hemlockDay)
  if (Number.isSafeInteger(fromFlags) && fromFlags > 0) return fromFlags
  const date = state?.scenarioFlags?.mechanics?.scenarioDate
  if (Number.isSafeInteger(Number(date?.day)) && Number(date.day) > 0) return Number(date.day)
  const records = state?.campaign?.records || {}
  const direct = Number(records.day ?? records.currentDay)
  if (Number.isSafeInteger(direct) && direct > 0) return direct
  const raw = records.hemlockDate
  if (typeof raw === 'string' && /^\d+:(?:day|night)$/.test(raw)) return Number(raw.split(':')[0])
  return 3
}

/** [skull] 的 X：简单/普通 = 当前天数；困难/专家 = 当前天数 + 1。 */
export const skullValue = state => (isHardSide(state) ? dayNumber(state) + 1 : dayNumber(state))

/** [cultist] 修正：简单/普通恒 +1；困难/专家在谈判时改为 +1（否则 -1）。 */
export function cultistValue(state, { parley = false } = {}) {
  if (!isHardSide(state)) return 1
  return parley ? 1 : -1
}

/** [tablet] 修正：简单/普通手牌 < 3 → 0；困难/专家手牌 < 2 → -2。 */
export function tabletValue(state, { handSize = 0 } = {}) {
  const cards = Number.isSafeInteger(Number(handSize)) ? Number(handSize) : 0
  if (isHardSide(state)) return cards < 2 ? -2 : -4
  return cards < 3 ? 0 : -2
}

/** [elder_thing] 修正：简单/普通 -1；困难/专家 -3。 */
export const elderThingValue = state => (isHardSide(state) ? -3 : -1)

/** 印刷文本（提示卡 10704 正面/背面；与 input.chaosSymbols 逐字一致）。 */
const EASY_TEXT = Object.freeze({
  skull: '-X. X is the current day number.',
  cultist: '+1. If this is a parley attempt, you automatically succeed.',
  tablet: "-2. If you have fewer than 3 cards in hand, treat this token's modifier as 0 instead.",
  elderThing: '-1. If this is a parley attempt, reveal another token.',
})
const EASY_TEXT_ZH = Object.freeze({
  skull: '-X。X 为当前天数。',
  cultist: '+1。如果本次是谈判尝试，你自动成功。',
  tablet: '-2。如果你手牌少于 3 张，改为将本标记的修正值视为 0。',
  elderThing: '-1。如果本次是谈判尝试，再揭示一枚标记。',
})
const HARD_TEXT = Object.freeze({
  skull: '-X. X is 1 more than the current day number.',
  cultist: "-1. If this is a parley attempt, treat this token's modifier as a +1, instead.",
  tablet: "-4. If you have fewer than 2 cards in hand, treat this token's modifier as -2 instead.",
  elderThing: '-3. If this is a parley attempt, reveal another token.',
})
const HARD_TEXT_ZH = Object.freeze({
  skull: '-X。X 为当前天数 + 1。',
  cultist: '-1。如果本次是谈判尝试，改为将本标记的修正值视为 +1。',
  tablet: '-4。如果你手牌少于 2 张，改为将本标记的修正值视为 -2。',
  elderThing: '-3。如果本次是谈判尝试，再揭示一枚标记。',
})

export const PRELUDE_TOKEN_TEXT = Object.freeze({
  easyStandard: EASY_TEXT,
  standard: EASY_TEXT,
  easy: EASY_TEXT,
  hardExpert: HARD_TEXT,
  hard: HARD_TEXT,
  expert: HARD_TEXT,
  easyStandardZh: EASY_TEXT_ZH,
  hardExpertZh: HARD_TEXT_ZH,
})

/** `scenario.tokenMeanings` 形状（引擎/展示读点）。 */
export const PRELUDE_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: EASY_TEXT.skull, delta: 0, formula: 'day' }),
    cultist: Object.freeze({ text: EASY_TEXT.cultist, delta: 1, parleyAutoSucceed: true }),
    tablet: Object.freeze({ text: EASY_TEXT.tablet, delta: -2, handThreshold: 3 }),
    elderthing: Object.freeze({ text: EASY_TEXT.elderThing, delta: -1, parleyRevealAnother: true }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: EASY_TEXT.skull, delta: 0, formula: 'day' }),
    cultist: Object.freeze({ text: EASY_TEXT.cultist, delta: 1, parleyAutoSucceed: true }),
    tablet: Object.freeze({ text: EASY_TEXT.tablet, delta: -2, handThreshold: 3 }),
    elderthing: Object.freeze({ text: EASY_TEXT.elderThing, delta: -1, parleyRevealAnother: true }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: HARD_TEXT.skull, delta: 0, formula: 'dayPlusOne' }),
    cultist: Object.freeze({ text: HARD_TEXT.cultist, delta: -1, parleyDelta: 1 }),
    tablet: Object.freeze({ text: HARD_TEXT.tablet, delta: -4, handThreshold: 2, handLowDelta: -2 }),
    elderthing: Object.freeze({ text: HARD_TEXT.elderThing, delta: -3, parleyRevealAnother: true }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: HARD_TEXT.skull, delta: 0, formula: 'dayPlusOne' }),
    cultist: Object.freeze({ text: HARD_TEXT.cultist, delta: -1, parleyDelta: 1 }),
    tablet: Object.freeze({ text: HARD_TEXT.tablet, delta: -4, handThreshold: 2, handLowDelta: -2 }),
    elderthing: Object.freeze({ text: HARD_TEXT.elderThing, delta: -3, parleyRevealAnother: true }),
  }),
})

/**
 * 逐标记取值（引擎 `behavior.resolveChaosToken` 的原料）。
 * 返回 `{ token, delta, parley, autoSucceed, revealAnother, text }`：
 *   · autoSucceed：简单/普通[cultist] + 谈判 → 本次检定自动成功（TokenHelpers.hs#hemlockPreludeResolveChaosToken）；
 *   · revealAnother：谈判时再揭示一枚标记（elderThing 两档都如此）。
 */
export function preludeChaosToken(state, tokenFace, options = {}) {
  const token = normalizeTokenFace(tokenFace)
  const parley = options.parley === true
  const handSize = options.handSize ?? 0
  const text = isHardSide(state) ? HARD_TEXT : EASY_TEXT
  switch (token) {
    case 'skull':
      return { token, delta: -skullValue(state), parley, autoSucceed: false, revealAnother: false, text: text.skull }
    case 'cultist':
      return { token, delta: cultistValue(state, { parley }), parley,
        autoSucceed: parley && !isHardSide(state), revealAnother: false, text: text.cultist }
    case 'tablet':
      return { token, delta: tabletValue(state, { handSize }), parley, autoSucceed: false,
        revealAnother: false, text: text.tablet }
    case 'elderthing':
      return { token, delta: elderThingValue(state), parley, autoSucceed: false, revealAnother: parley,
        text: text.elderThing }
    default:
      return null
  }
}

/** 兼容展示/旧测试读点：只返回数值修正。 */
export function preludeChaosTokenValue(state, tokenFace, options = {}) {
  return preludeChaosToken(state, tokenFace, options)?.delta ?? null
}

// ---------------------------------------------------------------------------
// 疲劳：Intro 3「漫长一夜的疲劳」的标记降级
// ---------------------------------------------------------------------------
// 参考 Helpers.hs#lowerChaosTokenValue：+1→0、0→-1、-1→-2 … -7→-8；
// 符号标记与已经是 -8 的标记没有「低 1 点」的标记（Nothing → 重抽另一枚）。
export const FATIGUE_REPLACEMENT_COUNT = 2
export const LOWER_CHAOS_TOKEN = Object.freeze({
  '+1': '0', '0': '-1', '-1': '-2', '-2': '-3', '-3': '-4', '-4': '-5', '-5': '-6', '-6': '-7', '-7': '-8',
})

export const isNumericChaosToken = face => /^[+-]?\d+$/.test(String(face ?? ''))

/** 低 1 点的标记；符号/最低值返回 null。 */
export function lowerChaosToken(face) {
  const key = String(face ?? '')
  return Object.hasOwn(LOWER_CHAOS_TOKEN, key) ? LOWER_CHAOS_TOKEN[key] : null
}

/** 可降级的标记下标：非符号且还能再降 1 点（疲劳只替换这类标记）。 */
export function lowerableTokenIndexes(bag) {
  return (bag || []).flatMap((face, index) => (isNumericChaosToken(face) && lowerChaosToken(face) ? [index] : []))
}

/**
 * 疲劳替换计划（纯函数，测试与无 api 调用共用）：
 * 从混乱袋里随机抽取 `count` 枚可降级标记，返回 `[{ index, from, to }]`。
 * `random()` 返回 [0,1)；不传时按袋顺序取前 count 枚（确定性兜底）。
 */
export function fatigueReplacementPlan(bag, { count = FATIGUE_REPLACEMENT_COUNT, random = null } = {}) {
  const tokens = [...(bag || [])]
  const pool = lowerableTokenIndexes(tokens)
  const replaced = []
  for (let step = 0; step < count && pool.length; step += 1) {
    const roll = typeof random === 'function' ? Number(random()) : 0
    const position = Math.floor((Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0) * pool.length)
    const [index] = pool.splice(position, 1)
    const from = tokens[index]
    replaced.push({ index, from, to: lowerChaosToken(from) })
  }
  return replaced
}
