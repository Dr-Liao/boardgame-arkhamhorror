// 沉睡者墓穴（sepulchreOfTheSleeper · 11673）· 混乱标记 + 扰动（Disturbance）。
//
// 参考：Scenario/Scenarios/TheDrownedCity/SepulchreOfTheSleeper.hs#HasChaosTokenValue +
//       Scenarios/TheDrownedCity/SepulchreOfTheSleeper/Helpers.hs#getDisturbance +
//       frontend/src/locales/en/theDrownedCity/sepulchreOfTheSleeper.json#tokens。
//
// 四档（提示卡 11673 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       -X，X = 当前扰动（简单/普通最多 6；困难/专家不设上限）。
//   [cultist]     -4 / -6；检定失败时抽遭遇牌库顶牌，若失败 ≥3 点，该牌获得险境与涌动。
//   [tablet]      -4 / -6；失败差值每 1 点，你必须选择受到 1 点恐惧或弃 1 张手牌。
//   [elder_thing] -3 / -4；再揭示一个标记。
export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const DISTURBANCE_KEY = 'disturbance'
export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const DISTURBANCE_CAP_EASY = 6

const flagsFor = state => (state.scenarioFlags ||= {})

/** 当前扰动（剧本辅助卡上的资源数；开局 0）。 */
export function disturbance(state) {
  const value = Number(flagsFor(state)[DISTURBANCE_KEY])
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}
export function setDisturbance(state, value) {
  const next = Math.max(0, Math.trunc(Number(value) || 0))
  flagsFor(state)[DISTURBANCE_KEY] = next
  return next
}
export function increaseDisturbance(state, amount = 1) {
  return setDisturbance(state, disturbance(state) + Math.max(0, Math.trunc(Number(amount) || 0)))
}

/** 「扰动达到 6；若游戏中恰好有 1 或 2 名调查员，改为 8」时立刻推进。 */
export function disturbanceThreshold(state) {
  const count = Number(state?.numInvestigators) || (state?.investigators || []).length || 1
  return count <= 2 ? 8 : 6
}

/** [skull]：X = 扰动（简单/普通最多 6）。 */
export function skullValue(state) {
  const value = disturbance(state)
  return isHardSide(state) ? value : Math.min(DISTURBANCE_CAP_EASY, value)
}

export const CTHULHU_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前扰动（最多 6）。', delta: 0, dynamic: 'disturbance' }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，抽取遭遇牌库顶牌；若失败 3 点或更多，该牌获得险境与涌动。', delta: -4, rider: 'drawEncounterOnFail' }),
    tablet: Object.freeze({ text: '-4。失败差值每 1 点，你必须选择受到 1 点恐惧或弃 1 张手牌。', delta: -4, rider: 'horrorOrDiscardOnFail' }),
    elderthing: Object.freeze({ text: '-3。再揭示一个标记。', delta: -3, rider: 'revealAnother' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前扰动（最多 6）。', delta: 0, dynamic: 'disturbance' }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，抽取遭遇牌库顶牌；若失败 3 点或更多，该牌获得险境与涌动。', delta: -4, rider: 'drawEncounterOnFail' }),
    tablet: Object.freeze({ text: '-4。失败差值每 1 点，你必须选择受到 1 点恐惧或弃 1 张手牌。', delta: -4, rider: 'horrorOrDiscardOnFail' }),
    elderthing: Object.freeze({ text: '-3。再揭示一个标记。', delta: -3, rider: 'revealAnother' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前扰动。', delta: 0, dynamic: 'disturbance' }),
    cultist: Object.freeze({ text: '-6。如果你检定失败，抽取遭遇牌库顶牌；若失败 3 点或更多，该牌获得险境与涌动。', delta: -6, rider: 'drawEncounterOnFail' }),
    tablet: Object.freeze({ text: '-6。失败差值每 1 点，你必须选择受到 1 点恐惧或弃 1 张手牌。', delta: -6, rider: 'horrorOrDiscardOnFail' }),
    elderthing: Object.freeze({ text: '-4。再揭示一个标记。', delta: -4, rider: 'revealAnother' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为当前扰动。', delta: 0, dynamic: 'disturbance' }),
    cultist: Object.freeze({ text: '-6。如果你检定失败，抽取遭遇牌库顶牌；若失败 3 点或更多，该牌获得险境与涌动。', delta: -6, rider: 'drawEncounterOnFail' }),
    tablet: Object.freeze({ text: '-6。失败差值每 1 点，你必须选择受到 1 点恐惧或弃 1 张手牌。', delta: -6, rider: 'horrorOrDiscardOnFail' }),
    elderthing: Object.freeze({ text: '-4。再揭示一个标记。', delta: -4, rider: 'revealAnother' }),
  }),
})

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；未知标记交回默认表。 */
export function sepulchreChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return { delta: hard ? -6 : -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'drawEncounterOnFail' }] }
    case 'tablet':
      return { delta: hard ? -6 : -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'horrorOrDiscardPerFail' }] }
    case 'elderthing':
      return { delta: hard ? -4 : -3, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'revealAnother' }], onFail: [] }
    default:
      return null
  }
}

export function sepulchreChaosTokenValue(state, tokenFace) {
  return sepulchreChaosToken(state, null, tokenFace)?.delta ?? null
}

export function sepulchreTokenText(state, face) {
  return CTHULHU_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}

export const disturbanceSummary = state => ({
  disturbance: disturbance(state),
  threshold: disturbanceThreshold(state),
  skull: skullValue(state),
})
