// 死亡酷暑（deadHeat · 09520）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheScarletKeys/DeadHeat.hs#HasChaosTokenValue +
//       frontend/src/locales/{en,zh}/theScarletKeys/scenarios/deadHeat.json#tokens。
//   [skull]：每 1[per_investigator] 名被杀害的平民 -1（困难/专家 -2）。
//   [cultist]：简单/普通 -4，若检定失败：选择你所在地点一个非[[精英]]敌人，重整并攻击你；
//              困难/专家 -6，无论检定结果都执行该效果。
//   [tablet]：简单/普通 -1，你可以承受 1 点伤害；若不承受，你所在地点 1 名平民被杀害；
//             困难/专家 -2，承受 1 点伤害且你所在地点 1 名平民被杀害。
//   [elder_thing]：简单/普通 -3，失败时选择并弃掉 1 张手牌；困难/专家 -4，失败时随机弃 1 张。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；
// `onDraw`/`onFail` 的 `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx
// 回派到 `behavior.applyTokenEffect`（失败追加效果只在失败时结算）。
// 动态 skull 值由 behavior 计算；`scenario.tokenMeanings` 同源供 AI / 前端展示读取。

export const DEAD_HEAT_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为每1[per_investigator]名被杀害的平民（向下取整）。', delta: 0 }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，选择你所在地点的一个非[[精英]]敌人。该敌人重整并攻击你。', delta: -4, rider: 'cultist' }),
    tablet: Object.freeze({ text: '-1。你可以承受1点伤害。如果你不承受，你所在地点的一名平民被杀害。', delta: -1, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-3。如果你检定失败，选择并弃掉1张手牌。', delta: -3, rider: 'elderthingChoose' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为每1[per_investigator]名被杀害的平民（向下取整）。', delta: 0 }),
    cultist: Object.freeze({ text: '-4。如果你检定失败，选择你所在地点的一个非[[精英]]敌人。该敌人重整并攻击你。', delta: -4, rider: 'cultist' }),
    tablet: Object.freeze({ text: '-1。你可以承受1点伤害。如果你不承受，你所在地点的一名平民被杀害。', delta: -1, rider: 'tabletEasy' }),
    elderthing: Object.freeze({ text: '-3。如果你检定失败，选择并弃掉1张手牌。', delta: -3, rider: 'elderthingChoose' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为每1[per_investigator]名被杀害的平民的两倍（向下取整）。', delta: 0 }),
    cultist: Object.freeze({ text: '-6。选择你所在地点的一个非[[精英]]敌人。该敌人重整并攻击你。', delta: -6, rider: 'cultistAlways' }),
    tablet: Object.freeze({ text: '-2。承受1点伤害。你所在地点的一名平民被杀害。', delta: -2, rider: 'tabletHard' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，随机弃掉1张手牌。', delta: -4, rider: 'elderthingRandom' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X为每1[per_investigator]名被杀害的平民的两倍（向下取整）。', delta: 0 }),
    cultist: Object.freeze({ text: '-6。选择你所在地点的一个非[[Elite]]敌人。该敌人重整并攻击你。', delta: -6, rider: 'cultistAlways' }),
    tablet: Object.freeze({ text: '-2。承受1点伤害。你所在地点的一名平民被杀害。', delta: -2, rider: 'tabletHard' }),
    elderthing: Object.freeze({ text: '-4。如果你检定失败，随机弃掉1张手牌。', delta: -4, rider: 'elderthingRandom' }),
  }),
})

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1

/** 被杀害的平民总数（记在剧本标记上；判读只读这一处）。 */
export function civiliansSlain(state) {
  return Math.max(0, Number(state?.scenarioFlags?.deadHeatCiviliansSlain) || 0)
}

/** 每 [per_investigator] 1 名平民对应的骷髅修正档位（向下取整）。 */
export function perPlayerCiviliansSlain(state) {
  return Math.floor(civiliansSlain(state) / investigatorCount(state))
}

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；未知标记交回默认表（null）。 */
export function deadHeatChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (token) {
    case 'skull': {
      const x = perPlayerCiviliansSlain(state) * (hard ? 2 : 1)
      return { delta: -x, onDraw: [], onFail: [] }
    }
    case 'cultist':
      return hard
        ? { delta: -6, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'always' }], onFail: [] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'fail' }] }
    case 'tablet':
      return hard
        ? { delta: -2, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'hard' }], onFail: [] }
        : { delta: -1, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'easy' }], onFail: [] }
    case 'elderthing':
      return hard
        ? { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'random' }] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'choose' }] }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function deadHeatChaosTokenValue(state, tokenFace, inv) {
  return deadHeatChaosToken(state, inv, tokenFace)?.delta ?? null
}
