// 阿卡姆的毁灭 第一部分（theDoomOfArkhamPartI · 11682）· 混乱标记。
//
// 参考：Scenario/Scenarios/TheDrownedCity/TheDoomOfArkhamPartI.hs#HasChaosTokenValue +
//       TheDoomOfArkhamPartI.hs 的 FailedSkillTest / ResolveChaosToken 段 +
//       frontend/src/locales/en/theDrownedCity/theDoomOfArkhamPartI.json#tokens +
//       本地卡表 11682 textZh/backTextZh（中文标记文本）。
//
// 四档（提示卡 11682 正面 = 简单/普通，背面 = 困难/专家）：
//   [skull]       简单/普通：-X，X = 下方没有剧本卡牌的地点数量的一半（向上取整）；
//                 困难/专家：-X，X = 同样的地点数量（不折半）。
//   [cultist]     简单/普通 -3 / 困难专家 -5：检定失败时在最近的、其上没有毁灭标记的敌人上放 1 毁灭。
//   [tablet]      简单/普通 -3 / 困难专家 -5：检定失败时把你的 1 个线索放到你所在地点。
//   [elder_thing] 简单/普通 -2 / 困难专家 -4：如果你所在地点已淹没，再揭示一个标记。
//
// 引擎契约：`behavior.resolveChaosToken` 返回 `{ delta, onDraw, onFail }`；`onFail` 的
// `{type:'scenarioToken'}` 由 skill-effects.js 回派到 `behavior.applyTokenEffect`。
import { STORY } from './story.js'

export const isHardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
export const investigatorCount = state => Number(state?.numInvestigators) || (state?.investigators || []).length || 1
export const codeOf = value => String(value?.originalCode || value?.code || '')
export const hasTrait = (value, trait) => (value?.traits || [])
  .some(item => String(item).toLowerCase() === String(trait).toLowerCase())

/** 地点下方的暗牌堆（Setup 的 6 张：幽灵商店 + 午夜假面诡计）。 */
function beneathOf(state, locationId) {
  return state?.scenarioZones?.beneathStacks?.[locationId] || []
}

/** [skull] 的 X 原料：下方没有剧本卡牌的地点数量（未入场的放在一边地点不算）。 */
export function locationsWithoutBeneath(state) {
  return (state?.locations || []).filter(location => beneathOf(state, location.id).length === 0).length
}

/** [skull] 修正值（返回负数）。 */
export function skullValue(state) {
  const total = locationsWithoutBeneath(state)
  return -(isHardSide(state) ? total : Math.ceil(total / 2))
}

/** 已淹没（淹没等级 > 0）的地点 id 集合。 */
export function floodedLocationIds(state) {
  return Object.entries(state?.scenarioFlags?.flood || state?.__flood || {})
    .filter(([, level]) => Number(level) > 0).map(([id]) => id)
}

/** 玩家所在地点是否淹没（behavior 与卡条目共用的读点）。 */
export function isFlooded(state, inv, floodLevelOf = null) {
  if (!inv) return false
  if (typeof floodLevelOf === 'function') return floodLevelOf(inv.location) > 0
  if (state?.mechanics?.water) return state.mechanics.water.level(inv.location) > 0
  return floodedLocationIds(state).includes(inv.location)
}

/** 最近的、其上没有毁灭标记的敌人（未交战优先按地图距离；直调路径退回编号最小）。 */
export function nearestEnemyWithoutDoom(state, from, { nearest = null } = {}) {
  const eligible = (state?.enemies || []).filter(enemy => enemy && !enemy.defeated && !(Number(enemy.doom) || 0))
  if (!eligible.length) return null
  if (typeof nearest === 'function') {
    const ids = nearest(from, eligible.map(enemy => enemy.location)).filter(Boolean)
    const target = eligible.find(enemy => ids.includes(enemy.location))
    if (target) return target
  }
  return eligible[0]
}

export const DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS = Object.freeze({
  easy: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.easyStandard.skull || '-X。X 为下方没有剧本卡牌的地点数量的一半（向上取整）。', delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.easyStandard.cultist || '-3。如果本检定失败，在最近的、其上没有毁灭标记的敌人上放置 1 个毁灭标记。', delta: -3, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: STORY.tokensZh.easyStandard.tablet || '-3。如果本检定失败，将你的 1 个线索放在你所在地点。', delta: -3, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.easyStandard.elderThing || '-2。如果你所在地点淹没，揭示另一个标记。', delta: -2, rider: 'floodedAnotherToken' }),
  }),
  standard: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.easyStandard.skull || '-X。X 为下方没有剧本卡牌的地点数量的一半（向上取整）。', delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.easyStandard.cultist || '-3。如果本检定失败，在最近的、其上没有毁灭标记的敌人上放置 1 个毁灭标记。', delta: -3, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: STORY.tokensZh.easyStandard.tablet || '-3。如果本检定失败，将你的 1 个线索放在你所在地点。', delta: -3, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.easyStandard.elderThing || '-2。如果你所在地点淹没，揭示另一个标记。', delta: -2, rider: 'floodedAnotherToken' }),
  }),
  hard: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.hardExpert.skull || '-X。X 为下方没有剧本卡牌的地点数量。', delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.hardExpert.cultist || '-5。如果本检定失败，在最近的、其上没有毁灭标记的敌人上放置 1 个毁灭标记。', delta: -5, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: STORY.tokensZh.hardExpert.tablet || '-5。如果本检定失败，将你的 1 个线索放在你所在地点。', delta: -5, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.hardExpert.elderThing || '-4。如果你所在地点淹没，揭示另一个标记。', delta: -4, rider: 'floodedAnotherToken' }),
  }),
  expert: Object.freeze({
    skull: Object.freeze({ text: STORY.tokensZh.hardExpert.skull || '-X。X 为下方没有剧本卡牌的地点数量。', delta: 0 }),
    cultist: Object.freeze({ text: STORY.tokensZh.hardExpert.cultist || '-5。如果本检定失败，在最近的、其上没有毁灭标记的敌人上放置 1 个毁灭标记。', delta: -5, rider: 'doomOnNearestEnemyOnFail' }),
    tablet: Object.freeze({ text: STORY.tokensZh.hardExpert.tablet || '-5。如果本检定失败，将你的 1 个线索放在你所在地点。', delta: -5, rider: 'clueOnLocationOnFail' }),
    elderthing: Object.freeze({ text: STORY.tokensZh.hardExpert.elderThing || '-4。如果你所在地点淹没，揭示另一个标记。', delta: -4, rider: 'floodedAnotherToken' }),
  }),
})

export const CHAOS_TOKEN_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])

/** 逐标记取值：返回引擎 resolveChaosToken 契约的 `{ delta, onDraw, onFail }`；未知标记交回默认表。 */
export function doomOfArkhamPartOneChaosToken(state, inv, token) {
  const hard = isHardSide(state)
  switch (String(token)) {
    case 'skull':
      return { delta: skullValue(state), onDraw: [], onFail: [] }
    case 'cultist':
      return {
        delta: hard ? -5 : -3,
        onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'cultist', mode: 'doomOnNearestEnemy' }],
      }
    case 'tablet':
      return {
        delta: hard ? -5 : -3,
        onDraw: [],
        onFail: [{ type: 'scenarioToken', token: 'tablet', mode: 'clueOnLocation' }],
      }
    case 'elderthing':
      return {
        delta: hard ? -4 : -2,
        onDraw: [{ type: 'scenarioToken', token: 'elderthing', mode: 'floodedAnotherToken' }],
        onFail: [],
      }
    default:
      return null
  }
}

/** 兼容展示/测试读点：只返回签名修正值（负数）。 */
export function doomOfArkhamPartOneChaosTokenValue(state, tokenFace) {
  return doomOfArkhamPartOneChaosToken(state, null, tokenFace)?.delta ?? null
}

/** 提示卡文本（按难度取对应面）。 */
export function doomOfArkhamPartOneTokenText(state, face) {
  return DOOM_OF_ARKHAM_PART_I_TOKEN_MEANINGS[isHardSide(state) ? 'hard' : 'standard'][face]?.text || ''
}
