// 最长一夜（theLongestNight · 10626）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheLongestNight.hs#HasChaosTokenValue 与
//       RunMessage（ResolveChaosToken / PassedSkillTest / FailedSkillTest）+
//       提示卡 10626 印刷文本（cards-data 的 text/textZh 与 input.chaosSymbols 同源）。
//
// 简单/普通（提示卡正面）：
//   [skull]      -X。X 为场上毁灭标记数的一半（向上取整）。
//   [cultist]    -2。在你的地点放置 1 个屏障。
//   [tablet]     -1。再揭示一个标记。若你检定失败，最近的敌人重整、移动并攻击，如同敌军阶段。
//   [elder_thing] -4。若你检定失败，在你的地点移除 1 个屏障、诱饵或陷阱。
// 困难/专家（提示卡背面）：
//   [skull]      -X。X 为场上毁灭标记数。
//   [cultist]    -3。若你检定成功，在你的地点放置 1 个屏障。
//   [tablet]     -4。最近的敌人重整、移动并攻击，如同敌军阶段。
//   [elder_thing] -5。在你的地点移除 1 个屏障、诱饵或陷阱。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, drawAnother, onDraw, onFail }`；
// `onDraw`/`onFail` 的 `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx 回派到
// `behavior.applyTokenEffect`（drawAnother 由检定流程自己再抽一个标记）。
// 「若检定成功」的追加效果（困难/专家的 [cultist]）不在揭示时结算：behavior.afterTest 读
// `resolvedTokens` 与 `result.success` 后再放置屏障。

export const THE_LONGEST_NIGHT_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上毁灭标记数的一半（向上取整）。', delta: 0, rider: 'halfDoom' }),
    cultist: Object.freeze({ text: '-2。在你的地点放置 1 个屏障。', delta: -2, rider: 'placeBarrierAlways' }),
    tablet: Object.freeze({ text: '-1。再揭示一个标记。若你检定失败，最近的敌人重整、移动并攻击，如同是敌军阶段。', delta: -1, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-4。若你检定失败，在你的地点移除 1 个屏障、诱饵或陷阱。', delta: -4, rider: 'removeDefenseOnFail' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上毁灭标记数的一半（向上取整）。', delta: 0, rider: 'halfDoom' }),
    cultist: Object.freeze({ text: '-2。在你的地点放置 1 个屏障。', delta: -2, rider: 'placeBarrierAlways' }),
    tablet: Object.freeze({ text: '-1。再揭示一个标记。若你检定失败，最近的敌人重整、移动并攻击，如同是敌军阶段。', delta: -1, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-4。若你检定失败，在你的地点移除 1 个屏障、诱饵或陷阱。', delta: -4, rider: 'removeDefenseOnFail' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上毁灭标记数。', delta: 0, rider: 'fullDoom' }),
    cultist: Object.freeze({ text: '-3。若你检定成功，在你的地点放置 1 个屏障。', delta: -3, rider: 'placeBarrierOnSuccess' }),
    tablet: Object.freeze({ text: '-4。最近的敌人重整、移动并攻击，如同是敌军阶段。', delta: -4, rider: 'nearestEnemyAlways' }),
    elderthing: Object.freeze({ text: '-5。在你的地点移除 1 个屏障、诱饵或陷阱。', delta: -5, rider: 'removeDefenseAlways' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X 为场上毁灭标记数。', delta: 0, rider: 'fullDoom' }),
    cultist: Object.freeze({ text: '-3。若你检定成功，在你的地点放置 1 个屏障。', delta: -3, rider: 'placeBarrierOnSuccess' }),
    tablet: Object.freeze({ text: '-4。最近的敌人重整、移动并攻击，如同是敌军阶段。', delta: -4, rider: 'nearestEnemyAlways' }),
    elderthing: Object.freeze({ text: '-5。在你的地点移除 1 个屏障、诱饵或陷阱。', delta: -5, rider: 'removeDefenseAlways' }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const doomOf = card => Math.max(0, Number(card?.doom) || 0)

/**
 * 场上毁灭标记总数（提示卡 [skull] 的 X）：
 * 密谋计数器 + 场上每张卡（地点/敌人/剧情资产/支援/幕牌）上的毁灭。
 * 与议程「检查毁灭阈值」的减法口径不同：那是议程条目自己的规则，标记数值仍按「场上总数」。
 */
export function doomInPlay(state) {
  const cards = [
    ...(state?.locations || []), ...(state?.enemies || []), ...(state?.storyAssets || []),
    ...(state?.agendas || []), ...(state?.acts || []),
    ...((state?.investigators || []).flatMap(inv => [...(inv?.assets || []), ...(inv?.threat || [])])),
  ]
  return Math.max(0, Number(state?.doom) || 0) + cards.reduce((sum, card) => sum + doomOf(card), 0)
}

export const halfDoomInPlay = state => Math.ceil(doomInPlay(state) / 2)

/** 逐标记取值：返回引擎 resolveChaosToken 契约的对象；未知标记交回默认表（null）。 */
export function theLongestNightChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (token) {
    case 'skull':
      return { delta: -(hard ? doomInPlay(state) : halfDoomInPlay(state)), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -3, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'success' }], onFail: [] }
        : { delta: -2, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -4, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'always' }], onFail: [] }
        : { delta: -1, drawAnother: true, onDraw: [],
          onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'fail' }] }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数或 0）。 */
export function theLongestNightChaosTokenValue(state, tokenFace) {
  return theLongestNightChaosToken(state, null, tokenFace)?.delta ?? null
}

export { THE_LONGEST_NIGHT_TOKEN_MEANINGS as TOKEN_MEANINGS }
