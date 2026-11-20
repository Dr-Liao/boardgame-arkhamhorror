// 古代议庭（courtOfTheAncients · 提示卡 11612）· 混乱标记。
//
// 权威来源：Scenario/Scenarios/TheDrownedCity/CourtOfTheAncients.hs#HasChaosTokenValue +
//           frontend/src/locales/en/theDrownedCity/courtOfTheAncients.json#tokens +
//           src/cards/cards-data.js 的 11612 正反面（简中印刷文本）。
//
// 四档（11612 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 胜利区中[[符文]]卡牌数量；困难/专家：-X，X = 该数量 + 1。
//   [cultist]     简单/普通：-2（你所在地点有[[偷渡者]]敌人时 -4）；困难/专家：-3（-5）。
//   [tablet]      简单/普通：-2；困难/专家：-3。若你所在地点淹没，揭示另一个标记（drawAnother）。
//   [elder_thing] 简单/普通：-4；困难/专家：-5。如果本标记在一次攻击或躲避尝试中揭示，
//                 受到 1 点伤害或 1 点恐惧（困难/专家：1 点伤害和 1 点恐惧）。
//
// 引擎契约：behavior.resolveChaosToken 返回 { delta, drawAnother, onDraw, onFail }；
// [elder_thing] 的「攻击/躲避尝试」读 skillTest.frame.actionKind（applyTokenEffect 内判断）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

export const GLYPH_TRAIT = 'Glyph'
export const LIFT_TRAIT = 'Lift'
export const STOWAWAY_TRAIT = 'Stowaway'

/** 胜利区里的[[符文]]卡牌（敌人/诡计/故事卡都按卡表特质判定）。 */
export function glyphCardsInVictory(state) {
  return (state?.victoryDisplay || []).filter(entry => {
    const card = ALL_CARDS[entry?.originalCode || entry?.code] || entry
    return hasTrait(card, GLYPH_TRAIT)
  })
}
export function glyphCount(state) {
  return glyphCardsInVictory(state).length
}

/** 调查员已翻译的符文数量（跨章记录 discoveredGlyphs，string[]）。 */
export function translatedGlyphCount(state) {
  return new Set(state?.campaign?.records?.discoveredGlyphs || []).size
}

/** [skull] 的 X：简单/普通 = 胜利区符文数；困难/专家 = 符文数 + 1。 */
export function skullValue(state) {
  const count = glyphCount(state)
  return isHardSide(state) ? count + 1 : count
}

/** 所在地点淹没等级。 */
export function floodLevelOf(state, locationId) {
  return Number(mechanicState(state)?.flood?.[locationId]) || 0
}
export function locationFlooded(state, inv) {
  return floodLevelOf(state, inv?.location) > 0
}
/** 你所在地点是否有[[偷渡者]]敌人（[cultist] 子句）。 */
export function stowawayAtLocation(state, inv) {
  return (state?.enemies || []).some(enemy => enemy.location === inv?.location && hasTrait(enemy, STOWAWAY_TRAIT))
}
export function cultistValue(state, inv) {
  const occupied = stowawayAtLocation(state, inv)
  if (isHardSide(state)) return occupied ? -5 : -3
  return occupied ? -4 : -2
}

export const COURT_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为胜利区[[符文]]卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2(如果你所在地点有[[偷渡者]]敌人，改为-4)。', delta: -2 }),
    tablet: Object.freeze({ text: '-2。如果你所在地点淹没，揭示另一个标记。', delta: -2, rider: 'drawAnotherIfFlooded' }),
    elderthing: Object.freeze({ text: '-4。如果本标记在一次攻击或躲避尝试中揭示，受到1点伤害或1点恐惧。', delta: -4, rider: 'elderThingCombat' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为胜利区[[符文]]卡牌的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-2(如果你所在地点有[[偷渡者]]敌人，改为-4)。', delta: -2 }),
    tablet: Object.freeze({ text: '-2。如果你所在地点淹没，揭示另一个标记。', delta: -2, rider: 'drawAnotherIfFlooded' }),
    elderthing: Object.freeze({ text: '-4。如果本标记在一次攻击或躲避尝试中揭示，受到1点伤害或1点恐惧。', delta: -4, rider: 'elderThingCombat' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X比胜利区[[符文]]卡牌的数量多1。', delta: 0 }),
    cultist: Object.freeze({ text: '-3(如果你所在地点有[[偷渡者]]敌人，改为-5)。', delta: -3 }),
    tablet: Object.freeze({ text: '-3。如果你所在地点淹没，揭示另一个标记。', delta: -3, rider: 'drawAnotherIfFlooded' }),
    elderthing: Object.freeze({ text: '-5。如果本标记在一次攻击或躲避尝试中揭示，受到1点伤害和1点恐惧。', delta: -5, rider: 'elderThingCombat' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X比胜利区[[符文]]卡牌的数量多1。', delta: 0 }),
    cultist: Object.freeze({ text: '-3(如果你所在地点有[[偷渡者]]敌人，改为-5)。', delta: -3 }),
    tablet: Object.freeze({ text: '-3。如果你所在地点淹没，揭示另一个标记。', delta: -3, rider: 'drawAnotherIfFlooded' }),
    elderthing: Object.freeze({ text: '-5。如果本标记在一次攻击或躲避尝试中揭示，受到1点伤害和1点恐惧。', delta: -5, rider: 'elderThingCombat' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 { delta, drawAnother, onDraw, onFail }。 */
export function courtChaosToken(state, inv, token) {
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [], drawAnother: false }
    case 'cultist':
      return { delta: cultistValue(state, inv), onDraw: [], onFail: [], drawAnother: false }
    case 'tablet':
      return { delta: isHardSide(state) ? -3 : -2, onDraw: [], onFail: [], drawAnother: locationFlooded(state, inv) }
    case 'elderthing':
      return {
        delta: isHardSide(state) ? -5 : -4, onDraw: [], onFail: [], drawAnother: false,
        onToken: [{ type: 'scenarioToken', token: 'elderthing', mode: 'elderThingCombat' }],
      }
    default:
      return null
  }
}

/** 兼容展示读点：签名修正值（负数）。 */
export function courtChaosTokenValue(state, tokenFace, inv = null) {
  return courtChaosToken(state, inv, tokenFace)?.delta ?? null
}

/** 提示卡文本（指南/AI 展示读点；按难度取对应面）。 */
export function courtTokenText(state, face) {
  return COURT_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}
