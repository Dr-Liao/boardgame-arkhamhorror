// 《黑色王座》· 二维宇宙网格（Cosmos）纯数据模型（内容层，无引擎依赖）。
//
// 参考实现：
//   Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone/Cosmos.hs（二维网格/方向/空位）
//   + Cosmos/Types.hs（EmptySpace 携带一张玩家卡）
//   + Act/Cards/.../TheCosmosBeckons.hs、InAzathothsDomain.hs（场景 2/3 的固定摆盘位置）
//   + Location/Cards/.../DancersMist.hs、FlightIntoOblivion.hs、InfinityOfDarkness.hs、
//     CosmicGate.hs、PathwayIntoVoid.hs（「宇宙 -」放置指令的候选格位算法）
//
// 状态形状（纯 JSON，存在 state.scenarioFlags.cosmos）：
//   flags.cosmos = {
//     cells: { 'x,y': { kind: 'location', id } | { kind: 'empty', cardCode, ownerSeat } },
//     posOf: { [locationId]: 'x,y' },
//     scene: 'scene1' | 'scene2' | 'scene3' | null,
//   }
// 未出现在 cells 里的格位 = 宇宙中尚未放置任何东西的空格（参考实现里的 Nothing）。
// 虚空格子（'empty'）会携带一张玩家卡（参考 EmptySpace 的 Card）；当某个地点移动/放置到该
// 格子时，那张卡洗回其所有者牌库。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const keyOf = (x, y) => `${x},${y}`

export const DIRECTIONS = Object.freeze({
  up: Object.freeze([0, 1]),
  down: Object.freeze([0, -1]),
  left: Object.freeze([-1, 0]),
  right: Object.freeze([1, 0]),
})
export const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' })
export const ALL_DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right'])

export const parseKey = key => {
  const [x, y] = String(key).split(',').map(Number)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

export function gridOf(state) {
  const flags = (state.scenarioFlags ||= {})
  flags.cosmos ||= { cells: {}, posOf: {}, scene: null }
  const grid = flags.cosmos
  grid.cells ||= {}
  grid.posOf ||= {}
  return grid
}

export function positionOf(state, locationId) {
  const grid = gridOf(state)
  const key = grid.posOf[String(locationId)]
  return key ? parseKey(key) : null
}

export function cellAt(state, x, y) {
  const grid = gridOf(state)
  return grid.cells[keyOf(x, y)] || null
}

export function cellAtPosition(state, position) {
  return position ? cellAt(state, position.x, position.y) : null
}

export function locationIdAt(state, x, y) {
  const cell = cellAt(state, x, y)
  return cell?.kind === 'location' ? cell.id : null
}

export function isLocationCell(cell) {
  return cell?.kind === 'location'
}

export function isEmptySpaceCell(cell) {
  return cell?.kind === 'empty'
}

// 可放置/可移动进入的格位：没有 location 的格位（未占用，或虚空格子）。
export function isOpenCell(cell) {
  return !cell || cell.kind !== 'location'
}

export function setRoundTripCell(state, x, y, cell) {
  const grid = gridOf(state)
  const key = keyOf(x, y)
  if (cell) grid.cells[key] = cell
  else delete grid.cells[key]
}

export function setLocationPosition(state, locationId, x, y) {
  const grid = gridOf(state)
  const id = String(locationId)
  const old = grid.posOf[id]
  if (old) {
    const parsed = parseKey(old)
    const oldCell = parsed ? grid.cells[keyOf(parsed.x, parsed.y)] : null
    if (oldCell && oldCell.kind === 'location' && String(oldCell.id) === id) delete grid.cells[old]
  }
  const existing = grid.cells[keyOf(x, y)]
  delete grid.posOf[id]
  grid.posOf[id] = keyOf(x, y)
  grid.cells[keyOf(x, y)] = { kind: 'location', id }
  return existing
}

export function setEmptySpace(state, x, y, { cardCode = null, ownerSeat = null } = {}) {
  const grid = gridOf(state)
  grid.cells[keyOf(x, y)] = { kind: 'empty', cardCode: cardCode == null ? null : String(cardCode),
    ownerSeat: ownerSeat == null ? null : Number(ownerSeat) }
}

// 移除一个已放置地点：清 cells/posOf，返回被清掉的格位信息。
export function removeLocationFromGrid(state, locationId) {
  const grid = gridOf(state)
  const id = String(locationId)
  const key = grid.posOf[id]
  if (!key) return null
  const parsed = parseKey(key)
  const cell = parsed ? grid.cells[key] : null
  if (cell && cell.kind === 'location' && String(cell.id) === id) delete grid.cells[key]
  delete grid.posOf[id]
  return { x: parsed?.x, y: parsed?.y, cell }
}

// 四邻接里已放置的地点 id（不含自己）。
export function adjacentLocationIds(state, locationId) {
  const position = positionOf(state, locationId)
  if (!position) return []
  const out = []
  for (const direction of ALL_DIRECTIONS) {
    const [dx, dy] = DIRECTIONS[direction]
    const id = locationIdAt(state, position.x + dx, position.y + dy)
    if (id && String(id) !== String(locationId)) out.push(id)
  }
  return out
}

// 重新计算所有宇宙地点的 connections：每个地点与它四邻接的每个地点互相连接。
// 只改宇宙网格内已放置地点之间的连接；不碰枢纽/地点自己的印刷/手动连接（它们也在网格里）。
export function refreshConnections(state) {
  const grid = gridOf(state)
  const placed = Object.entries(grid.posOf)
    .map(([id, key]) => ({ id, position: parseKey(key) }))
    .filter(entry => entry.position)
  const byLocation = new Map()
  for (const entry of placed) {
    const location = (state.locations || []).find(candidate => String(candidate.id) === String(entry.id))
    if (location) byLocation.set(String(entry.id), location)
  }
  for (const [id, location] of byLocation) {
    location.connections = adjacentLocationIds(state, id)
      .filter(target => byLocation.has(String(target)))
  }
  return [...byLocation.keys()]
}

export function placedGridIds(state) {
  return Object.keys(gridOf(state).posOf)
}

// 从某位置出发、指定方向上的「可放置」格位：没有 location 的格位（未占用/虚空格）。
export function openPositionsInDirections(state, position, directions = ALL_DIRECTIONS) {
  if (!position) return []
  const out = []
  for (const direction of directions) {
    const [dx, dy] = DIRECTIONS[direction]
    const x = position.x + dx
    const y = position.y + dy
    if (isOpenCell(cellAt(state, x, y))) out.push({ x, y, direction })
  }
  return out
}

// 参考 getEmptySpacePositionsInDirections：只取虚空格子（EmptySpace）格位。
export function emptySpacePositionsInDirections(state, position, directions = ALL_DIRECTIONS) {
  if (!position) return []
  const out = []
  for (const direction of directions) {
    const [dx, dy] = DIRECTIONS[direction]
    const x = position.x + dx
    const y = position.y + dy
    if (isEmptySpaceCell(cellAt(state, x, y))) out.push({ x, y, direction })
  }
  return out
}

export function revealedLocationIds(state) {
  return (state.locations || [])
    .filter(location => location.revealed)
    .map(location => String(location.id))
    .filter(id => positionOf(state, id))
}

// 参考 topmostRevealedLocationPositions：y 最大的已揭示地点位置（可能有多个）。
export function topmostRevealedPositions(state) {
  const positions = revealedLocationIds(state)
    .map(id => positionOf(state, id))
    .filter(Boolean)
  if (!positions.length) return []
  const top = Math.max(...positions.map(position => position.y))
  return positions.filter(position => position.y === top)
}

// 参考 bottommostRevealedLocationPositions：y 最小的已揭示地点位置。
export function bottommostRevealedPositions(state) {
  const positions = revealedLocationIds(state)
    .map(id => positionOf(state, id))
    .filter(Boolean)
  if (!positions.length) return []
  const bottom = Math.min(...positions.map(position => position.y))
  return positions.filter(position => position.y === bottom)
}

// 参考 CosmicGate.hs：任意一个已揭示地点的任意方向上的空格位。
export function openPositionsAroundRevealed(state) {
  const out = []
  const seen = new Set()
  for (const position of revealedLocationIds(state).map(id => positionOf(state, id)).filter(Boolean)) {
    for (const candidate of openPositionsInDirections(state, position)) {
      const key = keyOf(candidate.x, candidate.y)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(candidate)
    }
  }
  return out
}

// 把一张玩家卡洗回其所有者牌库（虚空格子的卡在重建/被覆盖时回牌库）。
export function returnEmptySpaceCard(state, cell) {
  if (!cell || cell.kind !== 'empty' || !cell.cardCode) return false
  const owner = Number.isInteger(cell.ownerSeat) ? state.investigators?.[cell.ownerSeat] : null
  if (!owner) return false
  owner.deck ||= []
  owner.deck.push(String(cell.cardCode))
  return true
}

// 取出某位调查员牌库顶 count 张卡（不洗牌，按引擎一致的「牌库顶 = 数组尾」）。
export function takeDeckCards(inv, count) {
  const taken = []
  if (!inv) return taken
  inv.deck ||= []
  for (let index = 0; index < count && inv.deck.length; index++) taken.push(inv.deck.pop())
  return taken
}

export function cardNameOf(cardCode) {
  return ALL_CARDS[cardCode]?.nameZh || ALL_CARDS[cardCode]?.name || String(cardCode)
}

export function gridPositionKey(x, y) {
  return keyOf(x, y)
}
