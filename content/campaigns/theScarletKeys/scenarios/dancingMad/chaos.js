// 疯星乱舞（Dancing Mad · 09591）· 混乱标记取值与后果。
//
// 参考：09591 卡面（简单/普通 vs 困难/专家两档）+ locale `scenarios/dancingMad.json#tokens`。
// 口径与其它章节一致：`resolveChaosToken` 只返回数值（`{ delta, rider? }`）与需要章节执行的
// 标记后果标记（`rider` 字段）；真正结算在 `behavior.afterTest`（引擎在正常/自动失败两条路径各调
// 一次，behavior 必须幂等）。
//
// 本章符号依赖场上状态：X = 阴影中敌人的数量（简单/普通最多 3，困难/专家最多 5）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))
const maxX = state => (hardSide(state) ? 5 : 3)

/** 阴影中敌人的数量（不含诱饵）：由内容层传入的计数回调求值（behavior 读 tsk-concealed 容器）。 */
const shadowCount = (state, countEnemiesInShadows) => (typeof countEnemiesInShadows === 'function'
  ? Math.max(0, Number(countEnemiesInShadows(state)) || 0)
  : 0)

export const DANCING_MAD_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X。X 为阴影中敌人的数量（最多 3）。', delta: 0, rider: 'skullShadowCount' },
    cultist: { text: '-4。如果你检定失败，将一张诱饵放置入场，放到你所在地点，将其翻面，并正面朝下混洗你所在地的每张隐匿迷你卡牌。', delta: -4, rider: 'decoyOnFail' },
    tablet: { text: '-3。如果你检定失败，将每张投入本次检定的非弱点卡牌放在一边，位于场外，作为空洞。', delta: -3, rider: 'hollowCommittedOnFail' },
    elderthing: { text: '-1。如果你所在地点有隐匿迷你卡牌，受到 1 点伤害，或将本标记的修正值视为 -3。', delta: -1, rider: 'elderThingConcealed' },
  },
  hard: {
    skull: { text: '-X。X 为阴影中敌人的数量（最多 5）。', delta: 0, rider: 'skullShadowCount' },
    cultist: { text: '-6。如果你检定失败，将一张诱饵放置入场，放到你所在地点，将其翻面，并正面朝下混洗你所在地的每张隐匿迷你卡牌。', delta: -6, rider: 'decoyOnFail' },
    tablet: { text: '-3。将每张投入本次检定的非弱点卡牌放在一边，位于场外，作为空洞。', delta: -3, rider: 'hollowCommitted' },
    elderthing: { text: '-1。如果你所在地点有隐匿迷你卡牌，受到 2 点伤害，或将本标记的修正值视为 -5。', delta: -1, rider: 'elderThingConcealed' },
  },
})

// 2026-11-13 P1-10：四档难度同源表（easy 同标准、expert 同困难）。
// 消费方 `src/engine/combat-odds.js` / `ai-context.js` 按 `state.difficulty` 直接索引，缺两档会拿到
// undefined 而回落 SYMBOL_DEFAULTS，导致 AI 命中率预估与人工结算不一致（规则本身走 behavior 结算）。
export const DANCING_MAD_TOKEN_MEANINGS_BY_DIFFICULTY = Object.freeze({
  easy: Object.freeze({ ...DANCING_MAD_TOKEN_MEANINGS.standard }),
  standard: Object.freeze({ ...DANCING_MAD_TOKEN_MEANINGS.standard }),
  hard: Object.freeze({ ...DANCING_MAD_TOKEN_MEANINGS.hard }),
  expert: Object.freeze({ ...DANCING_MAD_TOKEN_MEANINGS.hard }),
})

/** 逐标记取值：返回 `{ delta, rider? }`；未声明的标记交回引擎默认表（null）。 */
export function dancingMadChaosToken(state, inv, token, options = {}) {
  const hard = hardSide(state)
  if (token === 'skull') {
    const x = Math.min(maxX(state), shadowCount(state, options.enemiesInShadows))
    return { delta: -x, rider: 'skullShadowCount', x }
  }
  if (token === 'cultist') return { delta: hard ? -6 : -4, rider: 'decoyOnFail' }
  if (token === 'tablet') return { delta: -3, rider: hard ? 'hollowCommitted' : 'hollowCommittedOnFail' }
  if (token === 'elderthing') return { delta: -1, rider: 'elderThingConcealed', alternative: hard ? -5 : -3 }
  return null
}

/**
 * 检定结束后需要结算的符号后果（由 behavior.afterTest 读取；纯数据、幂等）。
 * 返回去重后的 rider 列表：
 *   · `decoyOnFail`        —— [cultist] 失败：本地诱饵入场并混洗本地迷你卡
 *   · `hollowCommitted`    —— [tablet] 困难/专家：立即把投入的非弱点卡变成空洞
 *   · `hollowCommittedOnFail` —— [tablet] 简单/普通：失败时才把投入的非弱点卡变成空洞
 *   · `elderThingConcealed` —— [elderthing] 本地有迷你卡时二选一（伤害或把修正视为 -3/-5）
 */
export function dancingMadAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const hard = hardSide(state)
  const cancelled = new Set(result.cancelledTokens || result.cancelled || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  for (const token of tokens) {
    const meaning = DANCING_MAD_TOKEN_MEANINGS[hard ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    const rider = meaning.rider
    if (rider === 'decoyOnFail' && result.success) continue
    if (rider === 'hollowCommittedOnFail' && result.success) continue
    riders.push(rider === 'hollowCommittedOnFail' ? 'hollowCommitted' : rider)
  }
  return [...new Set(riders)]
}

/** 实体名（日志用；不在卡文件里重复印刷事实）。 */
export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
