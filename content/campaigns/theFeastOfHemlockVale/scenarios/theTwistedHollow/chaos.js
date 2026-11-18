// 扭曲空洞（theTwistedHollow · 10605）· 混乱标记与「黑暗等级」。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheTwistedHollow.hs#HasChaosTokenValue +
//       frontend/src/locales/en/theFeastOfHemlockVale/theTwistedHollow.json#tokens +
//       cards-data 10605 的印刷正/反面文本（textZh / backTextZh）。
//   简单/普通：[skull]-X（X=当前黑暗等级）；[cultist]-1（治愈你调查员的1点伤害）；
//             [tablet]-3（失败：找出追击中躲避值最高的敌人，生成在你的地点）；
//             [elder_thing]-4（失败：受到1点恐惧）。
//   困难/专家：[skull]-X（X=黑暗等级的两倍）；[cultist]-3（检定成功：治愈1点伤害）；
//             [tablet]-4（无论结果：生成追击中躲避值最高的敌人）；
//             [elder_thing]-5（无论结果：受到1点恐惧）。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；
// `onDraw`/`onFail` 里的 `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx
// 回派到 `behavior.applyTokenEffect`（失败追加效果只在失败时结算）。
// 困难面 [cultist] 的「检定成功才治愈」没有 onSuccess 通道，读点是 behavior.afterTest
// （见 behavior.js，明确披露）。
//
// 「黑暗等级」的事实源：`state.scenarioFlags.twistedHollowDarkness`（setup 放 1 个资源，
// 之后由议程背面增加）。引擎目前没有 DarknessLevel 标记池，因此本模块是该数值的唯一读点。

export const DARKNESS_FLAG = 'twistedHollowDarkness'
export const INITIAL_DARKNESS = 1
export const MAX_DARKNESS = 6

// 卡面文本（与 10605 的 textZh / backTextZh 同源；测试会比对印刷文本，防止两处漂移）。
export const TWISTED_HOLLOW_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前的黑暗等级。', delta: 'darkness' }),
    cultist: Object.freeze({ text: '-1。治愈你调查员的1点伤害。', delta: -1, rider: 'cultistHeal' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，找出躲避值最高且处于追击中的敌人。将它生成在你的地点。', delta: -3, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，受到1点恐惧。', delta: -4, rider: 'elderthingEasy' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前的黑暗等级。', delta: 'darkness' }),
    cultist: Object.freeze({ text: '-1。治愈你调查员的1点伤害。', delta: -1, rider: 'cultistHeal' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，找出躲避值最高且处于追击中的敌人。将它生成在你的地点。', delta: -3, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，受到1点恐惧。', delta: -4, rider: 'elderthingEasy' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前黑暗等级的两倍。', delta: 'darknessTwice' }),
    cultist: Object.freeze({ text: '-3。如果你检定成功，治愈你调查员的1点伤害。', delta: -3, rider: 'cultistHealOnSuccess' }),
    tablet: Object.freeze({ text: '-4。找出躲避值最高且处于追击中的敌人。将它生成在你的地点。', delta: -4, rider: 'tabletHard' }),
    elderthing: Object.freeze({ text: '-5。受到1点恐惧。', delta: -5, rider: 'elderthingHard' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X为当前黑暗等级的两倍。', delta: 'darknessTwice' }),
    cultist: Object.freeze({ text: '-3。如果你检定成功，治愈你调查员的1点伤害。', delta: -3, rider: 'cultistHealOnSuccess' }),
    tablet: Object.freeze({ text: '-4。找出躲避值最高且处于追击中的敌人。将它生成在你的地点。', delta: -4, rider: 'tabletHard' }),
    elderthing: Object.freeze({ text: '-5。受到1点恐惧。', delta: -5, rider: 'elderthingHard' }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

/** 当前黑暗等级（setup 放 1；议程背面每次 +1；6 为剧本模式上限档）。 */
export function darknessLevel(state) {
  const raw = Number(state?.scenarioFlags?.[DARKNESS_FLAG])
  return Number.isFinite(raw) ? Math.max(0, raw) : INITIAL_DARKNESS
}

/** 写黑暗等级的唯一入口（裁剪到 0..MAX_DARKNESS，返回新值）。 */
export function setDarknessLevel(state, value) {
  state.scenarioFlags ||= {}
  const next = Math.max(0, Math.min(MAX_DARKNESS, Math.round(Number(value) || 0)))
  state.scenarioFlags[DARKNESS_FLAG] = next
  return next
}

/** 议程背面「增加1资源到当前黑暗等级」。 */
export function raiseDarkness(state, amount = 1) {
  return setDarknessLevel(state, darknessLevel(state) + Math.max(0, Number(amount) || 0))
}

/** 是否已进入「黑暗等级 6+」的致命档。 */
export function isFinalDarkness(state) {
  return darknessLevel(state) >= MAX_DARKNESS
}

/**
 * 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；
 * 未知标记返回 null（交回引擎默认表）。
 */
export function twistedHollowChaosToken(state, inv, token) {
  void inv
  const hard = isHardSide(state)
  const darkness = darknessLevel(state)
  switch (token) {
    case 'skull':
      return { delta: -(hard ? darkness * 2 : darkness), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        // 困难面「检定成功才治愈」在 afterTest 里结算（引擎没有 onSuccess 通道）。
        ? { delta: -3, onDraw: [], onFail: [] }
        : { delta: -1, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'heal' }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -4, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'always' }], onFail: [] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'fail' }] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'always' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'fail' }] }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function twistedHollowChaosTokenValue(state, tokenFace, inv) {
  return twistedHollowChaosToken(state, inv, tokenFace)?.delta ?? null
}

/** 供 scenario.tokenMeanings / AI / 前端展示的四档文本（与印刷同源）。 */
export function tokenMeanings() {
  return { easy: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.easy }, standard: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.standard },
    hard: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.hard }, expert: { ...TWISTED_HOLLOW_TOKEN_MEANINGS.expert } }
}
