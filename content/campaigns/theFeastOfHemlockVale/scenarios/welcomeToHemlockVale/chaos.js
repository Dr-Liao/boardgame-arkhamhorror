// 欢迎来到铁杉谷（welcomeToHemlockVale · 提示卡 10704「山谷 / The Vale」）· 混乱标记与日/时段读数。
//
// 参考：
//   · Scenario/Scenarios/TheFeastOfHemlockVale/PreludeWelcomeToHemlockVale.hs#HasChaosTokenValue
//     → Campaigns/TheFeastOfHemlockVale/TokenHelpers.hs#hemlockPreludeChaosTokenValue /
//       #hemlockPreludeResolveChaosToken；
//   · 印刷提示卡 10704 正/背面（cards-data 的 text/backText 与指南 tokens 段一致）：
//       简单/普通：[skull] -X（X = 当前天数）；[cultist] +1（谈判尝试则自动成功）；
//                 [tablet] -2（手牌少于 3 张时改为 0）；[elder_thing] -1（谈判尝试则再揭示一个标记）。
//       困难/专家：[skull] -X（X = 当前天数 +1）；[cultist] -1（谈判尝试改为 +1）；
//                 [tablet] -4（手牌少于 2 张时改为 -2）；[elder_thing] -3（谈判尝试则再揭示一个标记）。
//   其余标记沿用战役混乱袋基础值（shared.js#CHAOS_BAGS，没有祝福/诅咒）；本文件只声明本章覆盖项。
//
// 读点：
//   · 数值/追加揭示 → behavior.resolveChaosToken（引擎 treachery-tokens.js#resolveSpecialToken 优先读行为）；
//     契约是 `{ delta, drawAnother, onDraw, onFail }`；`drawAnother` 由引擎揭示循环直接消费，
//     `onDraw` 的 `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx 回派到
//     behavior.applyTokenEffect；谈判的「自动成功」没有返回值字段，走 onDraw 落地（见 behavior 注释）。
//   · tokenMeanings（definition.scenario）→ AI 概率预估（combat-odds.js）与卡面展示。
//   · 日期读数（dayOf / isNight / dateOf）→ 供 [skull] 的「当前天数」与 (Day)/(Night) 子句共用；
//     权威状态仍是引擎原语 scenario-calendar.js（mechanicState.scenarioDate + campaign.records.hemlockDate），
//     本文件只读，不写。
//
// 说明：本文件是纯数据/纯读函数，不 import 引擎，也不 import 本目录的 definition/behavior
// （definition 反向 import 本文件的 tokenMeanings，避免循环）。

// 战役层（records.js）与引擎日历原语共用的记录键（definition.mechanics.calendar.record）。
export const CALENDAR_RECORD = 'hemlockDate'
export const MAX_DAY = 3
// 本序曲固定第 1 日白天（Setup「Put the Day One Time Marker card into play」）。
export const PRELUDE_DATE = Object.freeze({ day: 1, period: 'day' })

export const WELCOME_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is the current day number.',
      textZh: '-X。X为当前天数。',
      delta: null, dynamic: 'day', rider: null,
    }),
    cultist: Object.freeze({
      text: '+1. If this is a parley attempt, you automatically succeed.',
      textZh: '+1。如果是谈判尝试，你自动成功。',
      delta: 1, rider: 'cultistParleyAutoSuccess',
    }),
    tablet: Object.freeze({
      text: "-2. If you have fewer than 3 cards in hand, treat this token's modifier as 0 instead.",
      textZh: '-2。如果你的手牌少于3张，改为将本标记的修正值视为0。',
      delta: -2, rider: 'tabletFewerThanThreeCards',
    }),
    elderthing: Object.freeze({
      text: '-1. If this is a parley attempt, reveal another token.',
      textZh: '-1。如果是谈判尝试，再揭示一个标记。',
      delta: -1, rider: 'elderThingParleyRevealAnother',
    }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is the current day number.',
      textZh: '-X。X为当前天数。',
      delta: null, dynamic: 'day', rider: null,
    }),
    cultist: Object.freeze({
      text: '+1. If this is a parley attempt, you automatically succeed.',
      textZh: '+1。如果是谈判尝试，你自动成功。',
      delta: 1, rider: 'cultistParleyAutoSuccess',
    }),
    tablet: Object.freeze({
      text: "-2. If you have fewer than 3 cards in hand, treat this token's modifier as 0 instead.",
      textZh: '-2。如果你的手牌少于3张，改为将本标记的修正值视为0。',
      delta: -2, rider: 'tabletFewerThanThreeCards',
    }),
    elderthing: Object.freeze({
      text: '-1. If this is a parley attempt, reveal another token.',
      textZh: '-1。如果是谈判尝试，再揭示一个标记。',
      delta: -1, rider: 'elderThingParleyRevealAnother',
    }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is 1 more than the current day number.',
      textZh: '-X。X为当前天数加1。',
      delta: null, dynamic: 'dayPlusOne', rider: null,
    }),
    cultist: Object.freeze({
      text: "-1. If this is a parley attempt, treat this token's modifier as a +1, instead.",
      textZh: '-1。如果是谈判尝试，改为将本标记的修正值视为+1。',
      delta: -1, rider: 'cultistParleyPlusOne',
    }),
    tablet: Object.freeze({
      text: "-4. If you have fewer than 2 cards in hand, treat this token's modifier as -2 instead.",
      textZh: '-4。如果你的手牌少于2张，改为将本标记的修正值视为-2。',
      delta: -4, rider: 'tabletFewerThanTwoCards',
    }),
    elderthing: Object.freeze({
      text: '-3. If this is a parley attempt, reveal another token.',
      textZh: '-3。如果是谈判尝试，再揭示一个标记。',
      delta: -3, rider: 'elderThingParleyRevealAnother',
    }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({
      text: '-X. X is 1 more than the current day number.',
      textZh: '-X。X为当前天数加1。',
      delta: null, dynamic: 'dayPlusOne', rider: null,
    }),
    cultist: Object.freeze({
      text: "-1. If this is a parley attempt, treat this token's modifier as a +1, instead.",
      textZh: '-1。如果是谈判尝试，改为将本标记的修正值视为+1。',
      delta: -1, rider: 'cultistParleyPlusOne',
    }),
    tablet: Object.freeze({
      text: "-4. If you have fewer than 2 cards in hand, treat this token's modifier as -2 instead.",
      textZh: '-4。如果你的手牌少于2张，改为将本标记的修正值视为-2。',
      delta: -4, rider: 'tabletFewerThanTwoCards',
    }),
    elderthing: Object.freeze({
      text: '-3. If this is a parley attempt, reveal another token.',
      textZh: '-3。如果是谈判尝试，再揭示一个标记。',
      delta: -3, rider: 'elderThingParleyRevealAnother',
    }),
  }),
})

// 印刷提示卡 10704 的两面（正面 = 简单/普通，背面 = 困难/专家），与 chaosSymbols 输入一致。
export const TOKEN_FACES = Object.freeze({ front: 'easyStandard', back: 'hardExpert' })

// ---------------------------------------------------------------------------
// 日 / 时段（纯读）
// ---------------------------------------------------------------------------

/** 从任意形状（1 / '1' / 'Day1' / {day}）里取 1–3 的天数；取不到返回 null。 */
export function dayNumberOf(value) {
  const raw = value != null && typeof value === 'object' ? (value.day ?? value.value) : value
  if (raw == null || raw === '') return null
  const match = /([123])/.exec(String(raw))
  return match ? Number(match[1]) : null
}

const isNightWord = value => value != null && /night/i.test(String(value))

/** 引擎日历原语写下的 { day, period }（mechanicState.scenarioDate）。 */
export function dateFromCalendar(state) {
  const date = state?.scenarioFlags?.mechanics?.scenarioDate
  if (!date || dayNumberOf(date.day) == null) return null
  return { day: dayNumberOf(date.day), period: date.period === 'night' ? 'night' : 'day' }
}

/** campaign.records.hemlockDate = `day:period`（scenario-calendar.js#setScenarioDate 的写入形状）。 */
export function dateFromRecord(state) {
  const raw = state?.campaign?.records?.[CALENDAR_RECORD]
  if (typeof raw !== 'string') return null
  const [day, period] = raw.split(':')
  const n = dayNumberOf(day)
  if (n == null || !['day', 'night'].includes(period)) return null
  return { day: n, period }
}

/**
 * 当前日期（day 1–3 与 day/night）。顺序：引擎日历 → 战役记录 hemlockDate →
 * 章节 flags → campaign.records.day/time → 本序曲默认（第 1 日白天）。
 */
export function dateOf(state) {
  const fromCalendar = dateFromCalendar(state)
  if (fromCalendar) return fromCalendar
  const fromRecord = dateFromRecord(state)
  if (fromRecord) return fromRecord
  const flags = state?.scenarioFlags || {}
  const flagDay = dayNumberOf(flags.welcomeToHemlockValeDay)
  if (flagDay != null) return { day: flagDay, period: flags.welcomeToHemlockValeNight === true ? 'night' : 'day' }
  const records = state?.campaign?.records || {}
  const day = dayNumberOf(records.day) ?? dayNumberOf(records.currentDay)
  if (day != null) {
    return { day, period: isNightWord(records.time) || isNightWord(records.dayTime) ? 'night' : 'day' }
  }
  return { ...PRELUDE_DATE }
}

/** 当前天数（[skull] 的 X 与「花费/弃牌 X = 当前天数」共用）。 */
export const dayOf = state => dateOf(state).day

/** 是否夜晚（本序曲固定白天；保留读点给共享卡的 (Night) 子句）。 */
export const isNight = state => dateOf(state).period === 'night'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state =>
  Number(state?.numInvestigators) || (state?.investigators || []).length || 1

/**
 * 当前是否正在作谈判（parley）尝试。读点（与其它 FHV 序曲同口径，依次尝试）：
 *   · 显式 context（applyTokenEffect 的 `effect.test.actionKind` / 调用方参数）；
 *   · 技能检定帧 `skillTest.actionKind`（tests.js#performTest 写入）与 `skillTest.testTarget.actionKind`
 *     （调查/攻击/躲避之外的实体目标）；
 *   · `state.currentActionKind`（dispatch.js#setCurrentActionKind 在行动派发期间写入）。
 */
export function isParleyTest(state, context = null) {
  const test = context?.test || state?.skillTest || null
  const candidates = [
    test?.actionKind,
    test?.testTarget?.actionKind,
    context?.actionKind,
    state?.currentActionKind,
  ]
  return candidates.some(value => String(value || '').toLowerCase() === 'parley')
}

// ---------------------------------------------------------------------------
// 标记取值
// ---------------------------------------------------------------------------

/** [skull]：简单/普通 -day；困难/专家 -(day+1)。 */
export function skullValue(state, { day = dayOf(state), hard = isHardSide(state) } = {}) {
  return hard ? day + 1 : day
}

/** [tablet]：简单/普通 手牌 <3 → 0，否则 -2；困难/专家 手牌 <2 → -2，否则 -4。 */
export function tabletValue(state, inv, { hard = isHardSide(state) } = {}) {
  const hand = (inv?.hand || []).length
  if (hard) return hand < 2 ? -2 : -4
  return hand < 3 ? 0 : -2
}

/**
 * 逐标记取值（纯读）。返回引擎 `resolveChaosToken` 契约的
 * `{ delta, drawAnother, onDraw, onFail }`，另带 `dynamic/rider/parley` 供测试与展示读。
 * 未登记的标记返回 null（交回引擎默认表）。
 *
 * 追加揭示：`[elder_thing]` 的「谈判尝试则再揭示一个标记」由 `drawAnother: true` 交给引擎的
 * 揭示循环（treachery-tokens.js → tests.js `if (res.drawAnother) continue`），不在行为里重复抽取。
 * 自动成功：`[cultist]` 简单/普通的「谈判尝试则自动成功」没有契约字段，改由 `onDraw` 的
 * `{ type:'scenarioToken', token:'cultist', mode:'parleyAutoSuccess' }` 落地（behavior.applyTokenEffect）。
 */
export function welcomeChaosToken(state, inv, token, options = {}) {
  const hard = options.hard ?? isHardSide(state)
  const parley = options.parley ?? isParleyTest(state)
  const day = options.day ?? dayOf(state)
  const face = String(token || '').toLowerCase()
  if (face === 'skull') {
    return { delta: -skullValue(state, { day, hard }), drawAnother: false, onDraw: [], onFail: [],
      dynamic: hard ? 'dayPlusOne' : 'day', rider: null, parley }
  }
  if (face === 'cultist') {
    if (hard) {
      return { delta: parley ? 1 : -1, drawAnother: false, onDraw: [], onFail: [],
        dynamic: null, rider: parley ? 'cultistParleyPlusOne' : null, parley }
    }
    return {
      delta: 1, drawAnother: false,
      onDraw: parley ? [{ type: 'scenarioToken', token: 'cultist', mode: 'parleyAutoSuccess' }] : [],
      onFail: [], dynamic: null, rider: parley ? 'cultistParleyAutoSuccess' : null, parley,
    }
  }
  if (face === 'tablet') {
    return { delta: tabletValue(state, inv, { hard }), drawAnother: false, onDraw: [], onFail: [],
      dynamic: null, rider: hard ? 'tabletFewerThanTwoCards' : 'tabletFewerThanThreeCards', parley }
  }
  if (face === 'elderthing' || face === 'elderThing') {
    return {
      delta: hard ? -3 : -1, drawAnother: parley, onDraw: [], onFail: [],
      dynamic: null, rider: parley ? 'elderThingParleyRevealAnother' : null, parley,
    }
  }
  return null
}

/** 兼容读点：返回签名修正值（负数）。 */
export function welcomeChaosTokenValue(state, tokenFace, inv, options) {
  return welcomeChaosToken(state, inv, tokenFace, options)?.delta ?? null
}

export const tokenMeaningsFor = difficulty =>
  WELCOME_TOKEN_MEANINGS[['easy', 'standard', 'hard', 'expert'].includes(difficulty) ? difficulty : 'standard']
