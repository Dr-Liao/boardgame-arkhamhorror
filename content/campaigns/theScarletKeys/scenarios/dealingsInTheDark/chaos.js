// 暗中交易 · 混乱标记取值与后果（09566 提示卡 + 密谋 1a/故事 09571）。
//
// 口径与 EotE/TDE 的章节 chaos.js 相同：
//   · `behavior.resolveChaosToken` 负责符号标记的**动态数值**（唯一读点）：
//       [skull] 的 X = 场上线索最多的[[异教徒]]敌人上的线索数（困难/专家改为总数），上限 3/4；
//       若已进入终局（The Chase 同时充当场景 3）则 X 恒为上限。
//   · 主检定的静态文本/默认值来自 `definition.js#TOKEN_MEANINGS`（本文件只做动态值）。
//   · 失败后的强制：[tablet] 把你的 1 个线索放到你所在地点；[elderthing] 在最近的[[异教徒]]敌人上
//     放 1 毁灭（简单/标准仅失败时；困难/专家无论成败）。
//   · 教派线索总数 = 场上[[异教徒]]敌人的线索总数 + 「彰显的线索」（scenarioFlags.cluesUnveiled）。
//
// 近似（逐条见 primitive-requests/09566.json）：
//   · [cultist]「你可以放 1 毁灭把它改为 -1/-3」在引擎里没有「标记取值前选择」窗口，
//     本章固定按 -5/-7 结算，并把可选改值挂在 `cultistDoomSwap` 上供面板/日志提示。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

export const chaosFx = (delta, extra = {}) => ({ delta, ...extra })

export const HARD_SIDES = Object.freeze(['hard', 'expert'])
export const isHardSide = state => HARD_SIDES.includes(String(state?.difficulty || 'standard'))

const traitsOf = card => {
  const printed = ALL_CARDS[card?.originalCode || card?.code]?.traits || []
  return [...printed, ...(card?.traits || [])].map(trait => String(trait).toLowerCase())
}

export const isCultist = card => traitsOf(card).includes('cultist')

/** 场上的[[异教徒]]敌人（阴影/一边的敌人不在 state.enemies 里，自然不计）。 */
export function cultistEnemies(state) {
  return (state?.enemies || []).filter(enemy => enemy && !enemy.defeated && !enemy.removedFromGame && isCultist(enemy))
}

export function highestCultistClues(state) {
  return cultistEnemies(state).reduce((max, enemy) => Math.max(max, Number(enemy.clues) || 0), 0)
}

export function totalCultistClues(state) {
  return cultistEnemies(state).reduce((sum, enemy) => sum + (Number(enemy.clues) || 0), 0)
}

/** 「彰显的线索」数量：剧本标记 number；引擎没有剧情卡线索计数器原语（近似见请求 09571）。 */
export function cluesUnveiled(state) {
  return Math.max(0, Number(state?.scenarioFlags?.cluesUnveiled) || 0)
}

/** 教派拥有的线索总数（09571 正面第三条）。 */
export function cultCluesTotal(state) {
  return totalCultistClues(state) + cluesUnveiled(state)
}

/** 调查员共同拥有的线索总数（09589 / 09570 的比较口径）。 */
export function investigatorCluesTotal(state) {
  return (state?.investigators || []).reduce((sum, inv) => sum + (Number(inv?.clues) || 0), 0)
}

/**
 * 是否已进入终局：幕牌库走完后「追逐」(09570) 同时充当场景 3。
 * 读点不写死卡号：当前密谋的 chapterFlow 为 theChase，或幕指针已越过最后一张幕。
 */
export function isFinalStage(state) {
  const agenda = state?.agendas?.[state.agendaIndex]
  if (agenda?.chapterFlow === 'theChase') return true
  const acts = state?.acts || []
  return acts.length > 0 && Number(state?.actIndex) >= acts.length
}

/** [skull] 的 X：简单/标准取「单个异教徒最多线索」，困难/专家取「异教徒线索总数」，均以 3/4 封顶。 */
export function skullValue(state) {
  const maximum = isHardSide(state) ? 4 : 3
  if (isFinalStage(state)) return maximum
  return Math.min(maximum, isHardSide(state) ? totalCultistClues(state) : highestCultistClues(state))
}

/**
 * 动态混乱标记取值。返回 null 表示交回 `TOKEN_MEANINGS` 的静态值。
 * `cultistDoomSwap` / `placeClueOnLocationOnFail` / `doomOnNearestCultist` 是给 behavior 的后果声明。
 */
export function dealingsChaosToken(state, _inv, token) {
  const face = String(token || '').toLowerCase()
  if (face === 'skull') return chaosFx(-skullValue(state), { skullX: skullValue(state) })
  if (face === 'cultist') {
    const base = isHardSide(state) ? -7 : -5
    return chaosFx(base, { cultistDoomSwap: { doom: 1, changedTo: isHardSide(state) ? -3 : -1 } })
  }
  if (face === 'tablet') return chaosFx(isHardSide(state) ? -4 : -3, { placeClueOnLocationOnFail: true })
  if (face === 'elderthing') return chaosFx(-2, { doomOnNearestCultist: isHardSide(state) ? 'always' : 'onFail' })
  return null
}

/**
 * 检定后的符号后果（behavior.afterTest 调用；必须幂等，重复调用也只按标记出现次数结算一次）。
 *   · [tablet] 失败 → 把你的 1 个线索放到你所在地点；
 *   · [elderthing] 简单/标准失败、困难/专家无论成败 → 在最近的异教徒上放 1 毁灭。
 */
export function dealingsChaosAfterTest(state, inv, result) {
  if (!inv || !result) return []
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(String(token).toLowerCase()))
  const failed = result.success !== true
  const effects = []
  if (tokens.includes('tablet') && failed && (Number(inv.clues) || 0) > 0) {
    effects.push({ type: 'clueToLocation', seat: inv.seat, amount: 1 })
  }
  if (tokens.includes('elderthing') && (isHardSide(state) || failed)) {
    effects.push({ type: 'doomOnNearestCultist' })
  }
  return effects
}

/** 最近的[[异教徒]]敌人（按地点距离；无法计算时退回第一个在场的异教徒）。 */
export function nearestCultist(state, fromLocationId) {
  const candidates = cultistEnemies(state)
  if (!candidates.length) return null
  const distance = (from, to) => {
    if (!from || !to) return Number.POSITIVE_INFINITY
    const queue = [[from, 0]]
    const seen = new Set([from])
    while (queue.length) {
      const [id, steps] = queue.shift()
      if (id === to) return steps
      const location = (state.locations || []).find(loc => loc.id === id)
      for (const next of location?.connections || []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push([next, steps + 1])
      }
    }
    return Number.POSITIVE_INFINITY
  }
  let best = candidates[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const enemy of candidates) {
    const value = distance(fromLocationId, enemy.location)
    if (value < bestDistance) {
      best = enemy
      bestDistance = value
    }
  }
  return best
}
