// 淹没城区（theDrownedQuarter · 11536）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDrownedQuarter.hs#HasChaosTokenValue +
//       ResolveChaosToken / FailedSkillTest 段 + frontend/src/locales/en/theDrownedCity/
//       theDrownedQuarter.json#tokens（提示卡背面印刷文本）。
//
// 四档（提示卡正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 已揭示地点数的一半（向下取整）；
//                 困难/专家：-X，X = 已揭示地点数。
//   [cultist]     简单/普通：-2，若你检定失败且你所在地点完全淹没，受到 1 点伤害；
//                 困难/专家：-3，若你所在地点已淹没（≥部分淹没），受到 1 点伤害。
//   [tablet]      简单/普通：-4，若你检定失败，把你 1 个线索放到你所在地点；
//                 困难/专家：-4，你每失败 1 点，把你 1 个线索放到你所在地点。
//   [elder_thing] 简单/普通：-3；若你所在地点未淹没则改为 -5；
//                 困难/专家：-4；若未淹没则改为 -6。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；
// `onDraw`/`onFail` 的 `{ type: 'scenarioToken', token }` 由 skill-effects.js 回派到
// `behavior.applyTokenEffect`（与《寂静荒野》同一口径）。
import { floodLevel } from '../../../../../src/engine/flood.js'

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
export const FLOOD_LEVELS = Object.freeze({ unflooded: 0, partial: 1, full: 2 })

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

const locationOfInvestigator = (state, inv) => (state?.locations || [])
  .find(location => location.id === inv?.location) || null

/** 地点有效淹没等级（0/1/2）；地点不在场时按 0。 */
export function floodedLevelOf(state, locationId) {
  if (!locationId) return 0
  if (!(state?.locations || []).some(location => location.id === locationId)) return 0
  return floodLevel(state, locationId)
}

/** 调查员所在地点的淹没等级。 */
export function investigatorFloodLevel(state, inv) {
  return floodedLevelOf(state, inv?.location)
}

export const isFullyFlooded = (state, inv) => investigatorFloodLevel(state, inv) >= 2
export const isPartiallyFlooded = (state, inv) => investigatorFloodLevel(state, inv) >= 1

/** 已揭示地点数（[skull] 的 X 原料）。 */
export function revealedLocationCount(state) {
  return (state?.locations || []).filter(location => location.revealed === true).length
}

/** [skull] 的 X：简单/普通折半向下取整；困难/专家取全量。 */
export function skullValue(state) {
  const count = revealedLocationCount(state)
  return isHardSide(state) ? count : Math.floor(count / 2)
}

export const DROWNED_QUARTER_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为已揭示地点数量的一半（向下取整）。', delta: 0, rider: 'revealedLocationsHalf' }),
    cultist: Object.freeze({ text: '-2。如果你检定失败且你所在地点完全淹没，受到 1 点伤害。', delta: -2, rider: 'damageOnFailFullyFlooded' }),
    tablet: Object.freeze({ text: '-4。如果你检定失败，把你 1 个线索放到你所在地点。', delta: -4, rider: 'placeClueOnFail' }),
    elderthing: Object.freeze({ text: '-3（如果你所在地点未淹没，改为 -5）。', delta: -3, rider: 'unfloodedPenalty' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为已揭示地点数量的一半（向下取整）。', delta: 0, rider: 'revealedLocationsHalf' }),
    cultist: Object.freeze({ text: '-2。如果你检定失败且你所在地点完全淹没，受到 1 点伤害。', delta: -2, rider: 'damageOnFailFullyFlooded' }),
    tablet: Object.freeze({ text: '-4。如果你检定失败，把你 1 个线索放到你所在地点。', delta: -4, rider: 'placeClueOnFail' }),
    elderthing: Object.freeze({ text: '-3（如果你所在地点未淹没，改为 -5）。', delta: -3, rider: 'unfloodedPenalty' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为已揭示地点的数量。', delta: 0, rider: 'revealedLocations' }),
    cultist: Object.freeze({ text: '-3。如果你所在地点已淹没，受到 1 点伤害。', delta: -3, rider: 'damageIfFlooded' }),
    tablet: Object.freeze({ text: '-4。你每失败 1 点，把你 1 个线索放到你所在地点。', delta: -4, rider: 'placeCluesPerFailure' }),
    elderthing: Object.freeze({ text: '-4（如果你所在地点未淹没，改为 -6）。', delta: -4, rider: 'unfloodedPenalty' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为已揭示地点的数量。', delta: 0, rider: 'revealedLocations' }),
    cultist: Object.freeze({ text: '-3。如果你所在地点已淹没，受到 1 点伤害。', delta: -3, rider: 'damageIfFlooded' }),
    tablet: Object.freeze({ text: '-4。你每失败 1 点，把你 1 个线索放到你所在地点。', delta: -4, rider: 'placeCluesPerFailure' }),
    elderthing: Object.freeze({ text: '-4（如果你所在地点未淹没，改为 -6）。', delta: -4, rider: 'unfloodedPenalty' }),
  }),
})

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`。 */
export function drownedQuarterChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -3, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'damageIfFlooded' }], onFail: [] }
        : { delta: -2, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'damageOnFailFullyFlooded' }] }
    case 'tablet':
      return hard
        ? { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'placeCluesPerFailure' }] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'placeClueOnFail' }] }
    case 'elderthing': {
      const flooded = Boolean(inv?.location) && investigatorFloodLevel(state, inv) >= 1
      if (hard) return { delta: flooded ? -4 : -6, onDraw: [], onFail: [] }
      return { delta: flooded ? -3 : -5, onDraw: [], onFail: [] }
    }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function drownedQuarterChaosTokenValue(state, tokenFace) {
  return drownedQuarterChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（AI / 指南展示读点；按难度取对应面）。 */
export function drownedQuarterTokenText(state, face) {
  return DROWNED_QUARTER_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}

export { investigatorCount }
