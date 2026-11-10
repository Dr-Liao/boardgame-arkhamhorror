import { randomValue } from './rules-state.js'
import { mechanicState, integer, locationAt } from './mechanic-state.js'
// Graph queries and generic column-deck extension; placement uses the domain API.
export function shortestPaths(locations, from, to, canEnter = () => true) {
  const byId = new Map(locations.map(loc => [loc.id, loc]))
  if (!byId.has(from) || !byId.has(to)) return []
  let queue = [[from]], result = [], length = Infinity
  const distances = new Map([[from, 1]])
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const path = queue[cursor], last = path.at(-1)
    if (path.length > length) break
    if (last === to) { length = path.length; result.push(path); continue }
    for (const next of byId.get(last).connections || []) {
      if (byId.has(next) && !path.includes(next) && canEnter(next) && path.length + 1 <= (distances.get(next) ?? Infinity)) {
        distances.set(next, path.length + 1); queue.push([...path, next])
      }
    }
  }
  return result
}
export function orthogonalNeighbors(cells, cell) {
  if (![cell?.x, cell?.y].every(Number.isSafeInteger)) throw new TypeError('地图坐标必须为整数')
  return cells.filter(other => Math.abs(other.x - cell.x) + Math.abs(other.y - cell.y) === 1)
}
// 八循环 P2（世界地图）：0-1 加权最短距离。节点进入代价由 `enterCost(node)` 给出（绿地 0、普通 1），
// 用 deque（按代价排序）保证「先扩展低代价」——不同于 shortestPaths 的逐跳口径。
// 不可达返回 null；from/to 不存在抛 RangeError（不做静默 Infinity）。
export function weightedDistance(nodes, from, to, enterCost = () => 1) {
  if (!Array.isArray(nodes)) throw new TypeError('加权距离需要节点数组')
  if (typeof enterCost !== 'function') throw new TypeError('enterCost 必须是函数')
  const byId = new Map(nodes.map(node => [node?.id, node]))
  if (!byId.has(from)) throw new RangeError(`未知加权距离起点 ${JSON.stringify(from)}`)
  if (!byId.has(to)) throw new RangeError(`未知加权距离终点 ${JSON.stringify(to)}`)
  const distances = new Map([...byId.keys()].map(id => [id, Infinity]))
  distances.set(from, 0)
  const queue = [[from, 0]]
  while (queue.length) {
    queue.sort((left, right) => left[1] - right[1])
    const [current, cost] = queue.shift()
    if (cost > distances.get(current)) continue
    if (current === to) return cost
    for (const next of byId.get(current).connections || []) {
      if (!byId.has(next)) continue
      const weight = enterCost(byId.get(next))
      if (!Number.isFinite(weight) || weight < 0) throw new TypeError('加权距离的进入代价必须是非负有限数')
      const nextCost = cost + weight
      if (nextCost < distances.get(next)) {
        distances.set(next, nextCost)
        queue.push([next, nextCost])
      }
    }
  }
  return Number.isFinite(distances.get(to)) ? distances.get(to) : null
}
export function roadDistance(locations, from, to) { const path = shortestPaths(locations, from, to)[0]; return path ? path.length - 1 : Infinity }
export function initializeRoad(state, { deck, detours = [], columns }) {
  if (!Array.isArray(deck) || !Array.isArray(detours) || !columns || typeof columns !== 'object') throw new TypeError('无效道路牌库声明')
  for (const [id, column] of Object.entries(columns)) { locationAt(state, id); integer(column) }
  if (new Set([...deck, ...detours]).size !== deck.length + detours.length) throw new TypeError('道路物理卡重复')
  const data = mechanicState(state, true)
  if (data.road) throw new Error('道路已初始化')
  data.road = { deck: [...deck], detours: [...detours], columns: { ...columns } }
}
// 道路列的横向连接唯一同步点：同一列的地点互不连接，只连接相邻列（07204–07210 的「道路 N」）。
// 遍历时**只处理仍在场的地点**：轮末清理 / 幕背面布置会移除地点，残留的列号不能变成
// 「无效地点」异常（审计 H4：清理后再扩路曾整个事务回滚）。
function syncRoadConnections(state, road) {
  const inPlay = new Map((state.locations || []).map(location => [location.id, location]))
  for (const [id, x] of Object.entries(road.columns)) {
    const location = inPlay.get(id)
    if (!location) continue
    location.connections = Object.entries(road.columns)
      .filter(([other, y]) => other !== id && Math.abs(y - x) === 1 && inPlay.has(other))
      .map(([other]) => other)
  }
}
// 清掉不在场的道路列号（防御性：地点可能从其它路径离场，例如履历/存档迁移）。
function pruneRoadColumns(state, road) {
  const inPlay = new Set((state.locations || []).map(location => location.id))
  let changed = false
  for (const id of Object.keys(road.columns)) if (!inPlay.has(id)) { delete road.columns[id]; changed = true }
  return changed
}
// 地点离场（移出游戏 / 进胜利区后不再在场）时同步清掉它的道路列号。
// 读点：locations.js#removeLocation。返回是否真的清掉了一列。
export function forgetRoadLocation(state, id) {
  const road = mechanicState(state)?.road
  if (!road?.columns) return false
  const removed = Object.hasOwn(road.columns, id)
  if (removed) delete road.columns[id]
  const pruned = pruneRoadColumns(state, road)
  if (removed || pruned) syncRoadConnections(state, road)
  return removed
}
export function extendRoad(state, from, count, place) {
  integer(count); locationAt(state, from)
  const road = mechanicState(state)?.road
  if (!road?.columns) return []
  // 清理悬空列号后再判断「是不是最前方」：否则被移出场地的列号会永远拦住扩路（审计 H4）。
  pruneRoadColumns(state, road)
  const column = road.columns[from]
  if (column == null || Object.values(road.columns).some(value => value > column)
    || !road.deck.length || !count) return []
  if (typeof place !== 'function') throw new TypeError('道路扩展需要地点放置入口')
  const detours = Math.min(count - 1, road.detours.length)
  const next = [road.deck.at(-1), ...road.detours.slice(road.detours.length - detours)]
  for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(randomValue(state) * (i + 1)); [next[i], next[j]] = [next[j], next[i]] }
  const placed = next.map(code => place(code))
  if (placed.some(id => !id || Object.hasOwn(road.columns, id))) throw new Error('道路放置未返回新的地点 id')
  for (const id of placed) { locationAt(state, id); road.columns[id] = column + 1 }
  road.deck.pop(); road.detours.splice(road.detours.length - (next.length - 1), next.length - 1)
  syncRoadConnections(state, road)
  return placed
}
