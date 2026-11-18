// 寂静荒野（theSilentHeath · 10549）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheFeastOfHemlockVale/TheSilentHeath.hs#HasChaosTokenValue +
//       TheSilentHeath.hs 的 ResolveChaosToken / PassedSkillTest / FailedSkillTest 段 +
//       frontend/src/locales/en/theFeastOfHemlockVale/theSilentHeath.json#tokens。
//
// 四档（提示卡 10549 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 场上与胜利区中[[昆虫]]敌人数的一半（向上取整）；
//                 困难/专家：-X，X = 同样的敌人总数（不折半）。
//   [cultist]     简单/普通：-1，你可以将胜利区一个非[[精英]]敌人洗回遭遇牌库；
//                 困难/专家：-3，如果你检定成功，你可以这样做。
//   [tablet]      简单/普通：-3，失败时选择你所在地点一个[[昆虫]]敌人，它与你交战并立即攻击；
//                 困难/专家：-5，重整最近的[[昆虫]]敌人，它移动并攻击（如同敌军阶段）。
//   [elder_thing] 简单/普通：-2，如果你在[[巢穴]]地点，再揭示一个标记；
//                 困难/专家：-4，如果你在[[巢穴]]地点，你自动失败。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；`onDraw`/`onFail` 的
// `{type:'scenarioToken', token}` 由 skill-effects.js#applyTokenFx 回派到 `behavior.applyTokenEffect`。
// 困难/专家 [cultist] 的「检定成功后」读 effect.test.failedBy（与《消失的姐妹》同一口径）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

export const INSECT_TRAIT = 'Insect'
export const LAIR_TRAIT = 'Lair'

/** 场上（含未交战/横置）的[[昆虫]]敌人。 */
export function insectsInPlay(state) {
  return (state?.enemies || []).filter(enemy => !enemy.defeated && hasTrait(enemy, INSECT_TRAIT))
}

/** 胜利区里的[[昆虫]]敌人（包含敌人-地点实体；读卡表特质兜底）。 */
export function insectsInVictory(state) {
  return (state?.victoryDisplay || []).filter(entry => {
    const card = ALL_CARDS[entry?.originalCode || entry?.code] || entry
    return card?.type === 'enemy' && hasTrait(card, INSECT_TRAIT)
  })
}

/** skull 的 X 值原料：场上 + 胜利区。 */
export function insectCount(state) {
  return insectsInPlay(state).length + insectsInVictory(state).length
}

/** [skull] 的伤害：简单/普通向上取整折半；困难/专家取全量。 */
export function skullValue(state) {
  const total = insectCount(state)
  return isHardSide(state) ? total : Math.ceil(total / 2)
}

/** 调查员是否在[[巢穴]]地点（[elder_thing] 子句）。 */
export function atLairLocation(state, inv) {
  const location = (state?.locations || []).find(item => item.id === inv?.location)
  return Boolean(location && hasTrait(location, LAIR_TRAIT))
}

/** [[巢穴]]地点（按需给「最近的」过滤器用；本关巢穴都是洞穴地点）。 */
export function lairLocations(state) {
  return (state?.locations || []).filter(location => hasTrait(location, LAIR_TRAIT))
}

export const SILENT_HEATH_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为场上和胜利区中[[昆虫]]敌人数量的一半(向上取整)。', delta: 0 }),
    cultist: Object.freeze({ text: '-1。你可以将胜利区的一个非[[精英]]敌人混洗入遭遇牌库。', delta: -1, rider: 'shuffleVictory' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，选择你所在地点的一个[[昆虫]]敌人。它与你交战并立即进行一次攻击。', delta: -3, rider: 'insectAttackOnFail' }),
    elderthing: Object.freeze({ text: '-2。如果你在[[巢穴]]地点，再揭示一个标记。', delta: -2, rider: 'lairAnotherToken' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为场上和胜利区中[[昆虫]]敌人数量的一半(向上取整)。', delta: 0 }),
    cultist: Object.freeze({ text: '-1。你可以将胜利区的一个非[[精英]]敌人混洗入遭遇牌库。', delta: -1, rider: 'shuffleVictory' }),
    tablet: Object.freeze({ text: '-3。如果你检定失败，选择你所在地点的一个[[昆虫]]敌人。它与你交战并立即进行一次攻击。', delta: -3, rider: 'insectAttackOnFail' }),
    elderthing: Object.freeze({ text: '-2。如果你在[[巢穴]]地点，再揭示一个标记。', delta: -2, rider: 'lairAnotherToken' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为场上和胜利区中[[昆虫]]敌人的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你检定成功，你可以将胜利区的一个非[[精英]]敌人混洗入遭遇牌库。', delta: -3, rider: 'shuffleVictoryOnSuccess' }),
    tablet: Object.freeze({ text: '-5。重整最近的[[昆虫]]敌人。它移动并攻击，如同此刻是敌军阶段。', delta: -5, rider: 'insectPhase' }),
    elderthing: Object.freeze({ text: '-4。如果你在[[巢穴]]地点，你自动失败。', delta: -4, rider: 'lairAutoFail' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X为场上和胜利区中[[昆虫]]敌人的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你检定成功，你可以将胜利区的一个非[[精英]]敌人混洗入遭遇牌库。', delta: -3, rider: 'shuffleVictoryOnSuccess' }),
    tablet: Object.freeze({ text: '-5。重整最近的[[昆虫]]敌人。它移动并攻击，如同此刻是敌军阶段。', delta: -5, rider: 'insectPhase' }),
    elderthing: Object.freeze({ text: '-4。如果你在[[巢穴]]地点，你自动失败。', delta: -4, rider: 'lairAutoFail' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；未知标记交回默认表。 */
export function silentHeathChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -3, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'shuffleVictoryOnSuccess' }], onFail: [] }
        : { delta: -1, onDraw: [{ type: 'scenarioToken', token: 'cultist', mode: 'shuffleVictory' }], onFail: [] }
    case 'tablet':
      return hard
        ? { delta: -5, onDraw: [{ type: 'scenarioToken', token: 'tablet', mode: 'insectPhase' }], onFail: [] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'insectAttack' }] }
    case 'elderthing':
      return hard
        ? { delta: -4, onDraw: [], onFail: [] }
        : { delta: -2, onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'lairAnotherToken' }], onFail: [] }
    default:
      return null
  }
}

/** 兼容旧测试/展示读点：返回签名修正值（负数）。 */
export function silentHeathChaosTokenValue(state, tokenFace) {
  return silentHeathChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（AI / 指南展示读点；按难度取对应面）。 */
export function silentHeathTokenText(state, face) {
  return SILENT_HEATH_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}

export { investigatorCount, codeOf }
