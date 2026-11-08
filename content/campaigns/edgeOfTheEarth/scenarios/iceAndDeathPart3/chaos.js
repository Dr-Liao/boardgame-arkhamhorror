// 亡命冰原 III（iceAndDeathPart3 · 印刷参考卡 08501）· 混乱标记。
//
// 参考：Scenario/Scenarios/EdgeOfTheEarth/IceAndDeathPart3.hs#HasChaosTokenValue。
//   [skull]：简单/普通 = ceil(庇护值/2)，困难/专家 = 庇护值。
//   [cultist]：-2；[tablet]：简单/普通 -3，困难/专家 -4。
// 其余标记沿用战役混乱袋基础值（战役层 CHAOS_BAGS）。
//
// 本章 chaos.js 同时暴露静态文案表与运行时数值函数；definition 把它接入 scenario.tokenMeanings，
// behavior.chaosTokenValue 供引擎/测试读当前庇护值。
export const PART3_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({ skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3 }),
  standard: Object.freeze({ skull: 'ceil(庇护值 / 2)', cultist: -2, tablet: -3 }),
  hard: Object.freeze({ skull: '庇护值', cultist: -2, tablet: -4 }),
  expert: Object.freeze({ skull: '庇护值', cultist: -2, tablet: -4 }),
})

// 地点庇护值：优先读地点实例上的 shelter/shelterValue（P2 eote-shelter 落地前的兼容读点），
// 其次读关卡数据里地点定义的 shelter；都没有则 0。
export function shelterValueOf(state, locationId) {
  if (!locationId) return 0
  const placed = (state.locations || []).find(location => location.id === locationId)
  const definition = state.scenario?.locations?.[locationId]
  const raw = placed?.shelter ?? placed?.shelterValue ?? definition?.shelter ?? definition?.shelterValue
  return Number.isFinite(Number(raw)) ? Number(raw) : 0
}

export function part3ChaosTokenValue(state, tokenFace, inv) {
  const hard = ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
  const shelter = shelterValueOf(state, inv?.location)
  switch (tokenFace) {
    case 'skull': return hard ? shelter : Math.ceil(shelter / 2)
    case 'cultist': return -2
    case 'tablet': return hard ? -4 : -3
    default: return null
  }
}

/**
 * 检定失败时的标记后果（08501 参考卡，简单/普通与困难/专家不同）。
 * [cultist] 失败：将忒咳哩-哩牌库顶 1 张洗入牌库（困难/专家按失败差值；不能洗入则 1 点恐惧/张）；
 * [tablet] 失败：每低于难度 1 点弃牌库顶 1 张，弃到的弱点抽取。
 * @returns {{token:string, kind:'tekelili'|'discardTop', count:number}|null}
 */
export function part3ChaosFailureSpec(state, tokenFace, failedBy) {
  const shortfall = Math.max(0, Number(failedBy) || 0)
  if (!shortfall) return null
  const hard = ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
  if (tokenFace === 'cultist') return { token: tokenFace, kind: 'tekelili', count: hard ? shortfall : 1 }
  if (tokenFace === 'tablet') return { token: tokenFace, kind: 'discardTop', count: shortfall }
  return null
}
