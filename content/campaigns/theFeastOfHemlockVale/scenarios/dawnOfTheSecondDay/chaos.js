// 第二日黎明（dawnOfTheSecondDay · 混乱参考卡 10704「The Vale」）· 四档混乱标记。
//
// 来源：base.json 的 prelude2 / 印刷参考卡 10704 正反面（cards-data 的 text / backText），
// 与参考实现 Campaigns/TheFeastOfHemlockVale/TokenHelpers.hs（hemlockPreludeChaosTokenValue /
// hemlockPreludeResolveChaosToken）逐条对应：
//   简单/普通（正面）
//     [skull]      -X，X = 当前天数；
//     [cultist]    +1；若本次是谈判尝试，自动成功；
//     [tablet]     -2；若手牌少于 3 张，改为 0；
//     [elder_thing]-1；若本次是谈判尝试，再揭示一个标记。
//   困难/专家（背面）
//     [skull]      -X，X = 当前天数 + 1；
//     [cultist]    -1；若本次是谈判尝试，改为 +1；
//     [tablet]     -4；若手牌少于 2 张，改为 -2；
//     [elder_thing]-3；若本次是谈判尝试，再揭示一个标记。
//
// 读点：
//   · 数值 → behavior.resolveChaosToken（treachery-tokens.js#resolveSpecialToken 优先读行为）；
//   · 谈判自动成功 → behavior.resolveChaosToken 返回 onDraw: [{ type: 'scenarioToken',
//     autoSuccess: true }]，behavior.applyTokenEffect 调 api.setTestAutoSuccess()；
//   · tokenMeanings（definition.scenario）→ AI 概率预估与卡面展示。
//
// 天数读点：preScenarioSetup 把日历推进到第 2 日白天（hemlockDate = '2:day'），
// 同时写 records.day = 2 供其它章节/战役层读取；这里只读、不改。

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
const ELDER_THING_ALIASES = Object.freeze(['elderthing', 'elderThing', 'elder_thing'])

export const DAWN_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: '-X. X is the current day number.',
    cultist: '+1. If this is a parley attempt, you automatically succeed.',
    tablet: '-2. If you have fewer than 3 cards in hand, treat this token\'s modifier as 0 instead.',
    elderThing: '-1. If this is a parley attempt, reveal another token.',
  }),
  standard: Object.freeze({
    skull: '-X. X is the current day number.',
    cultist: '+1. If this is a parley attempt, you automatically succeed.',
    tablet: '-2. If you have fewer than 3 cards in hand, treat this token\'s modifier as 0 instead.',
    elderThing: '-1. If this is a parley attempt, reveal another token.',
  }),
  hard: Object.freeze({
    skull: '-X. X is 1 more than the current day number.',
    cultist: '-1. If this is a parley attempt, treat this token\'s modifier as a +1, instead.',
    tablet: '-4. If you have fewer than 2 cards in hand, treat this token\'s modifier as -2 instead.',
    elderThing: '-3. If this is a parley attempt, reveal another token.',
  }),
  expert: Object.freeze({
    skull: '-X. X is 1 more than the current day number.',
    cultist: '-1. If this is a parley attempt, treat this token\'s modifier as a +1, instead.',
    tablet: '-4. If you have fewer than 2 cards in hand, treat this token\'s modifier as -2 instead.',
    elderThing: '-3. If this is a parley attempt, reveal another token.',
  }),
})

// 印刷参考卡 10704 的两面：正面 = Easy/Standard，背面 = Hard/Expert。
export const TOKEN_FACES = Object.freeze({ front: 'easyStandard', back: 'hardExpert' })

export function isHardSide(state) {
  return ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
}

/** 从战役记录/日历读当前天数；序曲固定是第 2 日，但保留通用读点给测试与 AI。 */
export function dayNumberOf(value) {
  const raw = value != null && typeof value === 'object' ? (value.day ?? value.value) : value
  if (raw == null || raw === '') return null
  const match = /([123])/.exec(String(raw))
  return match ? Number(match[1]) : null
}

export function dayOf(state) {
  const records = state?.campaign?.records || {}
  const date = state?.scenarioFlags?.mechanics?.scenarioDate
  return dayNumberOf(state?.scenarioFlags?.dawnSecondDay)
    ?? (date ? dayNumberOf(date.day) : null)
    ?? dayNumberOf(records.day)
    ?? dayNumberOf(records.currentDay)
    ?? dayNumberOf(records.hemlockDate)
    ?? 2
}

/** 序曲固定在第 2 日：当前天数（供 skull/闪避等读取）。 */
export function currentDay(state) {
  return dayOf(state)
}

/** [skull] 的修正值：简单/普通 -天数；困难/专家 -(天数 + 1)。 */
export function skullValue(state) {
  const day = currentDay(state)
  return isHardSide(state) ? -(day + 1) : -day
}

/** [tablet] 的修正值：按难度与手牌数取印刷的「少于 N 张改为 M」。 */
export function tabletValue(state, handSize = 0) {
  const count = Number(handSize) || 0
  if (isHardSide(state)) return count < 2 ? -2 : -4
  return count < 3 ? 0 : -2
}

/**
 * 单个符号的结算结果（纯函数；behavior.resolveChaosToken 直接返回它）：
 *   return { delta, drawAnother, onDraw: [{ type:'scenarioToken', token, autoSuccess }], onFail: [] }
 * `parley` 由 behavior 判定（skillTest.actionKind === 'parley' 或测试上下文标记）。
 */
export function dawnChaosTokenOutcome(state, inv, token, { parley = false, handSize = null } = {}) {
  const face = String(token || '').toLowerCase()
  const cardsInHand = handSize == null ? (Array.isArray(inv?.hand) ? inv.hand.length : 0) : Number(handSize) || 0
  if (face === 'skull') {
    return { delta: skullValue(state), drawAnother: false, onDraw: [], onFail: [] }
  }
  if (face === 'cultist') {
    if (!isHardSide(state)) {
      // 简单/普通：+1；谈判尝试则自动成功（Haskell：SkillTestAutomaticallySucceeds）。
      return { delta: 1, drawAnother: false, onDraw: parley
        ? [{ type: 'scenarioToken', token: 'cultist', autoSuccess: true }]
        : [], onFail: [] }
    }
    // 困难/专家：-1；谈判尝试改为 +1。
    return { delta: parley ? 1 : -1, drawAnother: false, onDraw: [], onFail: [] }
  }
  if (face === 'tablet') {
    return { delta: tabletValue(state, cardsInHand), drawAnother: false, onDraw: [], onFail: [] }
  }
  if (ELDER_THING_ALIASES.includes(face)) {
    // -1（简单/普通）或 -3（困难/专家）；谈判尝试再揭示一个标记。
    return { delta: isHardSide(state) ? -3 : -1, drawAnother: parley, onDraw: [], onFail: [] }
  }
  return null
}

/** 是否谈判尝试：引擎 skillTest.actionKind === 'parley'（卡条目 countsAs 写入），或调用方显式标记。 */
export function isParleyAttempt(state, api = {}) {
  if (api.parley === true) return true
  const test = state?.skillTest || api?.skillTest || null
  if (test && (test.actionKind === 'parley' || test.source?.actionKind === 'parley')) return true
  return false
}

export const dawnChaosToken = (state, inv, token, options = {}) => dawnChaosTokenOutcome(state, inv, token, options)
export const dawnChaosTokenValue = (state, inv, token, options = {}) => dawnChaosTokenOutcome(state, inv, token, options)?.delta ?? 0
