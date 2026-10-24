// 万象无终（The Circle Undone）· 混乱标记的公共取值工具（P8）。
//
// 参考实现的每章 `getChaosTokenValue` 分散在
// `Scenario/Scenarios/TheCircleUndone/<章>.hs`，四档难度按「简单/普通」与
// 「困难/专家」两组取值。TCU 的本轮实现把「每章一张表」放在各章
// `scenarios/<章>/chaos.js`（随章节走、可独立测试），本模块只提供**共享的读点与工具**：
//   · 难度分组、常见计数量（毁灭、邪教徒、幽灵敌人、Memento、胜利区）；
//   · 混乱袋增删（走引擎的 changeChaosBag，永久/临时两种口径）；
//   · 返回值形状 `{ delta, autoFail?, drawAnother?, onDraw?, onFail? }` 由 fix 统一。
//
// 内容层可以 import 引擎模块（Dunwich 的 encounter-rules.js 已 import changeChaosBag），
// 但引擎绝不反向 import 本文件。
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
import { mementoCount } from '../../../src/campaign/mementos.js'

// scenarioRuntime.resolveChaosToken 只消费这些字段：delta / autoFail / drawAnother / onDraw / onFail。
export const chaosFx = (delta, extra = {}) => ({ delta, ...extra })

export const hardSide = state => ['hard', 'expert'].includes(state?.difficulty)
export const easySide = state => !hardSide(state)

export const activeInvestigators = state =>
  (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)

export const here = (state, inv) =>
  (state?.locations || []).find(location => location.id === inv?.location) || null

export const locationById = (state, id) =>
  (state?.locations || []).find(location => location.id === id) || null

export function traitsOf(card, trait) {
  return (card?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())
}

// 场上毁灭标记总数：全局 + 地点 + 敌人 + 剧情资产 + 威胁区/支援区（[skull] 常读）。
export function doomInPlay(state) {
  const cards = [
    ...(state.locations || []),
    ...(state.enemies || []),
    ...(state.storyAssets || []),
    ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
  ]
  return (Number(state.doom) || 0) + cards.reduce((sum, card) => sum + (Number(card.doom) || 0), 0)
}

export function doomLocations(state) {
  return (state.locations || []).filter(location => (Number(location.doom) || 0) > 0)
}

export function doomOnLocations(state) {
  return doomLocations(state).reduce((sum, location) => sum + (Number(location.doom) || 0), 0)
}

export function enemiesWithTrait(state, trait) {
  return (state.enemies || []).filter(enemy => traitsOf(enemy, trait))
}

export function spectralEnemies(state) {
  return enemiesWithTrait(state, 'Spectral')
}

// 胜利区点数/张数（-X 与「每点胜利 -1」类标记）。
export function victoryPoints(state) {
  return (state.victoryDisplay || []).reduce((sum, card) => sum + (Number(card.victory) || 0), 0)
}

export function victoryCards(state) {
  return (state.victoryDisplay || []).length
}

// Memento 数量（幕间/终局按 0–2 / 3–5 / 6+ 分支）。
export function mementos(state) {
  return mementoCount(state)
}

// 裂口总数（《混沌魔掌》的 [skull] 常读「你所在地点的裂口 + 毁灭」）。
export function breaches(state) {
  return (state.locations || []).reduce((sum, location) => sum + (Number(location.breaches) || 0), 0)
}

// 混乱袋增删。permanent=true 时同时改战役袋（跨章保留），否则只改本局。
export function addChaosToken(state, token, amount = 1, { permanent = false } = {}) {
  changeChaosBag(state, token, amount, { permanent })
}

export function removeChaosToken(state, token, amount = 1, { permanent = false } = {}) {
  changeChaosBag(state, token, -amount, { permanent })
}

// 便捷：按「简单/普通 + 困难/专家」两档返回数值。章节目录里的表通常写成
// `value(state, easy, hard)`；不要按 difficulty 字符串散落 switch。
export function byDifficulty(state, easyValue, hardValue) {
  return hardSide(state) ? hardValue : easyValue
}

// 按人数缩放（「本局人数」类标记）：`perInvestigator(state, easy, hard)`。
export function perInvestigator(state, easyValue, hardValue = easyValue) {
  return (hardSide(state) ? hardValue : easyValue) * (Number(state.numInvestigators) || 1)
}

// 最近距离（BFS），用于「离你最近」类标记；不可达返回 Infinity。
export function locationDistance(state, from, to) {
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of locationById(state, id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

export function nearestEnemy(state, from, filter = () => true) {
  if (!from) return null
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id] = queue.shift()
    const candidates = (state.enemies || []).filter(enemy => enemy.location === id && filter(enemy))
    if (candidates.length) return candidates[0]
    for (const next of locationById(state, id)?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, 0])
    }
  }
  return null
}
