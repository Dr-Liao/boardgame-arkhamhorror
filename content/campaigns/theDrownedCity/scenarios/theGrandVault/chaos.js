// 大秘库（theGrandVault · 提示卡 11587）· 混乱标记。
//
// 权威来源：Scenario/Scenarios/TheDrownedCity/TheGrandVault.hs#HasChaosTokenValue +
//           frontend/src/locales/en/theDrownedCity/theGrandVault.json#tokens +
//           src/cards/cards-data.js 的 11587 正反面（简中印刷文本）。
//
// 四档（11587 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 已激活地点数量的一半（向下取整）；困难/专家：-X，X = 已激活地点数量。
//   [cultist]     简单/普通：-3，检定失败后「使所在地点失活 / 受到 1 伤害 / 受到 1 恐惧」三选一；
//                 困难/专家：-4，检定结算后（无论成败）「使所在地点失活 / 受到 1 伤害和 1 恐惧」。
//   [tablet]      简单/普通：-2（部分淹没 -3，完全淹没 -4）；困难/专家：-3（-4 / -5）。
//   [elder_thing] 简单/普通：-4，失败后从遭遇弃牌堆找出一张「仍在你身后」加入胜利区；
//                 困难/专家：-5，失败后改为抽取它。
//
// 引擎契约：behavior.resolveChaosToken 返回 { delta, onDraw, onFail }；onDraw/onFail 的
// { type:'scenarioToken', token, mode } 由 skill-effects.js#applyTokenFx 回派到
// behavior.applyTokenEffect。困难/专家 [cultist] 由该章 afterTest 消费已结算的标记。
import { mechanicState } from '../../../../../src/engine/mechanic-state.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

export const GLYPH_TRAIT = 'Glyph'
export const VAULT_TRAIT = 'Vault'

// 已激活地点：`scenarioFlags.grandVaultActivated` = 地点 id 数组（resource 作为“已激活”标记的等价账本）。
export function activatedLocationIds(state) {
  return [...(state?.scenarioFlags?.grandVaultActivated || [])]
}
export function activatedCount(state) {
  return activatedLocationIds(state).length
}
export function isActivated(state, locationId) {
  return activatedLocationIds(state).includes(String(locationId))
}

/** [skull] 的 X 值：简单/普通折半向下取整，困难/专家取全量。 */
export function skullValue(state) {
  const total = activatedCount(state)
  return isHardSide(state) ? total : Math.floor(total / 2)
}

/** 所在地点的淹没等级（0 未淹没 / 1 部分 / 2 完全）。 */
export function floodLevelOf(state, locationId) {
  return Number(mechanicState(state)?.flood?.[locationId]) || 0
}

export function tabletValue(state, inv) {
  const level = floodLevelOf(state, inv?.location)
  const base = isHardSide(state) ? 3 : 2
  return -(base + level)
}

export const GRAND_VAULT_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: '-X。X为已激活地点数量的一半(向下取整)。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你失败，你必须使你所在地点失活，或受到1点伤害或1点恐惧。', delta: -3, rider: 'deactivateOrHarm' }),
    tablet: Object.freeze({ text: '-2(如果你所在地点部分淹没，改为-3；如果你所在地点完全淹没，改为-4)。', delta: -2 }),
    elderthing: Object.freeze({ text: '-4。如果你失败，查找遭遇弃牌堆，找出一张仍在你身后诡计，将其加入胜利区。', delta: -4, rider: 'searchStillBehindYou' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为已激活地点数量的一半(向下取整)。', delta: 0 }),
    cultist: Object.freeze({ text: '-3。如果你失败，你必须使你所在地点失活，或受到1点伤害或1点恐惧。', delta: -3, rider: 'deactivateOrHarm' }),
    tablet: Object.freeze({ text: '-2(如果你所在地点部分淹没，改为-3；如果你所在地点完全淹没，改为-4)。', delta: -2 }),
    elderthing: Object.freeze({ text: '-4。如果你失败，查找遭遇弃牌堆，找出一张仍在你身后诡计，将其加入胜利区。', delta: -4, rider: 'searchStillBehindYou' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: '-X。X为已激活地点的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-4。本检定结算后，你必须使你所在地点失活，或受到1点伤害和1点恐惧。', delta: -4, rider: 'deactivateOrHarmHard' }),
    tablet: Object.freeze({ text: '-3(如果你所在地点部分淹没，改为-4；如果你所在地点完全淹没，改为-5)。', delta: -3 }),
    elderthing: Object.freeze({ text: '-5。如果你失败，查找遭遇弃牌堆，找出一张仍在你身后诡计，将其抽取。', delta: -5, rider: 'drawStillBehindYou' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: '-X。X为已激活地点的数量。', delta: 0 }),
    cultist: Object.freeze({ text: '-4。本检定结算后，你必须使你所在地点失活，或受到1点伤害和1点恐惧。', delta: -4, rider: 'deactivateOrHarmHard' }),
    tablet: Object.freeze({ text: '-3(如果你所在地点部分淹没，改为-4；如果你所在地点完全淹没，改为-5)。', delta: -3 }),
    elderthing: Object.freeze({ text: '-5。如果你失败，查找遭遇弃牌堆，找出一张仍在你身后诡计，将其抽取。', delta: -5, rider: 'drawStillBehindYou' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 { delta, onDraw, onFail }；未知标记交回默认表。 */
export function grandVaultChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: -skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return hard
        ? { delta: -4, onDraw: [], onFail: [] }
        : { delta: -3, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'deactivateOrHarm' }] }
    case 'tablet':
      return { delta: tabletValue(state, inv), onDraw: [], onFail: [] }
    case 'elderthing':
      return hard
        ? { delta: -5, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'drawStillBehindYou' }] }
        : { delta: -4, onDraw: [], onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'searchStillBehindYou' }] }
    default:
      return null
  }
}

/** 兼容展示读点：签名修正值（负数）。 */
export function grandVaultChaosTokenValue(state, tokenFace) {
  return grandVaultChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（指南/AI 展示读点；按难度取对应面）。 */
export function grandVaultTokenText(state, face) {
  return GRAND_VAULT_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}
