import { mechanicState, locationAt } from './mechanic-state.js'
function coordinate(x, y) { if (![x, y].every(Number.isSafeInteger)) throw new TypeError('Grid coordinates must be integers') }
export function gridPosition(state, id) { const cell = mechanicState(state)?.grid?.[id]; return cell ? { x: cell.x, y: cell.y, isolated: cell.isolated } : null }
export function gridLocations(state, { row = null, column = null, includeIsolated = false } = {}) {
  const cells = mechanicState(state)?.grid || {}
  return state.locations.filter(loc => cells[loc.id] && (includeIsolated || !cells[loc.id].isolated)
    && (row == null || cells[loc.id].y === row) && (column == null || cells[loc.id].x === column))
}
export function connectGrid(state) {
  const cells = mechanicState(state)?.grid || {}
  const policy = mechanicState(state)?.gridAdjacency || 'orthogonal'
  for (const loc of state.locations) {
    const cell = cells[loc.id]
    if (!cell) continue
    const adjacent = !cell.isolated ? state.locations.filter(other => {
      const target = cells[other.id]
      if (!target || target.isolated || other.id === loc.id) return false
      if (policy === 'row') return cell.y === target.y
      if (policy === 'columns') return Math.abs(cell.x - target.x) === 1
      return policy === 'orthogonal' && Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y) === 1
    }).map(other => other.id) : []
    const traitLinks = (state.locationTraitLinks?.added || []).filter(([from]) => from === loc.id).map(([, to]) => to)
    loc.connections = [...new Set([...traitLinks, ...(cell.connections || []), ...(loc.symbolLinks || []), ...adjacent])].filter(id => state.locations.some(other => other.id === id))
  }
}
export function configureGrid(state, { adjacency = 'orthogonal' } = {}) {
  if (!['orthogonal', 'row', 'columns', 'none'].includes(adjacency)) throw new TypeError('Invalid grid adjacency')
  mechanicState(state, true).gridAdjacency = adjacency
  connectGrid(state)
}
export function placeGridLocation(state, id, x, y, { placeLocation }, { isolated = false, connections = [] } = {}) {
  coordinate(x, y)
  if (typeof isolated !== 'boolean' || !Array.isArray(connections) || connections.some(id => typeof id !== 'string')) throw new TypeError('Invalid grid placement')
  const data = mechanicState(state, true); data.grid ||= {}
  if (!isolated && Object.entries(data.grid).some(([other, cell]) => other !== id && !cell.isolated && cell.x === x && cell.y === y)) return false
  if (!state.locations.some(loc => loc.id === id)) {
    if (typeof placeLocation !== 'function') throw new Error('Grid placement needs the actual location entry pipeline')
    const placed = placeLocation(id)
    if (!placed || !state.locations.some(loc => loc.id === id)) return false
  }
  const loc = locationAt(state, id)
  data.grid[id] = { x, y, isolated, connections: [...connections] }
  loc.grid = { x, y }
  connectGrid(state)
  return id
}
export function connectGridPair(state, a, b, { bidirectional = true } = {}) {
  const left = locationAt(state, a), right = locationAt(state, b)
  const cells = mechanicState(state)?.grid
  left.connections = [...new Set([...(left.connections || []), b])]
  if (cells?.[a]) cells[a].connections = [...new Set([...cells[a].connections, b])]
  if (bidirectional) {
    right.connections = [...new Set([...(right.connections || []), a])]
    if (cells?.[b]) cells[b].connections = [...new Set([...cells[b].connections, a])]
  }
  return true
}
export function expandGridFrom(state, id, template, deckId, deps) {
  const origin = gridPosition(state, id)
  if (!origin || origin.isolated || !Array.isArray(template)) return []
  for (const item of template) { coordinate(item.x, item.y); if (!item.x && !item.y) throw new TypeError('Expansion needs an offset') }
  const occupied = () => new Set(Object.values(mechanicState(state).grid).filter(cell => !cell.isolated).map(cell => `${cell.x},${cell.y}`))
  const placed = []
  for (const offset of template) {
    const x = origin.x + offset.x, y = origin.y + offset.y
    if (occupied().has(`${x},${y}`) || !deps.deck.size(deckId)) continue
    const [next] = deps.deck.take(deckId)
    const result = placeGridLocation(state, next, x, y, deps)
    if (!result) throw new Error('Grid expansion failed after taking the physical card')
    placed.push(result)
  }
  return placed
}
