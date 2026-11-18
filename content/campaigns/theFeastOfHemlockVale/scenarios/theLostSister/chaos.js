// 消失的姐妹（theLostSister · 10569）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLostSister.hs#HasChaosTokenValue +
//       frontend/src/locales/en/theFeastOfHemlockVale/theLostSister.json#tokens。
//   [skull]：-X。简单/普通 X = 已揭示[[洞穴]]地点数的一半（向上取整）；困难/专家 X = 已揭示洞穴数。
//   [cultist]：-1。简单/普通：检定成功后治愈 1 点恐惧；困难/专家：成功且差值 ≥2 时治愈 1 点恐惧。
//   [tablet]：简单/普通 -2（在[[洞穴]]地点改为 -4）；困难/专家 -4（在洞穴地点改为 -6）。
//   [elder_thing]：简单/普通 -2，若你所在地点有[[异形]]敌人则再揭示一个标记；
//                  困难/专家 -3，若你所在地点有[[异形]]敌人则本次检定自动失败。
//   [elder_sign]：本关没有额外的旧印规则（交回引擎默认表）。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, drawAnother, onDraw, onFail }`；
// `onDraw`/`onFail` 的 `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx 回派到
// `behavior.applyTokenEffect`（`effect.test.failedBy` 给出本次检定的失败差值，≤0 表示成功）。
// `scenario.tokenMeanings` 与这里同源，供 AI / 前端展示读取。

const TOKEN_TEXT = Object.freeze({
  skullEasy: '-X. X is half the number of revealed [[Cave]] locations in play (rounded up).',
  skullHard: '-X. X is the number of revealed [[Cave]] locations in play.',
  cultistEasy: '-1. If you succeed, heal 1 horror.',
  cultistHard: '-1. If you succeed by 2 or more, heal 1 horror.',
  tabletEasy: "-2. If you are at a [[Cave]] location, treat this token's modifier as -4 instead.",
  tabletHard: "-4. If you are at a [[Cave]] location, treat this token's modifier as -6 instead.",
  elderThingEasy: '-2. If an [[Abomination]] enemy is at your location, reveal another token.',
  elderThingHard: '-3. If an [[Abomination]] enemy is at your location, this test automatically fails instead.',
})

const TOKEN_TEXT_ZH = Object.freeze({
  skullEasy: '-X。X 为场上已揭示[[洞穴]]地点数量的一半（向上取整）。',
  skullHard: '-X。X 为场上已揭示[[洞穴]]地点的数量。',
  cultistEasy: '-1。如果你检定成功，治愈 1 点恐惧。',
  cultistHard: '-1。如果你以差值 2 或以上成功，治愈 1 点恐惧。',
  tabletEasy: '-2。如果你在[[洞穴]]地点，本标记的修正改为 -4。',
  tabletHard: '-4。如果你在[[洞穴]]地点，本标记的修正改为 -6。',
  elderThingEasy: '-2。如果你所在地点有[[异形]]敌人，再揭示一个标记。',
  elderThingHard: '-3。如果你所在地点有[[异形]]敌人，本次检定自动失败。',
})

export const THE_LOST_SISTER_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: TOKEN_TEXT.skullEasy, textZh: TOKEN_TEXT_ZH.skullEasy, delta: 0, rider: 'revealedCavesHalved' }),
    cultist: Object.freeze({ text: TOKEN_TEXT.cultistEasy, textZh: TOKEN_TEXT_ZH.cultistEasy, delta: -1, rider: 'cultistHealOnSuccess' }),
    tablet: Object.freeze({ text: TOKEN_TEXT.tabletEasy, textZh: TOKEN_TEXT_ZH.tabletEasy, delta: -2, caveDelta: -4, rider: 'tabletCave' }),
    elderthing: Object.freeze({ text: TOKEN_TEXT.elderThingEasy, textZh: TOKEN_TEXT_ZH.elderThingEasy, delta: -2, rider: 'elderthingDrawAnother' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: TOKEN_TEXT.skullEasy, textZh: TOKEN_TEXT_ZH.skullEasy, delta: 0, rider: 'revealedCavesHalved' }),
    cultist: Object.freeze({ text: TOKEN_TEXT.cultistEasy, textZh: TOKEN_TEXT_ZH.cultistEasy, delta: -1, rider: 'cultistHealOnSuccess' }),
    tablet: Object.freeze({ text: TOKEN_TEXT.tabletEasy, textZh: TOKEN_TEXT_ZH.tabletEasy, delta: -2, caveDelta: -4, rider: 'tabletCave' }),
    elderthing: Object.freeze({ text: TOKEN_TEXT.elderThingEasy, textZh: TOKEN_TEXT_ZH.elderThingEasy, delta: -2, rider: 'elderthingDrawAnother' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: TOKEN_TEXT.skullHard, textZh: TOKEN_TEXT_ZH.skullHard, delta: 0, rider: 'revealedCaves' }),
    cultist: Object.freeze({ text: TOKEN_TEXT.cultistHard, textZh: TOKEN_TEXT_ZH.cultistHard, delta: -1, rider: 'cultistHealOnSuccessBy2' }),
    tablet: Object.freeze({ text: TOKEN_TEXT.tabletHard, textZh: TOKEN_TEXT_ZH.tabletHard, delta: -4, caveDelta: -6, rider: 'tabletCave' }),
    elderthing: Object.freeze({ text: TOKEN_TEXT.elderThingHard, textZh: TOKEN_TEXT_ZH.elderThingHard, delta: -3, rider: 'elderthingAutoFail' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: TOKEN_TEXT.skullHard, textZh: TOKEN_TEXT_ZH.skullHard, delta: 0, rider: 'revealedCaves' }),
    cultist: Object.freeze({ text: TOKEN_TEXT.cultistHard, textZh: TOKEN_TEXT_ZH.cultistHard, delta: -1, rider: 'cultistHealOnSuccessBy2' }),
    tablet: Object.freeze({ text: TOKEN_TEXT.tabletHard, textZh: TOKEN_TEXT_ZH.tabletHard, delta: -4, caveDelta: -6, rider: 'tabletCave' }),
    elderthing: Object.freeze({ text: TOKEN_TEXT.elderThingHard, textZh: TOKEN_TEXT_ZH.elderThingHard, delta: -3, rider: 'elderthingAutoFail' }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const numInvestigators = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

/**
 * 一个地点是否为「黑暗地点」（本关核心口径，测试与 behavior 共用同一读点）。
 *   · 未揭示的岩穴面固定为 [[Cave]][[Dark]]；
 *   · 已揭示面取印刷特性中的 Dark；
 *   · 荧光增生（10587）附属期间附着地点失去 Dark；露天洞穴（10581）检定成功后可暂时失去 Dark。
 * 判定需要 `suppressedIds`（behavior 传入的临时失暗地点集合），保证 chaos.js 不复制规则。
 */
export function locationIsDark(location, suppressedIds = null) {
  if (!location) return false
  if (suppressedIds && suppressedIds.has(location.id)) return false
  if (location.revealed !== true) return true
  return hasTrait(location, 'Dark')
}

export function locationIsCave(location) {
  if (!location) return false
  if (location.revealed !== true) return true
  return hasTrait(location, 'Cave')
}

/** 场上已揭示的[[洞穴]]地点（骷髅取值与 AI 展示共用）。 */
export function revealedCaveLocations(state) {
  return (state?.locations || []).filter(location => location.revealed === true && hasTrait(location, 'Cave'))
}

export function revealedCaveCount(state) {
  return revealedCaveLocations(state).length
}

/** 骷髅修正的绝对值：简单/普通 = ceil(洞穴数/2)，困难/专家 = 洞穴数。 */
export function skullValue(state, { hard = isHardSide(state) } = {}) {
  const count = revealedCaveCount(state)
  return hard ? count : Math.ceil(count / 2)
}

const locationOf = (state, inv) => (state?.locations || []).find(location => location.id === inv?.location) || null

/** 调查员是否在[[洞穴]]地点（平板取值）。 */
export function investigatorAtCave(state, inv) {
  return locationIsCave(locationOf(state, inv))
}

/** 调查员所在地点是否有[[异形]]敌人（旧日支配者标记）。 */
export function abominationAtInvestigator(state, inv) {
  return (state?.enemies || []).some(enemy => enemy.location === inv?.location && hasTrait(enemy, 'Abomination'))
}

/**
 * 逐标记取值：返回引擎 `resolveChaosToken` 契约的 `{ delta, drawAnother, onDraw, onFail }`；
 * 未知标记返回 null，交回默认表。
 */
export function theLostSisterChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (token) {
    case 'skull':
      return { delta: -skullValue(state, { hard }), drawAnother: false, onDraw: [], onFail: [] }
    case 'cultist':
      return { delta: -1, drawAnother: false,
        onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: hard ? 'healBy2' : 'healOnSuccess' }], onFail: [] }
    case 'tablet': {
      const atCave = investigatorAtCave(state, inv)
      return { delta: atCave ? (hard ? -6 : -4) : (hard ? -4 : -2), drawAnother: false, onDraw: [], onFail: [] }
    }
    case 'elderthing': {
      const abomination = abominationAtInvestigator(state, inv)
      if (hard) {
        return { delta: -3, drawAnother: false,
          onDraw: abomination ? [{ type: 'scenarioToken', token: 'elderthing', mode: 'autoFail' }] : [], onFail: [] }
      }
      return { delta: -2, drawAnother: abomination,
        onDraw: abomination ? [{ type: 'scenarioToken', token: 'elderthing', mode: 'revealAnother' }] : [], onFail: [] }
    }
    default:
      return null
  }
}

/** 困难/专家：地点有[[异形]]敌人时，[elder_thing] 让检定自动失败。 */
export function chaosTokenAutoFails(state, inv, token) {
  return isHardSide(state) && String(token) === 'elderthing' && abominationAtInvestigator(state, inv)
}

/** 兼容旧测试/展示读点：只返回签名修正值（负数）。 */
export function theLostSisterChaosTokenValue(state, tokenFace, inv = null) {
  return theLostSisterChaosToken(state, inv, tokenFace)?.delta ?? null
}

/** 展示文本：按难度取一组含义（`scenario.tokenMeanings` 同源）。 */
export function tokenMeaningsFor(state) {
  return THE_LOST_SISTER_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard']
}

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export { hasTrait, numInvestigators }
