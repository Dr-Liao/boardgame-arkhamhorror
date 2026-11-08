// 失落之峰（To the Forbidden Peaks · 08596）· 混乱标记取值与后果。
//
// 参考：08596 卡面（简单/普通 vs 困难/专家两档）+ locale `scenarios/toTheForbiddenPeaks.json#tokens`。
// 口径：`resolveChaosToken` 只返回数值（`{ delta, autoFail?, drawAnother? }`）与需要章节执行的
// 标记后果标记（`rider` 字段）；真正结算在 `behavior.afterTest`（引擎会在正常/自动失败两条路径
// 各调一次，behavior 必须幂等）。X = 所在地点 level；困难/专家骷髅再 +2。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const levelOf = (state, inv) => {
  const location = (state?.locations || []).find(item => item.id === inv?.location)
  const level = Number(location?.level)
  return Number.isSafeInteger(level) && level >= 0 ? level : 0
}

export const TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X。X等于所在地点的高度。', delta: 0 },
    cultist: { text: '-1。如果你检定失败，在本次检定结束后，移动到你下方紧挨着的地点。(FAQ, v2.1)', delta: -1, rider: 'moveBelowOnFail' },
    tablet: { text: '-3。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。', delta: -3, rider: 'dropExpeditionOnFail' },
    elderthing: { text: '-4。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。', delta: -4, rider: 'elderThingOnFail' },
  },
  hard: {
    skull: { text: '-X。X等于所在地点的高度加2。', delta: 0 },
    cultist: { text: '-1。在本次检定结束后，移动到你下方紧挨着的地点。(FAQ, v2.1)', delta: -1, rider: 'moveBelow' },
    tablet: { text: '-4。如果你检定失败，失去你对一个[[探险]]支援的控制权，并将其放在你所在地点。', delta: -4, rider: 'dropExpeditionOnFail' },
    elderthing: { text: '-5。如果你检定失败，最近的[[古老者]]敌人向你移动一次。如果其与你交战，其攻击。', delta: -5, rider: 'elderThingOnFail' },
  },
})

/** 逐标记取值：返回 `{ delta, rider? }`；未声明的标记交回引擎默认表（null）。 */
export function toTheForbiddenPeaksChaosToken(state, inv, token) {
  const hard = hardSide(state)
  if (token === 'skull') return { delta: -(levelOf(state, inv) + (hard ? 2 : 0)) }
  if (token === 'cultist') return { delta: -1, rider: hard ? 'moveBelow' : 'moveBelowOnFail' }
  if (token === 'tablet') return { delta: hard ? -4 : -3, rider: 'dropExpeditionOnFail' }
  if (token === 'elderthing') return { delta: hard ? -5 : -4, rider: 'elderThingOnFail' }
  return null
}

/** 检定结束后需要结算的骷髅/符号后果（由 behavior.afterTest 读取；纯数据、幂等）。 */
export function toTheForbiddenPeaksAfterTest(state, inv, result) {
  if (!inv || !result) return null
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  for (const token of tokens) {
    const meaning = TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS[hardSide(state) ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    if (meaning.rider === 'moveBelow') riders.push('moveBelow')
    else if (meaning.rider === 'moveBelowOnFail' && !result.success) riders.push('moveBelow')
    else if (meaning.rider === 'dropExpeditionOnFail' && !result.success) riders.push('dropExpedition')
    else if (meaning.rider === 'elderThingOnFail' && !result.success) riders.push('elderThing')
  }
  return [...new Set(riders)]
}

/** 实体名（日志用；不在卡文件里重复印刷事实）。 */
export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
