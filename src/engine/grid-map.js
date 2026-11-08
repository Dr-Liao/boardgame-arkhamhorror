import { mechanicState, integer, locationAt } from './mechanic-state.js'
import { eoteScenarioState } from './eote-state.js'
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

// ---------------------------------------------------------------------------
// EotE 城市景观（City Landscape）格网扩展（P2 `location.grid` / `scenario.cityVote`）。
//
// 在既有二维网格之上补「城市景观」语义，**不改动上面的既有导出与行为**：
//   · 布置/随机分配在 eote-city.js（initializeCity）里完成；本模块负责布局声明、
//     行列查询与跨格移动校验。
//   · 布局声明落在场景级可选扩展 `scenarioFlags.mechanics.eote.city.cityscape =
//     { version: 1, rows, columns, plots: [{ row, column }] }`（只由 configureCityscapes 写，
//     读点从不创建容器）。同行/同列判定用 grid 的既有坐标：`row = y`、`column = x`。
//   · 隐藏信息：`lookRow`/`lookColumn`/`revealedGrid` 是**公开投影**读点，只返回已经
//     揭示的地点，未揭示的格子整个省略（不返回占位、不返回真实名称/卡号）；
//     「查看未揭示城市景观的揭示面」（08622/08623）是私密读点，走 eote-city.js 的
//     `visibleOnRow`/`visibleOnColumn`，不得用本模块的公开读点代替。
//   · 本模块不搬动调查员：`teleportGrid`/`moveAcrossGrid` 只按传入规则校验并返回
//     transition，实际位移由权威移动管线执行（揭示、敌人跟随、进入窗口都不绕过）。
const CITYSCAPE_FIELDS = Object.freeze(['version', 'rows', 'columns', 'plots'])
const GRID_MODES = Object.freeze(['any', 'row', 'column', 'rowOrColumn'])

function requireGridState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('状态必须是对象')
  return state
}

// 坐标一律走既有 `mechanicState.grid`：`x = column`、`y = row`（与 gridLocations 一致）。
function cellOf(state, id) {
  const cell = mechanicState(state)?.grid?.[id]
  return cell ? { x: cell.x, y: cell.y, isolated: cell.isolated } : null
}

function plotKey(row, column) {
  return `${row},${column}`
}

function normalizeCityPlots({ rows, columns, layout } = {}) {
  integer(rows, 1)
  integer(columns, 1)
  let plots
  if (layout == null) {
    plots = []
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) plots.push({ row, column })
  } else {
    if (!Array.isArray(layout)) throw new TypeError('城市景观 layout 必须是数组')
    plots = layout.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('城市景观格子必须是对象')
      integer(item.row, 0)
      integer(item.column, 0)
      if (item.row >= rows || item.column >= columns) throw new TypeError('城市景观格子越界')
      return { row: item.row, column: item.column }
    })
    if (!plots.length) throw new TypeError('城市景观 layout 不能为空')
    const seen = new Set()
    for (const plot of plots) {
      const key = plotKey(plot.row, plot.column)
      if (seen.has(key)) throw new TypeError('城市景观格子重复')
      seen.add(key)
    }
  }
  return plots
}

/** 城市景观布局声明的只读入口；未配置返回 null（不创建容器）。 */
export function cityscapeConfig(state) {
  const config = eoteScenarioState(state)?.city?.cityscape
  if (!config) return null
  return {
    version: config.version,
    rows: config.rows,
    columns: config.columns,
    plots: (config.plots || []).map(plot => ({ row: plot.row, column: plot.column })),
  }
}

/**
 * 声明城市景观布局：`rows`/`columns` 是地图行列数，`layout` 是可选的格子子集
 * （缺省 = 全部 rows×columns 格）。校验在写入之前完成；同一布局重复声明幂等，
 * 换成不同布局则抛错（避免半途改地图）。城市景观「每个地点与相邻地点相连」沿用
 * 既有正交邻接默认值，不在这里改写连接；物理连接由 placeGridLocation/connectGrid 维护。
 */
export function configureCityscapes(state, spec = {}) {
  requireGridState(state)
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('城市景观布局声明必须是对象')
  const rows = spec.rows
  const columns = spec.columns
  const plots = normalizeCityPlots({ rows, columns, layout: spec.layout ?? null })
  const previous = cityscapeConfig(state)
  const next = { version: 1, rows, columns, plots }
  if (previous) {
    const same = previous.rows === next.rows && previous.columns === next.columns
      && previous.plots.length === next.plots.length
      && previous.plots.every((plot, index) => plot.row === next.plots[index].row && plot.column === next.plots[index].column)
    if (!same) throw new Error('城市景观布局已配置，不能改成不同布局')
    return previous
  }
  const data = eoteScenarioState(state, true)
  const city = data.city ||= { version: 1 }
  city.version = 1
  city.cityscape = next
  return cityscapeConfig(state)
}

/** 地点所在的城市场格；不是已配置的城市景观（无坐标/越界/不在 plots）返回 null。 */
export function cityscapeOf(state, locationId) {
  requireGridState(state)
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('地点 id 必须是非空字符串')
  const config = cityscapeConfig(state)
  if (!config) return null
  const cell = cellOf(state, locationId)
  if (!cell || cell.isolated) return null
  if (cell.x < 0 || cell.y < 0 || cell.x >= config.columns || cell.y >= config.rows) return null
  if (!config.plots.some(plot => plot.row === cell.y && plot.column === cell.x)) return null
  return { row: cell.y, column: cell.x }
}

function publicGridRecord(state, id, cell) {
  const location = (state.locations || []).find(item => String(item.id) === String(id))
  if (!location) return null
  return {
    locationId: String(location.id),
    row: cell.y,
    column: cell.x,
    code: location.code ?? null,
    name: location.name ?? null,
  }
}

function revealedGridRecords(state) {
  const cells = mechanicState(state)?.grid || {}
  const records = []
  for (const location of state.locations || []) {
    const cell = cells[location.id]
    if (!cell || cell.isolated) continue
    if (location.revealed !== true) continue
    const record = publicGridRecord(state, location.id, cell)
    if (record) records.push(record)
  }
  return records.sort((a, b) => a.row - b.row || a.column - b.column)
}

/**
 * 公开投影：当前已揭示的网格地点（含坐标）。未揭示的格子整个省略——不泄露真实
 * 名称/卡号/数量占位。该读点可以安全地发给任意观察者；私密窥视见 eote-city.js。
 */
export function revealedGrid(state) {
  requireGridState(state)
  return revealedGridRecords(state)
}

/** 公开投影：同一行已揭示的网格地点（`row = y`）；未揭示格子不返回。 */
export function lookRow(state, row) {
  requireGridState(state)
  integer(row, 0)
  return revealedGridRecords(state).filter(record => record.row === row)
}

/** 公开投影：同一列已揭示的网格地点（`column = x`）；未揭示格子不返回。 */
export function lookColumn(state, column) {
  requireGridState(state)
  integer(column, 0)
  return revealedGridRecords(state).filter(record => record.column === column)
}

function relationError(fromCell, toCell, mode) {
  if (mode === 'row' && fromCell.y !== toCell.y) return '目标与起点不同行'
  if (mode === 'column' && fromCell.x !== toCell.x) return '目标与起点不同列'
  if (mode === 'rowOrColumn' && fromCell.y !== toCell.y && fromCell.x !== toCell.x) return '目标与起点既不同行也不同列'
  return null
}

function locationExists(state, id) {
  return (state.locations || []).some(location => String(location.id) === String(id))
}

function isRevealed(state, id) {
  const location = (state.locations || []).find(item => String(item.id) === String(id))
  return location?.revealed === true
}

/**
 * 传送目的地校验：目标必须是已入场的非孤立网格地点；`fromId` 可选，提供时按
 * `mode`（any/row/column/rowOrColumn）校验关系。返回 `{ from, to, mode, row, column }`，
 * 非法游戏状态返回 false；非法参数（id 类型/mode）抛错。不搬动调查员。
 */
export function teleportGrid(state, toId, { fromId = null, mode = 'any' } = {}) {
  requireGridState(state)
  if (typeof toId !== 'string' || !toId) throw new TypeError('传送目标必须是非空地点 id')
  if (fromId != null && (typeof fromId !== 'string' || !fromId)) throw new TypeError('传送起点必须是非空地点 id')
  if (!GRID_MODES.includes(mode)) throw new TypeError('未知的传送规则')
  const toCell = cellOf(state, toId)
  if (!toCell || toCell.isolated || !locationExists(state, toId)) return false
  if (fromId == null) return { from: null, to: toId, mode, row: toCell.y, column: toCell.x }
  const fromCell = cellOf(state, fromId)
  if (!fromCell || fromCell.isolated || !locationExists(state, fromId)) return false
  if (relationError(fromCell, toCell, mode)) return false
  return { from: fromId, to: toId, mode, row: toCell.y, column: toCell.x }
}

/**
 * 「移动到同一行/列的任意地点」（08622/08623）的关系校验：两地点都必须已入场且
 * 在网格上（非孤立），默认 rowOrColumn。`requireRevealed` 为 true 时目标必须已揭示
 * （公开移动的保守变体；默认 false，因为进入未揭示地点本来就是揭示它的方式）。
 * 返回 `{ from, to, mode, row, column, sameRow, sameColumn }`；非法游戏状态返回 false。
 */
export function moveAcrossGrid(state, fromId, toId, { mode = 'rowOrColumn', requireRevealed = false } = {}) {
  requireGridState(state)
  if (typeof fromId !== 'string' || !fromId) throw new TypeError('移动起点必须是非空地点 id')
  if (typeof toId !== 'string' || !toId) throw new TypeError('移动目标必须是非空地点 id')
  if (!GRID_MODES.includes(mode)) throw new TypeError('未知的行列移动规则')
  if (fromId === toId) return false
  const fromCell = cellOf(state, fromId)
  const toCell = cellOf(state, toId)
  if (!fromCell || !toCell || fromCell.isolated || toCell.isolated) return false
  if (!locationExists(state, fromId) || !locationExists(state, toId)) return false
  if (requireRevealed && !isRevealed(state, toId)) return false
  if (relationError(fromCell, toCell, mode)) return false
  return {
    from: fromId, to: toId, mode,
    row: toCell.y, column: toCell.x,
    sameRow: fromCell.y === toCell.y, sameColumn: fromCell.x === toCell.x,
  }
}

/** 读档校验：城市景观布局声明（坐标范围、格子重复、字段集合、版本）。 */
export function validateEoteCityscape(state, value = cityscapeConfig(state)) {
  requireGridState(state)
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('城市景观布局必须是对象')
  for (const key of Object.keys(value)) if (!CITYSCAPE_FIELDS.includes(key)) throw new TypeError(`城市景观布局未知字段 ${key}`)
  if (value.version !== 1) throw new TypeError('不支持的城市景观布局版本')
  if (!Number.isSafeInteger(value.rows) || value.rows < 1) throw new TypeError('城市景观布局 rows 无效')
  if (!Number.isSafeInteger(value.columns) || value.columns < 1) throw new TypeError('城市景观布局 columns 无效')
  if (!Array.isArray(value.plots) || !value.plots.length) throw new TypeError('城市景观布局 plots 无效')
  const seen = new Set()
  for (const plot of value.plots) {
    if (!plot || typeof plot !== 'object' || Array.isArray(plot)) throw new TypeError('城市景观格子必须是对象')
    for (const key of Object.keys(plot)) if (!['row', 'column'].includes(key)) throw new TypeError(`城市景观格子未知字段 ${key}`)
    if (!Number.isSafeInteger(plot.row) || plot.row < 0 || plot.row >= value.rows) throw new TypeError('城市景观格子行越界')
    if (!Number.isSafeInteger(plot.column) || plot.column < 0 || plot.column >= value.columns) throw new TypeError('城市景观格子列越界')
    const key = plotKey(plot.row, plot.column)
    if (seen.has(key)) throw new TypeError('城市景观格子重复')
    seen.add(key)
  }
  return true
}
