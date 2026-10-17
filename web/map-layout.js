// Map geometry is presentation data. Rules connections always come from the
// current projected locations, so moving a card never changes legal moves.
export const MAP_CARD_WIDTH = 104
export const MAP_CARD_HEIGHT = 146
const STEP_X = 214
const STEP_Y = 212
const PAD = 55

function autoGrid(locations) {
  const ids = locations.map(loc => loc.id)
  const adjacency = new Map(ids.map(id => [id, new Set()]))
  for (const loc of locations) for (const id of loc.connections || []) {
    if (!adjacency.has(id)) continue
    adjacency.get(loc.id).add(id)
    adjacency.get(id).add(loc.id)
  }
  const depths = new Map()
  for (const root of ids) {
    if (depths.has(root)) continue
    depths.set(root, depths.size ? Math.max(...depths.values()) + 2 : 0)
    const queue = [root]
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index]
      for (const next of [...adjacency.get(id)].sort()) {
        if (depths.has(next)) continue
        depths.set(next, depths.get(id) + 1)
        queue.push(next)
      }
    }
  }
  const groups = new Map()
  for (const id of ids) {
    const depth = depths.get(id)
    if (!groups.has(depth)) groups.set(depth, [])
    groups.get(depth).push(id)
  }
  const grid = {}
  const maxRows = Math.max(1, ...[...groups.values()].map(group => group.length))
  for (const [depth, group] of groups) {
    group.sort()
    group.forEach((id, row) => { grid[id] = { x: depth, y: row - (group.length - 1) / 2 + maxRows / 2 } })
  }
  return grid
}

export function mapGeometry(locations, layout = null, overrides = {}) {
  if (!locations.length) return { positions: {}, edges: [], width: 1, height: 1 }
  const provided = layout?.locations || {}
  const grid = autoGrid(locations)
  const known = locations.filter(loc => Number.isFinite(provided[loc.id]?.x) && Number.isFinite(provided[loc.id]?.y))
  const minX = known.length ? Math.min(...known.map(loc => provided[loc.id].x)) : 0
  const minY = known.length ? Math.min(...known.map(loc => provided[loc.id].y)) : 0
  const maxX = known.length ? Math.max(...known.map(loc => provided[loc.id].x)) : -1
  const positions = {}
  for (const loc of locations) {
    const point = provided[loc.id]
    const gridPoint = grid[loc.id]
    const x = Number.isFinite(point?.x) ? point.x - minX : maxX + 1 + gridPoint.x
    const y = Number.isFinite(point?.y) ? point.y - minY : gridPoint.y
    positions[loc.id] = overrides[loc.id] ? { ...overrides[loc.id] } : { x: PAD + x * STEP_X, y: PAD + y * STEP_Y }
  }
  // Shifting the entire scene keeps negative coordinates and local drags in view.
  const shiftX = Math.max(0, PAD - Math.min(...Object.values(positions).map(point => point.x)))
  const shiftY = Math.max(0, PAD - Math.min(...Object.values(positions).map(point => point.y)))
  for (const point of Object.values(positions)) {
    point.x += shiftX
    point.y += shiftY
  }
  const byId = new Map(locations.map(loc => [loc.id, loc]))
  const seen = new Set()
  const edges = []
  for (const loc of locations) for (const target of loc.connections || []) {
    if (!byId.has(target)) continue
    const key = [loc.id, target].sort().join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ from: loc.id, to: target, bidirectional: (byId.get(target).connections || []).includes(loc.id) })
  }
  return {
    positions, edges,
    width: Math.max(...Object.values(positions).map(point => point.x)) + MAP_CARD_WIDTH + PAD,
    height: Math.max(...Object.values(positions).map(point => point.y)) + MAP_CARD_HEIGHT + PAD,
  }
}

// A visual route hint over existing directed rule connections. The engine
// still decides the hunter's actual movement and exposes the resulting state.
export function hunterRouteEdges(locations, enemies, investigators) {
  const byId = new Map(locations.map(loc => [loc.id, loc]))
  const goals = new Set(investigators.filter(inv => !inv.defeated && !inv.resigned).map(inv => inv.location))
  const highlighted = new Set()
  for (const enemy of enemies) {
    if (!enemy.hunter || !byId.has(enemy.location) || goals.has(enemy.location)) continue
    const queue = [enemy.location]
    const parent = new Map([[enemy.location, null]])
    let reached = null
    for (let index = 0; index < queue.length && !reached; index++) {
      const id = queue[index]
      for (const next of byId.get(id).connections || []) {
        if (!byId.has(next) || parent.has(next)) continue
        parent.set(next, id)
        queue.push(next)
        if (goals.has(next)) { reached = next; break }
      }
    }
    for (let id = reached; id && parent.get(id); id = parent.get(id)) {
      highlighted.add([id, parent.get(id)].sort().join('\u0000'))
    }
  }
  return highlighted
}
