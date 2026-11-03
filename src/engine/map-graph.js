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
export function roadDistance(locations, from, to) { const path = shortestPaths(locations, from, to)[0]; return path ? path.length - 1 : Infinity }
export function initializeRoad(state, { deck, detours = [], columns }) {
  if (!Array.isArray(deck) || !Array.isArray(detours) || !columns || typeof columns !== 'object') throw new TypeError('无效道路牌库声明')
  for (const [id, column] of Object.entries(columns)) { locationAt(state, id); integer(column) }
  if (new Set([...deck, ...detours]).size !== deck.length + detours.length) throw new TypeError('道路物理卡重复')
  const data = mechanicState(state, true)
  if (data.road) throw new Error('道路已初始化')
  data.road = { deck: [...deck], detours: [...detours], columns: { ...columns } }
}
export function extendRoad(state, from, count, place) {
  integer(count); locationAt(state, from)
  const road = mechanicState(state)?.road, column = road?.columns?.[from]
  if (column == null || Object.values(road.columns).some(value => value > column) || !road.deck.length || !count) return []
  if (typeof place !== 'function') throw new TypeError('道路扩展需要地点放置入口')
  const detours = Math.min(count - 1, road.detours.length)
  const next = [road.deck.at(-1), ...road.detours.slice(road.detours.length - detours)]
  for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(randomValue(state) * (i + 1)); [next[i], next[j]] = [next[j], next[i]] }
  const placed = next.map(code => place(code))
  if (placed.some(id => !id || Object.hasOwn(road.columns, id))) throw new Error('道路放置未返回新的地点 id')
  for (const id of placed) { locationAt(state, id); road.columns[id] = column + 1 }
  road.deck.pop(); road.detours.splice(road.detours.length - (next.length - 1), next.length - 1)
  for (const [id, x] of Object.entries(road.columns)) {
    locationAt(state, id).connections = Object.entries(road.columns).filter(([other, y]) => other !== id && Math.abs(y - x) === 1).map(([other]) => other)
  }
  return placed
}
