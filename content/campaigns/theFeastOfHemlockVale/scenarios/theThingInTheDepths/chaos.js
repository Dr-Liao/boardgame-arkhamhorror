// 深沼之物（theThingInTheDepths · 提示卡 10588）· 混乱标记数值与追加效果。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheThingInTheDepths.hs#HasChaosTokenValue +
//       提示卡 10588 正/背面（card-data.js 的 text/backText）+ input.chaosSymbols 四档文本。
//   简单/普通（正面）：
//     [skull]     -X。X = 场上[[沉没]]地点数的一半（向上取整）。
//     [cultist]   -1。你可以从最近的[[沼地]]地点移除 1 个渗坑。
//     [tablet]    -3。若检定失败，在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。
//     [elder_thing] -4。若检定失败，查找遭遇牌库与遭遇弃牌堆，找出一张攫噬触须敌人并抽取，忽略其涌动。
//   困难/专家（背面）：
//     [skull]     -X。X = 场上[[沉没]]地点数（向上取整）。
//     [cultist]   -3。若检定成功，你可以从最近的[[沼地]]地点移除 1 个渗坑。
//     [tablet]    -5。在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。
//     [elder_thing] -5。查找遭遇牌库与遭遇弃牌堆，找出一张攫噬触须敌人并抽取，忽略其涌动。
//
// 引擎契约（与 TSK 各章同口径）：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；
// `onDraw`/`onFail` 里的 `{ type: 'scenarioToken', token, mode }` 由 skill-effects.js#applyTokenFx
// 回派 `behavior.applyTokenEffect`（失败追加效果只在失败时结算）。
// 「若检定成功」的困难/专家 [cultist] 没有 onSuccess 通道，由 behavior.afterTest 读取
// `{ resolvedTokens }` 在成功后结算（与 Haskell PassedSkillTest 分支同序）。

export const GRASPING_TENDRIL_CODE = '10602'
export const SUNKEN_TRAIT = 'Sunken'
export const BOG_TRAIT = 'Bog'

const symbol = (text, delta, rider) => Object.freeze({ text, delta, ...(rider ? { rider } : {}) })

// 供 AI / 前端展示（与 behavior 判定同源）；键用引擎的标记名（elderthing / eldersign…）。
export const THE_THING_IN_THE_DEPTHS_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: symbol('-X。X 为场上[[沉没]]地点数量的一半（向上取整）。', 0),
    cultist: symbol('-1。你可以从最近的[[沼地]]地点移除 1 个渗坑。', -1, 'mayRemoveSinkhole'),
    tablet: symbol('-3。如果你检定失败，在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。', -3, 'placeSinkholeOnFail'),
    elderthing: symbol('-4。如果你检定失败，查找遭遇牌库和遭遇弃牌堆，找出一张攫噬触须敌人，将其抽取，忽略其涌动关键词。', -4, 'searchTendrilOnFail'),
  }),
  standard: Object.freeze({
    skull: symbol('-X。X 为场上[[沉没]]地点数量的一半（向上取整）。', 0),
    cultist: symbol('-1。你可以从最近的[[沼地]]地点移除 1 个渗坑。', -1, 'mayRemoveSinkhole'),
    tablet: symbol('-3。如果你检定失败，在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。', -3, 'placeSinkholeOnFail'),
    elderthing: symbol('-4。如果你检定失败，查找遭遇牌库和遭遇弃牌堆，找出一张攫噬触须敌人，将其抽取，忽略其涌动关键词。', -4, 'searchTendrilOnFail'),
  }),
  hard: Object.freeze({
    skull: symbol('-X。X 为场上[[沉没]]地点的数量（向上取整）。', 0),
    cultist: symbol('-3。如果你检定成功，你可以从最近的[[沼地]]地点移除 1 个渗坑。', -3, 'mayRemoveSinkholeOnSuccess'),
    tablet: symbol('-5。在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。', -5, 'placeSinkhole'),
    elderthing: symbol('-5。查找遭遇牌库和遭遇弃牌堆，找出一张攫噬触须敌人，将其抽取，忽略其涌动关键词。', -5, 'searchTendril'),
  }),
  expert: Object.freeze({
    skull: symbol('-X。X 为场上[[沉没]]地点的数量（向上取整）。', 0),
    cultist: symbol('-3。如果你检定成功，你可以从最近的[[沼地]]地点移除 1 个渗坑。', -3, 'mayRemoveSinkholeOnSuccess'),
    tablet: symbol('-5。在最近的[[沼地]]地点放置 1 个伤害标记，作为渗坑。', -5, 'placeSinkhole'),
    elderthing: symbol('-5。查找遭遇牌库和遭遇弃牌堆，找出一张攫噬触须敌人，将其抽取，忽略其涌动关键词。', -5, 'searchTendril'),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

const traitsOf = value => (value?.traits || []).map(trait => String(trait).toLowerCase())
export const hasTrait = (value, trait) => traitsOf(value).includes(String(trait).toLowerCase())

/** 场上[[沉没]]地点数：地点翻面后的 printed traits 是唯一事实源。 */
export function sunkenLocationCount(state) {
  return (state?.locations || []).filter(location => hasTrait(location, SUNKEN_TRAIT)).length
}

/** [skull] 的 X：简单/普通为一半向上取整，困难/专家为全数（参考 Haskell ceiling/sunken）。 */
export function skullValue(state) {
  const sunken = sunkenLocationCount(state)
  return isHardSide(state) ? sunken : Math.ceil(sunken / 2)
}

/**
 * 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；
 * 未知标记返回 null（交回引擎默认表 / tokenMeanings）。
 */
export function thingInTheDepthsChaosToken(state, inv, token) {
  void inv
  const hard = isHardSide(state)
  switch (token) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -3, onDraw: [], onFail: [] }
        : { delta: -1, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'mayRemoveSinkhole' }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'placeSinkhole' }], onFail: [] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'placeSinkhole' }] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'searchTendril' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'searchTendril' }] }
    default:
      return null
  }
}

/** 兼容测试/展示读点：返回签名修正值（负数）；未知标记 null。 */
export function thingInTheDepthsChaosTokenValue(state, tokenFace, inv) {
  return thingInTheDepthsChaosToken(state, inv, tokenFace)?.delta ?? null
}
