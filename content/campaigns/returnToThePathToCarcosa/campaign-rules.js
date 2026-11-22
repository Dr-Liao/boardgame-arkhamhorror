// 「重返卡尔克萨之路」八章共用的卡面规则助手（只读状态 + api，不写引擎）。
//
// 这些规则同时出现在多个章节（例如 52069 猎食的拜亚基在《真相幻影》《卡城幽影》
// 都会遭遇），因此从章节 behavior 抽到战役层，避免两份实现漂移。单卡条目的规则
// 数据仍在 `src/cards/encounter-entries/returnToThePathToCarcosa/**`，这里只做读取与结算。
import { enemyRuleFor, entryFlags } from '../../../src/cards/card-rules.js'

const original = card => card?.originalCode || card?.code
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
export const skillName = code => code

// 52069 猎食的拜亚基：与剩余神智 4 或以下的调查员交战时，交换攻击值与躲避值。
export function lowSanitySwapModifier(state, enemy, stat, inv) {
  const spec = enemyRuleFor(original(enemy))?.lowSanitySwap
  if (!spec) return 0
  const threshold = spec.threshold ?? 4
  const engaged = state.investigators.find(candidate => candidate.seat === enemy.engagedSeat)
  const target = engaged || inv
  if (!target) return 0
  const remaining = (target.maxSanity ?? target.sanity ?? 0) - (target.horror || 0)
  if (remaining > threshold) return 0
  const fight = Number(enemy.fight ?? 0)
  const evade = Number(enemy.evade ?? 0)
  if (stat === 'fight') return evade - fight
  if (stat === 'evade') return fight - evade
  return 0
}

// 52047 影中身形：检查剧本日志的疑惑/确信，移动风琴手或结算其猎手关键词。
// 返回 true 表示这次遭遇已由本函数结算（不再走默认显现流程）。
export function resolveFigureInTheShadows(state, inv, api, organistCodes) {
  const records = state.campaign?.records || {}
  const doubt = Number(records.doubt || 0)
  const conviction = Number(records.conviction || 0)
  const organist = state.enemies.find(enemy => organistCodes.includes(original(enemy)))
  if (!organist) {
    api.info?.('风琴手不在场上，影中身形没有可移动的目标。')
    return true
  }
  const investigators = active(state)
  const distance = (from, to) => {
    if (from === to) return 0
    const seen = new Set([from]), queue = [[from, 0]]
    while (queue.length) {
      const [id, steps] = queue.shift()
      const location = state.locations.find(candidate => candidate.id === id)
      for (const next of location?.connections || []) {
        if (next === to) return steps + 1
        if (!seen.has(next)) { seen.add(next); queue.push([next, steps + 1]) }
      }
    }
    return Infinity
  }
  const nearest = investigators
    .map(candidate => ({ candidate, distance: distance(organist.location, candidate.location) }))
    .sort((left, right) => left.distance - right.distance)[0]
  if (doubt >= conviction) {
    // 远离最近的调查员，尽量移动到没有调查员的地点。
    const occupied = new Set(investigators.map(candidate => candidate.location))
    const location = state.locations.find(candidate => candidate.id === organist.location)
    const candidates = (location?.connections || [])
      .filter(id => state.locations.some(item => item.id === id))
      .map(id => ({ id, hasInvestigator: occupied.has(id), distance: nearest ? distance(id, nearest.candidate.location) : 0 }))
      .sort((left, right) => Number(left.hasInvestigator) - Number(right.hasInvestigator)
        || right.distance - left.distance)
    if (candidates.length) {
      api.moveEnemy?.(organist, candidates[0].id)
      api.info?.('影中身形：风琴手朝远离调查员的方向移动 1 个地点。')
    }
    return true
  }
  // 确信更高：结算风琴手的猎手关键词（向最近调查员移动一次）。
  if (nearest) {
    const destination = api.stepToward?.(organist.location, nearest.candidate.location)
    if (destination) {
      api.moveEnemy?.(organist, destination)
      api.info?.('影中身形：风琴手结算猎手关键词，向最近的调查员移动一次。')
    }
  }
  return true
}

// 52033 誓约看守人的「当前场景编号 > 当前密谋编号时获得猎手」。
export function keeperHunterGranted(state) {
  const rule = enemyRuleFor('52033')?.conditionalHunter
  if (rule !== 'actAheadOfAgenda') return null
  return ((state.actIndex ?? 0) + 1) > ((state.agendaIndex ?? 0) + 1)
}

export { original, active, entryFlags }
