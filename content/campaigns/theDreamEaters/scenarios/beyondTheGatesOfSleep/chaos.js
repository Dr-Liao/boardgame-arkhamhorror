// 梦境门外（Beyond the Gates of Sleep · 06039）· 混乱标记取值与后果（参考 BeyondTheGatesOfSleep.hs:163-178, 359-375）。
//
// 口径：`behavior.resolveChaosToken` 只负责**标记数值**；失败/揭示后的强制放在 `behavior.afterTest`。
// 本章是 A 线（梦寻）章：袋里只有 cultist + 2×tablet，没有 skull/elderthing —— 但本章参考卡印了
// skull 取值（14 种梦境把调查员送进幻梦境后由幕 3 背面加入 1 个 skull），因此这里三种符号都要有值。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { byDifficulty, chaosFx, hardSide } from '../../tde-chaos.js'

const original = card => card?.originalCode || card?.code || card
const traitsOf = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
  .map(trait => String(trait).toLowerCase())

export const WOODS_ORIGINAL_CODES = Object.freeze(['06050', '06051', '06052', '06053', '06054', '06055', '06056'])

export const BEYOND_THE_GATES_TOKEN_MEANINGS = Object.freeze({
  standard: {
    skull: { text: '-X. X is half the number of cards in your hand (rounded up).', delta: 0 },
    cultist: { text: '-X. X is the number of revealed Enchanted Woods locations.', delta: 0 },
    tablet: {
      text: '-2. If you fail and this is an attack or evasion attempt against a swarming enemy, add 1 swarm card to it.',
      delta: -2,
    },
  },
  hard: {
    skull: { text: '-X. X is the number of cards in your hand.', delta: 0 },
    cultist: { text: '-X. X is the number of revealed _Woods_ locations.', delta: 0 },
    tablet: {
      text: '-2. If this is an attack or evasion attempt against a swarming enemy, add 1 swarm card to it.',
      delta: -2,
    },
  },
})

function revealedWoodCount(state) {
  const hard = hardSide(state)
  return (state.locations || []).filter(location => {
    if (!location.revealed) return false
    if (!hard) return WOODS_ORIGINAL_CODES.includes(original(location))
    return traitsOf(location).includes('woods')
  }).length
}

/**
 * 符号数值（参考 BeyondTheGatesOfSleep.hs:163-178）：
 *   skull = -（手牌数的一半向上取整），困难/专家 = -（手牌数）；
 *   cultist = -（已揭示的魔幻森林数），困难/专家 = -（已揭示的 [[Woods]] 地点数）；
 *   tablet = -2（后果在 afterTest）。
 */
export function beyondTheGatesOfSleepChaosToken(state, inv, token) {
  if (token === 'skull') {
    const hand = (inv?.hand || []).length
    const value = hardSide(state) ? hand : Math.ceil(hand / 2)
    return chaosFx(-Math.max(0, value))
  }
  if (token === 'cultist') return chaosFx(-revealedWoodCount(state))
  if (token === 'tablet') return chaosFx(-2)
  return null
}

/**
 * [tablet] 的战斗/躲避后果：对带蜂拥 X 的敌人的攻击/躲避中失败（困难/专家改为只要出现即结算），
 * 给该敌人加 1 张蜂拥卡。返回 `{ swarmingEnemyId, amount }` 或 null，由章节 behavior 执行
 * （api.swarm 在 behavior 的 runtime 上；chaos.js 不反向依赖 behavior）。
 */
export function beyondTheGatesOfSleepChaosAfterTest(state, inv, result) {
  if (!inv || !result) return null
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  if (!tokens.includes('tablet')) return null
  const source = result.source || {}
  const kind = String(source.kind || source.action || '').toLowerCase()
  const label = String(source.label || '')
  const isFightOrEvade = ['fight', 'evade'].includes(kind) || ['攻击', '躲避'].includes(label)
  if (!isFightOrEvade) return null
  if (!hardSide(state) && result.success) return null
  const enemyId = source.enemyId ?? null
  if (enemyId == null) return null
  const enemy = (state.enemies || []).find(item => String(item.id) === String(enemyId))
  if (!enemy) return null
  const spec = state.scenario?.enemies?.[original(enemy)]?.swarming || null
  if (!spec) return null
  return { swarmingEnemyId: enemy.id, amount: 1 }
}

export { byDifficulty }
