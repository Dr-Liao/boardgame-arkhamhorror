// 七循环《地球边缘》第三章《古老者之城》的城市场景原语（P2 `scenario.cityVote`）。
//
// 数据口径：
//   · 场景级状态 `scenarioFlags.mechanics.eote.city = { version: 1, cityscapes, keys }`：
//       - `cityscapes`: `[{ row, column, locationId }]`，十六张 City Landscape 随机放进
//         地图格后的分配结果（按 row、column 升序）；
//       - `keys`: `{ "<locationId>": "<keyId>" }`，每个城市场格上的钥匙（钥匙 = 卡面/标记
//         id，由参数传入；本模块不引用任何卡号）。
//     `city.cityscape`（行列范围与格子子集）由 grid-map.js#configureCityscapes 写，
//     `initializeCity` 会按分配结果补建，或复用调用方先声明好的布局。
//   · 隐藏信息：分配结果（哪一格是哪张地点）是未揭示时的隐藏信息。`cityscapes` 是
//     受信任读点，不得下发观察者；公开投影只走 `visibleOnRow`/`visibleOnColumn` 的
//     seat 缺省模式（只返回已揭示的地点），私密窥视（08622/08623「查看同行/同列
//     City Landscape 的揭示面」）传 `{ seat }`，返回值只能发给该座位。
//   · 随机性：放置与钥匙都按「先洗牌再分配」执行；洗牌默认走 `randomValue(state)`，
//     可用 `deps.shuffle` 注入确定性回调（可重放/测试）。所有校验都在写入之前完成。
//   · 物理地点放置复用 grid-map.js#placeGridLocation；没有该入口时由调用方的
//     `deps.placeLocation` 负责把地点条目放进 `state.locations`。
import { mechanicState, integer, investigatorAt } from './mechanic-state.js'
import { randomValue } from './rules-state.js'
import { eoteScenarioState } from './eote-state.js'
import {
  cityscapeConfig, configureCityscapes, placeGridLocation, connectGrid, validateEoteCityscape,
} from './grid-map.js'

export const EOTE_CITY_VERSION = 1
const CITY_FIELDS = Object.freeze(['version', 'cityscape', 'cityscapes', 'keys'])
const CITYSCAPE_FIELDS = Object.freeze(['row', 'column', 'locationId'])

function requireState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('状态必须是对象')
  return state
}

function locationOf(state, id) {
  return (state.locations || []).find(location => String(location.id) === String(id)) || null
}

// 与 scenario-decks.js 同口径的注入洗牌校验：必须保留同一组元素，否则不写状态。
function validateShuffled(original, result, label) {
  if (!Array.isArray(result) || result.length !== original.length) throw new TypeError(`${label} 洗牌回调必须返回同一数量`)
  if (result.some(item => typeof item !== 'string' || !item)) throw new TypeError(`${label} 洗牌回调必须返回字符串`)
  const left = [...original].sort()
  const right = [...result].sort()
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) throw new TypeError(`${label} 洗牌回调不得增删或改写元素`)
  return result
}

function shuffleWith(state, shuffle, cards) {
  const fn = typeof shuffle === 'function' ? shuffle : null
  if (fn) return validateShuffled([...cards], fn([...cards]), '城市')
  const list = [...cards]
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomValue(state) * (index + 1))
    ;[list[index], list[target]] = [list[target], list[index]]
  }
  return list
}

function sortedCityscapes(cityscapes) {
  return [...cityscapes].sort((a, b) => a.row - b.row || a.column - b.column)
}

/** 城市景观分配结果的受信任只读入口；未初始化返回 null（不创建容器）。 */
export function cityscapes(state) {
  const city = eoteScenarioState(state)?.city
  if (!city?.cityscapes) return null
  return sortedCityscapes(city.cityscapes).map(item => ({ ...item }))
}

/**
 * 初始化城市：`cityscapes: [{ row, column, locationIds }]` 是地图格与候选地点池，
 * 洗牌后每个格随机分配一个尚未使用的候选地点；`keys` 是可选的钥匙 id 列表，
 * 洗牌后按格序随机放到各城市景观上。返回分配/钥匙结果与放置数；非法游戏状态
 * （候选不足、地点不可放置、格子被占）返回 false 且不写状态。
 */
export function initializeCity(state, spec = {}, deps = {}) {
  requireState(state)
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('城市初始化声明必须是对象')
  if (deps == null || typeof deps !== 'object' || Array.isArray(deps)) throw new TypeError('城市初始化依赖必须是对象')
  if (deps.shuffle != null && typeof deps.shuffle !== 'function') throw new TypeError('shuffle 必须是函数')
  if (deps.placeLocation != null && typeof deps.placeLocation !== 'function') throw new TypeError('placeLocation 必须是函数')
  if (eoteScenarioState(state)?.city?.cityscapes) throw new Error('城市景观已经初始化')
  if (!Array.isArray(spec.cityscapes) || !spec.cityscapes.length) throw new TypeError('cityscapes 必须是非空数组')
  if (spec.keys != null && !Array.isArray(spec.keys)) throw new TypeError('keys 必须是数组')

  const slots = spec.cityscapes.map(slot => {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) throw new TypeError('城市景观格必须是对象')
    integer(slot.row, 0)
    integer(slot.column, 0)
    if (!Array.isArray(slot.locationIds) || !slot.locationIds.length) throw new TypeError('城市景观格必须提供候选地点')
    if (slot.locationIds.some(id => typeof id !== 'string' || !id)) throw new TypeError('候选地点必须是非空字符串 id')
    const unique = [...new Set(slot.locationIds)]
    if (unique.length !== slot.locationIds.length) throw new TypeError('同一格内的候选地点不能重复')
    return { row: slot.row, column: slot.column, locationIds: unique }
  })
  const coordinateKeys = new Set()
  for (const slot of slots) {
    const key = `${slot.row},${slot.column}`
    if (coordinateKeys.has(key)) throw new TypeError('城市景观格重复')
    coordinateKeys.add(key)
  }
  const ordered = sortedCityscapes(slots)

  // 先算纯分配结果（不写状态）：每格洗牌后取第一个未被占用的候选。
  const used = new Set()
  const assignment = []
  for (const slot of ordered) {
    const pool = shuffleWith(state, deps.shuffle, slot.locationIds)
    const picked = pool.find(id => !used.has(id))
    if (!picked) return false
    used.add(picked)
    assignment.push({ row: slot.row, column: slot.column, locationId: picked })
  }

  const rawKeys = spec.keys ?? []
  if (rawKeys.some(key => typeof key !== 'string' || !key)) throw new TypeError('keys 必须是非空字符串 id')
  if (new Set(rawKeys).size !== rawKeys.length) throw new TypeError('keys 不能重复')
  if (rawKeys.length > assignment.length) return false

  const existing = new Set((state.locations || []).map(location => String(location.id)))
  for (const item of assignment) {
    if (!existing.has(String(item.locationId)) && typeof deps.placeLocation !== 'function') return false
  }
  const cells = mechanicState(state)?.grid || {}
  const occupied = new Set(Object.values(cells).filter(cell => !cell.isolated).map(cell => `${cell.y},${cell.x}`))
  for (const item of assignment) if (occupied.has(`${item.row},${item.column}`)) return false
  const previousConfig = cityscapeConfig(state)
  if (previousConfig) {
    const plots = new Set(previousConfig.plots.map(plot => `${plot.row},${plot.column}`))
    for (const item of assignment) {
      if (item.row >= previousConfig.rows || item.column >= previousConfig.columns) return false
      if (!plots.has(`${item.row},${item.column}`)) return false
    }
  }

  // 以下开始写状态：先声明布局，再放地点，最后写分配与钥匙。
  const maxRow = Math.max(...assignment.map(item => item.row))
  const maxColumn = Math.max(...assignment.map(item => item.column))
  if (!previousConfig) {
    configureCityscapes(state, {
      rows: maxRow + 1,
      columns: maxColumn + 1,
      layout: assignment.map(item => ({ row: item.row, column: item.column })),
    })
  }
  for (const item of assignment) {
    const placed = placeGridLocation(state, item.locationId, item.column, item.row, { placeLocation: deps.placeLocation }, { isolated: false })
    if (!placed) throw new Error('城市景观放置失败')
  }
  connectGrid(state)

  const data = eoteScenarioState(state, true)
  const city = data.city ||= { version: EOTE_CITY_VERSION }
  city.version = EOTE_CITY_VERSION
  city.cityscapes = assignment.map(item => ({ ...item }))
  city.keys = {}
  if (rawKeys.length) {
    const shuffledKeys = shuffleWith(state, deps.shuffle, rawKeys)
    for (let index = 0; index < assignment.length; index += 1) {
      if (index >= shuffledKeys.length) break
      city.keys[assignment[index].locationId] = shuffledKeys[index]
    }
  }
  return { cityscapes: cityscapes(state), keys: { ...city.keys }, placed: assignment.length }
}

function cityEntryAt(city, locationId) {
  return (city?.cityscapes || []).find(item => String(item.locationId) === String(locationId)) || null
}

function visibleRecords(state, entries, seat) {
  const records = []
  for (const entry of sortedCityscapes(entries)) {
    const location = locationOf(state, entry.locationId)
    if (!location) continue
    const revealed = location.revealed === true
    if (seat == null && !revealed) continue
    records.push({
      locationId: String(location.id),
      row: entry.row,
      column: entry.column,
      revealed,
      hidden: !revealed,
      peek: seat != null && !revealed,
      name: revealed ? (location.name ?? null) : (location.unrevealedActualName ?? location.name ?? null),
      code: revealed ? (location.code ?? null) : (location.originalCode ?? location.code ?? null),
    })
  }
  return records
}

/**
 * 同行可见城市景观：
 *   · 不传 `seat`：公开投影，只返回已揭示地点（未揭示的整个省略，不泄露身份/数量占位）。
 *   · 传 `seat`（08622/08623 的私密窥视）：额外返回未揭示地点的**揭示面身份**，
 *     `peek: true`；调用方只能把这条结果发给该座位，不得进入全桌日志/快照。
 */
export function visibleOnRow(state, row, { seat = null } = {}) {
  requireState(state)
  integer(row, 0)
  if (seat != null) investigatorAt(state, seat)
  const city = eoteScenarioState(state)?.city
  if (!city?.cityscapes) return []
  return visibleRecords(state, city.cityscapes.filter(item => item.row === row), seat)
}

/** 同列可见城市景观；隐私口径与 visibleOnRow 相同。 */
export function visibleOnColumn(state, column, { seat = null } = {}) {
  requireState(state)
  integer(column, 0)
  if (seat != null) investigatorAt(state, seat)
  const city = eoteScenarioState(state)?.city
  if (!city?.cityscapes) return []
  return visibleRecords(state, city.cityscapes.filter(item => item.column === column), seat)
}

/** 某地点上的钥匙 id（只读）；没有返回 null。 */
export function keyOnLocation(state, locationId) {
  requireState(state)
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('地点 id 必须是非空字符串')
  const keys = eoteScenarioState(state)?.city?.keys
  if (!keys || !Object.hasOwn(keys, locationId)) return null
  const key = keys[locationId]
  return typeof key === 'string' && key ? key : null
}

function requireCityKeys(state) {
  const city = eoteScenarioState(state)?.city
  if (!city?.cityscapes) return null
  return city.keys ||= {}
}

function assertKeyedCityLocation(state, locationId) {
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('地点 id 必须是非空字符串')
  const city = eoteScenarioState(state)?.city
  if (!city?.cityscapes) return false
  return Boolean(cityEntryAt(city, locationId))
}

/** 把钥匙放到城市景观地点（该地点必须已有分配且当前无钥匙、钥匙 id 未被占用）。 */
export function placeKey(state, locationId, keyId) {
  requireState(state)
  if (typeof keyId !== 'string' || !keyId) throw new TypeError('钥匙 id 必须是非空字符串')
  if (!assertKeyedCityLocation(state, locationId)) return false
  const keys = requireCityKeys(state)
  if (!keys) return false
  if (Object.hasOwn(keys, locationId)) return false
  if (Object.values(keys).includes(keyId)) return false
  keys[locationId] = keyId
  return keyId
}

/** 取走某地点上的钥匙并返回其 id；没有返回 null。 */
export function takeKey(state, locationId) {
  requireState(state)
  const city = eoteScenarioState(state)?.city
  if (!city?.keys) return null
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('地点 id 必须是非空字符串')
  if (!Object.hasOwn(city.keys, locationId)) return null
  const key = city.keys[locationId]
  delete city.keys[locationId]
  return key ?? null
}

/** 在同一行的两个城市景观之间搬一把钥匙（08638 独眼尖塔）；返回记录或 false。 */
export function moveKey(state, fromId, toId) {
  requireState(state)
  if (!assertKeyedCityLocation(state, fromId)) return false
  if (!assertKeyedCityLocation(state, toId)) return false
  if (fromId === toId) return false
  const keys = requireCityKeys(state)
  if (!keys || !Object.hasOwn(keys, fromId) || Object.hasOwn(keys, toId)) return false
  const key = keys[fromId]
  delete keys[fromId]
  keys[toId] = key
  return { keyId: key, from: fromId, to: toId }
}

/** 交换两个城市景观上的钥匙（08640 古老者神殿）；两边都必须有钥匙。 */
export function swapKeys(state, firstId, secondId) {
  requireState(state)
  if (!assertKeyedCityLocation(state, firstId)) return false
  if (!assertKeyedCityLocation(state, secondId)) return false
  if (firstId === secondId) return false
  const keys = requireCityKeys(state)
  if (!keys || !Object.hasOwn(keys, firstId) || !Object.hasOwn(keys, secondId)) return false
  const first = keys[firstId]
  const second = keys[secondId]
  keys[firstId] = second
  keys[secondId] = first
  return { [firstId]: second, [secondId]: first }
}

/** 读档校验：城市分配、布局与钥匙簿记的形状/引用/一致性。 */
export function validateEoteCity(state, value = eoteScenarioState(state)?.city) {
  requireState(state)
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('城市状态必须是对象')
  for (const key of Object.keys(value)) if (!CITY_FIELDS.includes(key)) throw new TypeError(`城市状态未知字段 ${key}`)
  if (value.version !== EOTE_CITY_VERSION) throw new TypeError('不支持的城市状态版本')
  if (value.cityscape != null) validateEoteCityscape(state, value.cityscape)
  const cityscapesValue = value.cityscapes
  if (cityscapesValue == null) {
    if (value.keys != null) throw new TypeError('城市钥匙记录缺少城市景观分配')
    return true
  }
  if (!Array.isArray(cityscapesValue) || !cityscapesValue.length) throw new TypeError('城市景观分配必须是非空数组')
  const config = cityscapeConfig(state)
  const seenCoordinates = new Set()
  const seenLocations = new Set()
  for (const item of cityscapesValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('城市景观分配项必须是对象')
    for (const key of Object.keys(item)) if (!CITYSCAPE_FIELDS.includes(key)) throw new TypeError(`城市景观分配项未知字段 ${key}`)
    if (!Number.isSafeInteger(item.row) || item.row < 0) throw new TypeError('城市景观分配行无效')
    if (!Number.isSafeInteger(item.column) || item.column < 0) throw new TypeError('城市景观分配列无效')
    if (typeof item.locationId !== 'string' || !item.locationId) throw new TypeError('城市景观分配地点无效')
    const coordinate = `${item.row},${item.column}`
    if (seenCoordinates.has(coordinate)) throw new TypeError('城市景观分配坐标重复')
    seenCoordinates.add(coordinate)
    if (seenLocations.has(item.locationId)) throw new TypeError('城市景观分配地点重复')
    seenLocations.add(item.locationId)
    if (state.locations && !locationOf(state, item.locationId)) throw new TypeError('城市景观分配地点不在场')
    if (config) {
      if (item.row >= config.rows || item.column >= config.columns) throw new TypeError('城市景观分配越界')
      if (!config.plots.some(plot => plot.row === item.row && plot.column === item.column)) throw new TypeError('城市景观分配不在布局格子内')
    }
  }
  if (value.keys != null) {
    if (typeof value.keys !== 'object' || Array.isArray(value.keys)) throw new TypeError('城市钥匙记录必须是对象')
    const seenKeys = new Set()
    for (const [locationId, keyId] of Object.entries(value.keys)) {
      if (!seenLocations.has(locationId)) throw new TypeError('城市钥匙挂在非城市景观地点')
      if (typeof keyId !== 'string' || !keyId) throw new TypeError('城市钥匙 id 无效')
      if (seenKeys.has(keyId)) throw new TypeError('城市钥匙 id 重复')
      seenKeys.add(keyId)
    }
  }
  return true
}
