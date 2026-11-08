// 亡命冰原 第 I 部分（iceAndDeathPart1 · 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart1.hs#HasChaosTokenValue + FailedSkillTest。
//   [skull]：简单/普通 = ceil(你所在地点庇护值 / 2)；困难/专家 = 你所在地点庇护值。
//   [cultist]：-2。检定失败时：将忒咳哩-哩牌库顶 1 张洗入你的牌库（简单/普通固定 1 张；
//              困难/专家按失败差值张数，每张不能洗入则受 1 点恐惧）。
//   [tablet]：简单/普通 -3，困难/专家 -4。失败时每低于难度 1 点弃牌库顶 1 张；弃到的弱点抽取。
// 其余标记沿用战役混乱袋基础值（共享层负责）。
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'

export const PART1_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3,
    cultistBack: '失败：将忒咳哩-哩牌库顶 1 张洗入牌库。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  standard: Object.freeze({
    skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3,
    cultistBack: '失败：将忒咳哩-哩牌库顶 1 张洗入牌库。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  hard: Object.freeze({
    skull: '庇护值', cultist: -2, tablet: -4,
    cultistBack: '失败：每低于难度 1 点，将忒咳哩-哩牌库顶 1 张洗入牌库；不能洗入则受 1 点恐惧。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
  expert: Object.freeze({
    skull: '庇护值', cultist: -2, tablet: -4,
    cultistBack: '失败：每低于难度 1 点，将忒咳哩-哩牌库顶 1 张洗入牌库；不能洗入则受 1 点恐惧。',
    tabletBack: '失败：每低于难度 1 点，弃牌库顶 1 张；弱点抽取。',
  }),
})

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

/** 当前所在地点的庇护值（P2 eote-shelter 读点；缺失/未知按 0）。 */
export function shelterValueOf(state, locationId) {
  if (!locationId) return 0
  try {
    return Number(locationShelter(state, locationId)) || 0
  } catch {
    const placed = (state.locations || []).find(location => location.id === locationId)
    const definition = state.scenario?.locations?.[locationId]
    const raw = placed?.shelter ?? definition?.shelter ?? 0
    return Number.isFinite(Number(raw)) ? Number(raw) : 0
  }
}

/** 标记修正值；返回 null 表示交回引擎默认值。 */
export function part1ChaosTokenValue(state, tokenFace, inv) {
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hardSide(state) ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hardSide(state) ? -4 : -3
    default: return null
  }
}

/**
 * 检定失败时的标记后果（纯数据；由 behavior.afterTest 用 api 执行）。
 * @returns {{token:string, kind:'tekelili'|'discardTop', count:number}|null}
 *   同一检定同时有 cultist/tablet 时返回数组由 behavior 逐个执行。
 */
export function part1ChaosFailureSpec(state, tokenFace, failedBy) {
  const shortfall = Math.max(0, Number(failedBy) || 0)
  if (!shortfall) return null
  if (tokenFace === 'cultist') {
    return { token: tokenFace, kind: 'tekelili', count: hardSide(state) ? shortfall : 1 }
  }
  if (tokenFace === 'tablet') return { token: tokenFace, kind: 'discardTop', count: shortfall }
  return null
}
