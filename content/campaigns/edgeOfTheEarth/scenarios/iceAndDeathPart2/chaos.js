// 亡命冰原 第 II 部分（iceAndDeathPart2 · 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart2.hs#HasChaosTokenValue + FailedSkillTest。
// 与第 I 部分同一套符号数值：[skull] = 当前地点庇护值的一半（向上取整；困难/专家取全额）；
// [cultist] = -2（失败：忒咳哩-哩洗入牌库，困难/专家按失败差值）；[tablet] = -3/-4（失败弃牌库顶）。
import { locationShelter } from '../../../../../src/engine/eote-shelter.js'

export const PART2_TOKEN_MEANINGS = Object.freeze({
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

export function part2ChaosTokenValue(state, tokenFace, inv) {
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hardSide(state) ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hardSide(state) ? -4 : -3
    default: return null
  }
}

export function part2ChaosFailureSpec(state, tokenFace, failedBy) {
  const shortfall = Math.max(0, Number(failedBy) || 0)
  if (!shortfall) return null
  if (tokenFace === 'cultist') return { token: tokenFace, kind: 'tekelili', count: hardSide(state) ? shortfall : 1 }
  if (tokenFace === 'tablet') return { token: tokenFace, kind: 'discardTop', count: shortfall }
  return null
}
