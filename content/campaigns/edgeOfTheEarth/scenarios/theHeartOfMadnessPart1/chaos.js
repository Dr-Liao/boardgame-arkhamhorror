// 疯狂之心 第 I 部分 · 混乱标记取值与后果（参考 08648 参考卡 + 剧本卡面）。
//
// 口径：`behavior.resolveChaosToken` 负责符号标记的**动态数值**（ treachery-tokens 的单一读点），
// 主检定的静态文本/默认值来自 `scenario.tokenMeanings`（本文件导出）；
// 失败后的强制（石板抽 Tekeli-li、旧日支配者失败 3+ 放毁灭、异教徒标记视为寒霜）在
// `behavior.afterTest` / `resolveChaosToken` 里按卡面执行，behavior 必须幂等。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const chaosFx = (delta, extra = {}) => ({ delta, ...extra })

const TOKEN_TEXT = Object.freeze({
  standard: Object.freeze({
    skull: { text: '-1（如果你所在地点有[[旧日支配者]]敌人，改为-3）。', delta: 0 },
    cultist: { text: '-1。如果你所在地点有封印，或你所在地点是迷雾高塔，改为把该标记视为寒霜标记。', delta: 0 },
    tablet: { text: '-3。如果你失败，抽取忒咳哩-哩牌库顶的卡牌。', delta: 0 },
    elderthing: { text: '-4。如果你失败 3 点或更多，在当先议程上放置 1 毁灭。', delta: 0 },
  }),
  hard: Object.freeze({
    skull: { text: '-2（如果你所在地点有[[旧日支配者]]敌人，改为-4）。', delta: 0 },
    cultist: { text: '-1。如果你所在地点有封印，或你所在地点是迷雾高塔，该标记额外视为寒霜标记。', delta: 0 },
    tablet: { text: '-3。抽取忒咳哩-哩牌库顶的卡牌。', delta: 0 },
    elderthing: { text: '-5。如果你失败 3 点或更多，在当先议程上放置 1 毁灭。', delta: 0 },
  }),
})

export const HEART_OF_MADNESS_TOKEN_MEANINGS = TOKEN_TEXT
export const TOKEN_MEANING_SOURCE = 'cards-data:08648'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

const traitsOf = card => (ALL_CARDS[card?.originalCode || card?.code]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())

function locationOf(state, id) {
  return (state?.locations || []).find(location => location.id === id) || null
}

export function locationSeals(state, locationId) {
  const seals = state?.campaign?.eote?.seals?.entries || []
  return seals.filter(entry => entry && entry.locationId === locationId)
}

export function isMistPylon(state, location) {
  return Boolean(location && (location.mistPylon === true
    || String(location.name || '').toLowerCase().includes('mist-pylon')))
}

/** [cultist] 是否按寒霜处理：地点上有封印，或地点是迷雾高塔。 */
export function cultistCountsAsFrost(state, inv) {
  const here = locationOf(state, inv?.location)
  if (!here) return false
  return isMistPylon(state, here) || locationSeals(state, here.id).length > 0
}

/** [skull] 动态数值：所在地点有 Ancient One 敌人时加深；返回 null 交回默认 tokenMeanings。 */
export function heartOfMadnessChaosToken(state, inv, token) {
  if (token === 'skull') {
    const here = locationOf(state, inv?.location)
    const ancientOne = (state?.enemies || []).some(enemy => enemy && enemy.location === here?.id
      && traitsOf(enemy).includes('ancient one'))
    return chaosFx(hardSide(state) ? (ancientOne ? -4 : -2) : (ancientOne ? -3 : -1))
  }
  if (token === 'cultist') {
    return chaosFx(-1, cultistCountsAsFrost(state, inv) ? { asFrost: true } : {})
  }
  if (token === 'tablet') return chaosFx(-3, { drawTekeliOnFail: true })
  if (token === 'elderthing') return chaosFx(hardSide(state) ? -5 : -4, { doomOnFailBy: 3 })
  return null
}

/**
 * 检定后的符号后果（behavior.afterTest 调用；必须幂等）：
 *   · [tablet] 失败：抽忒咳哩-哩牌库顶 1 张（简单/标准；困难/专家无论成败都抽）；
 *   · [elderthing] 失败 3 点或更多：在当先议程上放 1 毁灭。
 * 具体执行交给 api（drawTekeliCard / addDoom），本函数只返回要结算的后果列表。
 */
export function heartOfMadnessChaosAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const failedBy = Math.max(0, Number(result.failedBy) || 0)
  const effects = []
  if (tokens.includes('tablet') && (hardSide(state) || !result.success)) effects.push({ type: 'drawTekeli' })
  if (tokens.includes('elderthing') && !result.success && failedBy >= 3) effects.push({ type: 'addDoom', amount: 1 })
  return effects
}
