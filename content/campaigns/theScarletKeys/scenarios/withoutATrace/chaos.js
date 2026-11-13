// 不留痕迹（Without a Trace · 09681）· 混乱标记取值与后果。
//
// 参考：09681 卡面（简单/普通 vs 困难/专家两档，正反面）+ locale `scenarios/withoutATrace.json#tokens`。
// 口径与其它章节一致：`resolveChaosToken` 只返回数值（`{ delta, rider? }`）与需要章节执行的标记后果
// （`rider` 字段）；真正结算在 `behavior.afterTest`（引擎在正常/自动失败两条路径各调一次，
// behavior 必须幂等）。
//
// 本章四个符号都依赖场面：
//   [skull]    -X。X = 场上地点数量（简单/普通取一半向下取整；阴影中的地点不算）。
//   [cultist]  -4 / -6。失败后最近的[[域外]]敌人重整、向你移动一次，若在你地点则攻击你。
//   [tablet]   -X。X = 放在一边的空洞中归你所有的数量（简单/普通最多 5；困难/专家 +1）。
//   [elderthing] -3。失败后（困难/专家没有失败限定）把一张手牌放在一边作为空洞。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

// [tablet] 的 X 上限（简单/普通面「最多为 5」）。放在 chaos.js 里避免 chaos ↔ definition 循环引用
// （definition 需要从 chaos 取 tokenMeanings）；definition 再把它转出去给章节与测试用。
export const MAX_TABLET_HOLLOWS = 5

const hardSide = state => ['hard', 'expert'].includes(String(state?.difficulty || 'standard'))

/** 场上地点数量（阴影中的地点不算）：由内容层传入的计数回调求值。 */
const locationCount = (state, countLocations) => (typeof countLocations === 'function'
  ? Math.max(0, Number(countLocations(state)) || 0)
  : Math.max(0, (state?.locations || []).filter(loc => !loc.inShadows).length))

/** 该座位「放一边的空洞」数量（个人口径：自己名下 + 全队共享）。 */
const hollowsOwned = (state, seat, countHollows) => (typeof countHollows === 'function'
  ? Math.max(0, Number(countHollows(state, seat)) || 0)
  : 0)

export const WITHOUT_A_TRACE_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: {
      text: '-X。X 为场上地点数量的一半（向下取整；阴影中的地点不算）。',
      delta: 0, rider: 'skullLocationCount',
    },
    cultist: {
      text: '-4。如果你检定失败，最近的[[域外]]敌人重整、向你移动一次，如果位于你所在地点则攻击你。',
      delta: -4, rider: 'cultistOutsider',
    },
    tablet: {
      text: '-X。X 为放在一边的空洞中归你所有的数量（最多 5）。',
      delta: 0, rider: 'tabletHollowCount',
    },
    elderthing: {
      text: '-3。如果你检定失败，选择你手中一张非弱点卡牌，将其放在一边，作为一个空洞。',
      delta: -3, rider: 'elderThingHollow',
    },
  },
  hard: {
    skull: {
      text: '-X。X 为场上地点的数量（阴影中的地点不算）。',
      delta: 0, rider: 'skullLocationCount',
    },
    cultist: {
      text: '-6。如果你检定失败，最近的[[域外]]敌人重整、向你移动一次，如果位于你所在地点则攻击你。',
      delta: -6, rider: 'cultistOutsider',
    },
    tablet: {
      text: '-X。X 为放在一边的空洞中归你所有的数量 + 1。',
      delta: 0, rider: 'tabletHollowCount',
    },
    elderthing: {
      text: '-3。选择你手中一张非弱点卡牌，将其放在一边，作为一个空洞。',
      delta: -3, rider: 'elderThingHollow',
    },
  },
})

/** 逐标记取值：返回 `{ delta, rider?, x? }`；未声明的标记交回引擎默认表（null）。 */
export function withoutATraceChaosToken(state, inv, token, options = {}) {
  const hard = hardSide(state)
  const seat = Number.isInteger(inv?.seat) ? inv.seat : (options.seat ?? 0)
  if (token === 'skull') {
    const count = locationCount(state, options.countLocations)
    const x = hard ? count : Math.floor(count / 2)
    return { delta: -x, rider: 'skullLocationCount', x }
  }
  if (token === 'cultist') return { delta: hard ? -6 : -4, rider: 'cultistOutsider' }
  if (token === 'tablet') {
    const owned = hollowsOwned(state, seat, options.countHollows)
    const x = hard ? owned + 1 : Math.min(owned, MAX_TABLET_HOLLOWS)
    return { delta: -x, rider: 'tabletHollowCount', x }
  }
  if (token === 'elderthing') return { delta: -3, rider: 'elderThingHollow', alwaysHollow: hard }
  return null
}

/**
 * 检定结束后需要结算的符号后果（由 behavior.afterTest 读取；纯数据、幂等）。
 * 返回去重后的 rider 列表：
 *   · `cultistOutsider`  —— [cultist] 失败：最近的域外敌人重整 + 移动 + 本地攻击
 *   · `elderThingHollow` —— [elderthing]：简单/普通失败时、困难/专家总是把一张手牌变成空洞
 */
export function withoutATraceAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const hard = hardSide(state)
  const cancelled = new Set(result.cancelledTokens || result.cancelled || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const riders = []
  for (const token of tokens) {
    const meaning = WITHOUT_A_TRACE_TOKEN_MEANINGS[hard ? 'hard' : 'standard'][token]
    if (!meaning?.rider) continue
    if (meaning.rider === 'cultistOutsider' && result.success) continue
    if (meaning.rider === 'elderThingHollow' && !hard && result.success) continue
    riders.push(meaning.rider)
  }
  return [...new Set(riders)]
}

/** 实体名（日志用；不在卡文件里重复印刷事实）。 */
export const cardNameOf = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || String(code)
