// 古老者之城（City of the Elder Things · 08621）· 混乱标记取值与后果。
//
// 参考：08621 卡面两档 + locale `scenarios/cityOfTheElderThings.json#tokens`。
// X = 你控制的钥匙数量；困难/专家骷髅再 +2；[tablet] 与 [frost] 的联动由 behavior.afterTest 结算
// （标记取值只返回 `autoFail`/rider 标记，真正扣伤害/自动失败在章节层）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { valueKeysAt } from '../../../../../src/engine/scenario-keys.js'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

export const CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X。X为你控制的钥匙的数量。', delta: 0 },
    cultist: { text: '-2。如果你检定失败，将你控制的一个钥匙放到你所在地点。', delta: -2, rider: 'placeKeyOnFail' },
    tablet: { text: '-3。如果本次检定期间揭示了[frost]标记，改为你自动失败。', delta: -3, rider: 'tabletFrost' },
    elderthing: { text: '-4。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。', delta: -4, rider: 'nearestEnemyOnFail' },
  },
  hard: {
    skull: { text: '-X。X为你控制的钥匙的数量加2。', delta: 0 },
    cultist: { text: '-2。将你控制的一个钥匙放到你所在地点。', delta: -2, rider: 'placeKey' },
    tablet: { text: '-4。如果本次检定期间揭示了[frost]标记，改为你受到1点伤害且自动失败。', delta: -4, rider: 'tabletFrostDamage' },
    elderthing: { text: '-5。如果你检定失败，最近的敌人向你移动一次。如果其与你交战，其攻击。', delta: -5, rider: 'nearestEnemyOnFail' },
  },
})

/** 逐标记取值：`{ delta, autoFail?, rider? }`；未声明的标记交回引擎默认表（null）。 */
export function cityOfTheElderThingsChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const keys = (valueKeysAt(state, 'investigator:' + (inv?.seat ?? 0)) || []).length
    return { delta: -(keys + (hard ? 2 : 0)) }
  }
  if (token === 'cultist') return { delta: -2, rider: hard ? 'placeKey' : 'placeKeyOnFail' }
  if (token === 'tablet') return { delta: hard ? -4 : -3, rider: hard ? 'tabletFrostDamage' : 'tabletFrost' }
  if (token === 'elderthing') return { delta: hard ? -5 : -4, rider: 'nearestEnemyOnFail' }
  return null
}

/** frost 标记是否在本次检定里被揭示（tablet 联动）。 */
export const frostRevealed = result => {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).some(token => token === 'frost' && !cancelled.has(token))
}

/** 检定结束后的标记后果（behavior.afterTest 读；幂等）。 */
export function cityOfTheElderThingsAfterTest(state, inv, result) {
  if (!inv || !result) return null
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  const frost = frostRevealed(result)
  for (const token of tokens) {
    const meaning = CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS[hardSide(state) ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    if (meaning.rider === 'placeKey') riders.push('placeKey')
    else if (meaning.rider === 'placeKeyOnFail' && !result.success) riders.push('placeKey')
    else if (meaning.rider === 'tabletFrost' && frost) { riders.push('autoFail'); riders.push('tabletFrost') }
    else if (meaning.rider === 'tabletFrostDamage' && frost) { riders.push('autoFail'); riders.push('autoFailDamage') }
    else if (meaning.rider === 'nearestEnemyOnFail' && !result.success) riders.push('nearestEnemy')
  }
  return [...new Set(riders)]
}

export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
