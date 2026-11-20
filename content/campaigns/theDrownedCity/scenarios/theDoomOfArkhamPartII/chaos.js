// 阿卡姆的毁灭 第二部分（theDoomOfArkhamPartII · 11688a）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartII.hs#HasChaosTokenValue +
//       RunMessage 的 ResolveChaosToken / FailedSkillTest 段 +
//       frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartII.json#tokens +
//       本地卡表 11688a textZh/backTextZh（中文标记文本）。
//
// 四档（提示卡 11688a 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 克苏鲁的狂怒值；困难/专家：-X，X = 狂怒值 + 2。
//   [cultist]     简单/普通：-3，失败且你所在地点淹没 → 受到 1 点伤害；
//                 困难/专家：-5，如果所在地点淹没 → 受到 1 点伤害（不等失败）。
//   [tablet]      简单/普通 -3 / 困难专家 -5：失败时把你的 1 个线索放到你所在地点。
//   [elder_thing] 简单/普通 -1 / 困难专家 -3：揭示另一个标记；失败时本检定结算后
//                 抽克苏鲁牌库顶 1 张（每轮最多 1 张）。
//
// 狂怒值存在 state.scenarioFlags.cthulhuRage（剧本内容层状态，随存档 JSON 往返）。
import { STORY } from './story.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

export const CTHULHU_DECK_DRAW_FLAG = 'cthulhuDeckDrawRound'

/** 克苏鲁的狂怒值（Setup 放 1 资源，1–2 人局再 +1）。 */
export function cthulhuRage(state) {
  const value = Number(state?.scenarioFlags?.cthulhuRage)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
export function setCthulhuRage(state, value) {
  state.scenarioFlags ||= {}
  state.scenarioFlags.cthulhuRage = Math.max(0, Number(value) || 0)
  return state.scenarioFlags.cthulhuRage
}
export function increaseCthulhuRage(state, amount = 1) {
  return setCthulhuRage(state, cthulhuRage(state) + (Number(amount) || 1))
}

/** [skull] 修正值（返回负数）。 */
export function skullValue(state) {
  const rage = cthulhuRage(state)
  return -(isHardSide(state) ? rage + 2 : rage)
}

/** 已淹没地点 id 集合（承载水位读点）。 */
export function floodedLocationIds(state, floodLevelOf = null) {
  if (typeof floodLevelOf === 'function') {
    return (state?.locations || []).filter(location => floodLevelOf(location.id) > 0).map(location => location.id)
  }
  const flood = state?.scenarioFlags?.flood || {}
  return Object.entries(flood).filter(([, level]) => Number(level) > 0).map(([id]) => id)
}

/** 完全淹没（水位 2）。 */
export function fullyFloodedLocationIds(state, floodLevelOf = null) {
  if (typeof floodLevelOf === 'function') {
    return (state?.locations || []).filter(location => floodLevelOf(location.id) >= 2).map(location => location.id)
  }
  const flood = state?.scenarioFlags?.flood || {}
  return Object.entries(flood).filter(([, level]) => Number(level) >= 2).map(([id]) => id)
}

export const DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.easyStandard.skull || "-X。X 为克苏鲁的狂怒值。", delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.easyStandard.cultist || '-3。如果你失败且你所在地点淹没，受到 1 点伤害。', delta: -3, rider: 'damageOnFailIfFlooded' }),
    tablet: Object.freeze({ text: STORY.tokensZh.easyStandard.tablet || '-3。如果你失败，将你的 1 个线索放在你所在地点。', delta: -3, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.easyStandard.elderThing || '-1。揭示另一个标记。如果你失败，本检定结算后，抽取克苏鲁牌库顶的 1 张卡牌。（每轮最多抽取 1 张。）', delta: -1, rider: 'anotherTokenAndCthulhuDrawOnFail' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.easyStandard.skull || "-X。X 为克苏鲁的狂怒值。", delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.easyStandard.cultist || '-3。如果你失败且你所在地点淹没，受到 1 点伤害。', delta: -3, rider: 'damageOnFailIfFlooded' }),
    tablet: Object.freeze({ text: STORY.tokensZh.easyStandard.tablet || '-3。如果你失败，将你的 1 个线索放在你所在地点。', delta: -3, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.easyStandard.elderThing || '-1。揭示另一个标记。如果你失败，本检定结算后，抽取克苏鲁牌库顶的 1 张卡牌。（每轮最多抽取 1 张。）', delta: -1, rider: 'anotherTokenAndCthulhuDrawOnFail' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.hardExpert.skull || "-X。X 比克苏鲁的狂怒值多 2。", delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.hardExpert.cultist || '-5。如果你所在地点淹没，受到 1 点伤害。', delta: -5, rider: 'damageIfFlooded' }),
    tablet: Object.freeze({ text: STORY.tokensZh.hardExpert.tablet || '-5。如果你失败，将你的 1 个线索放在你所在地点。', delta: -5, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.hardExpert.elderThing || '-3。揭示另一个标记。如果你失败，本检定结算后，抽取克苏鲁牌库顶的 1 张卡牌。（每轮最多抽取 1 张。）', delta: -3, rider: 'anotherTokenAndCthulhuDrawOnFail' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.hardExpert.skull || "-X。X 比克苏鲁的狂怒值多 2。", delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.hardExpert.cultist || '-5。如果你所在地点淹没，受到 1 点伤害。', delta: -5, rider: 'damageIfFlooded' }),
    tablet: Object.freeze({ text: STORY.tokensZh.hardExpert.tablet || '-5。如果你失败，将你的 1 个线索放在你所在地点。', delta: -5, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.hardExpert.elderThing || '-3。揭示另一个标记。如果你失败，本检定结算后，抽取克苏鲁牌库顶的 1 张卡牌。（每轮最多抽取 1 张。）', delta: -3, rider: 'anotherTokenAndCthulhuDrawOnFail' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；未知标记交回默认表。 */
export function doomOfArkhamPartTwoChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: hard ? -5 : -3,
        onDraw: hard ? [{ type: 'scenarioToken', token: 'cultist', mode: 'damageIfFlooded' }] : [],
        onFail: hard ? [] : [{ type: 'scenarioToken', token: 'cultist', mode: 'damageIfFlooded' }],
      }
    case 'tablet':
      return {
        delta: hard ? -5 : -3,
        onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'clueOnLocation' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -3 : -1,
        onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'elderthing', mode: 'anotherTokenAndCthulhuDraw' }],
      }
    default:
      return null
  }
}

/** 兼容展示/测试读点：只返回签名修正值（负数）。 */
export function doomOfArkhamPartTwoChaosTokenValue(state, tokenFace) {
  return doomOfArkhamPartTwoChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（按难度取对应面）。 */
export function doomOfArkhamPartTwoTokenText(state, face) {
  return DOOM_OF_ARKHAM_PART_II_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}

/** 「(每轮最多抽取 1 张)」：同一轮只允许 elder_thing 失败抽 1 张克苏鲁牌。 */
export function canDrawCthulhuFromToken(state) {
  return state?.scenarioFlags?.[CTHULHU_DECK_DRAW_FLAG] !== state?.round
}
export function markCthulhuDrawnFromToken(state) {
  state.scenarioFlags ||= {}
  state.scenarioFlags[CTHULHU_DECK_DRAW_FLAG] = state.round
  return true
}
