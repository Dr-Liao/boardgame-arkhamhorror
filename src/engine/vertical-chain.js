// 纵向地点链（批次 2 原语 `location.verticalChain`）。
//
// 用途：B2《万千骇形》的 6 张「神秘阶梯」上下相连；B4《编织宇宙》的「大网」地点按层堆叠。
// 口径：位置用 `verticalIndex`（0 = 最上层），连接用既有的 `connections` 数组表达，
// **不新建循环专属布局**（路线图 §5.2 的硬要求）。
//
// 纯数据：不 import engine；未声明 verticalIndex 的战役不产生字段。

/** 地点的层号（未声明返回 null）。 */
export function verticalIndexOf(location) {
  const value = location?.verticalIndex
  return Number.isInteger(value) ? value : null
}

/** 按层号排序（未声明层号的排在最后，保持输入顺序稳定）。 */
export function orderVerticalChain(locations) {
  return [...(locations || [])]
    .map((location, index) => ({ location, index, level: verticalIndexOf(location) }))
    .sort((a, b) => {
      if (a.level == null && b.level == null) return a.index - b.index
      if (a.level == null) return 1
      if (b.level == null) return -1
      return a.level - b.level || a.index - b.index
    })
    .map(item => item.location)
}

/**
 * 注册期校验：同一链条的层号必须从 0 连续、无重复；返回 `{ ok, levels, problems }`。
 */
export function normalizeVerticalChain(locations) {
  const levels = []
  const problems = []
  for (const location of locations || []) {
    if (!location.verticalIndex && location.verticalIndex !== 0) continue
    levels.push(location.verticalIndex)
  }
  const sorted = [...levels].sort((a, b) => a - b)
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index) problems.push(`层号不连续：期望 ${index}，实际 ${sorted[index]}`)
  }
  const duplicates = levels.filter((level, index) => levels.indexOf(level) !== index)
  for (const level of [...new Set(duplicates)]) problems.push(`层号重复：${level}`)
  return { ok: problems.length === 0, levels: sorted, problems }
}

/**
 * 把有序地点 id 连成一条竖向链：设置 `verticalIndex`，并在 `connections` 里补上/下一层。
 * 返回 `{ linked, ids }`；未知 id 跳过（调用方应先用注册期校验拦）。
 */
export function linkVerticalChain(state, ids) {
  const list = (ids || []).map(id => (state?.locations || []).find(location => String(location.id) === String(id))).filter(Boolean)
  list.forEach((location, index) => {
    location.verticalIndex = index
    location.connections ||= []
    const above = list[index - 1]
    const below = list[index + 1]
    for (const neighbor of [above, below]) {
      if (!neighbor) continue
      if (!location.connections.includes(neighbor.id)) location.connections.push(neighbor.id)
    }
  })
  return { linked: list.length, ids: list.map(location => location.id) }
}

/** 上一层/下一层地点 id（没有则 null）。 */
export function chainNeighbors(state, locationId) {
  const list = orderVerticalChain(state?.locations || [])
  const index = list.findIndex(location => String(location.id) === String(locationId))
  if (index < 0) return { above: null, below: null }
  return {
    above: index > 0 ? String(list[index - 1].id) : null,
    below: index < list.length - 1 ? String(list[index + 1].id) : null,
  }
}

/** 沿链移动 delta 层（负 = 向上）；越界返回 null（不静默夹到端点）。 */
export function moveAlongChain(state, locationId, delta) {
  const list = orderVerticalChain(state?.locations || [])
  const index = list.findIndex(location => String(location.id) === String(locationId))
  const next = index + (Number(delta) || 0)
  return index >= 0 && next >= 0 && next < list.length ? String(list[next].id) : null
}

// ---------------------------------------------------------------------------
// 印刷「Level」高度层（EotE `location.vertical` 扩展）。
//
// 与 TDE 的 `verticalIndex` 分开：`verticalIndex` 是链条内部序号（0 = 最上层，
// 由 linkVerticalChain 写入）；`level` 是卡面印刷的 Level 数字（0 = 山脚，
// 数字越大越高），失落之峰的提示卡/敌人/地点按它取 X，不能用序号替代。
// 数据仍然只落在地点对象上（`location.level`），不新建循环专属布局；连接继续用
// 既有的 `connections` 表达（失落之峰的地点由内容层连成斜线）。
// ---------------------------------------------------------------------------

/** Level 字段的权威读点：接受地点对象，或 (状态, 地点 id)；未声明返回 null。 */
export function locationLevel(target, locationId = null) {
  const location = locationId == null
    ? (target && typeof target === 'object' && !Array.isArray(target.locations) ? target : null)
    : (target?.locations || []).find(item => String(item.id) === String(locationId))
  const value = location?.level
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** 写入印刷 Level（注册/布置期一次性数据）；非法参数抛错，返回写入值。 */
export function setLocationLevel(location, level) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) throw new TypeError('地点必须是对象')
  if (!Number.isSafeInteger(level) || level < 0) throw new TypeError('Level 必须是非负整数')
  location.level = level
  return level
}

/** 按 Level 升序排列（未声明 Level 的排在最后，保持输入顺序稳定）——失落之峰从山脚到山顶。 */
export function levelsOrdered(target) {
  const locations = Array.isArray(target) ? target : (target?.locations || [])
  return locations
    .map((location, index) => ({ location, index, level: locationLevel(location) }))
    .sort((a, b) => {
      if (a.level == null && b.level == null) return a.index - b.index
      if (a.level == null) return 1
      if (b.level == null) return -1
      return a.level - b.level || a.index - b.index
    })
    .map(item => item.location)
}

/**
 * 按既有 `connections` 把邻居分成上层（Level + 1）、下层（Level − 1）与同层。
 * 只读；地点不存在或没有 Level 时返回空分组（不抛错、不初始化状态）。
 * 移动合法性不在这里裁决，见 eote-climb.js 的 `climbDestinationError`。
 */
export function levelNeighbors(state, locationId) {
  const locations = state?.locations || []
  const self = locations.find(location => String(location.id) === String(locationId))
  const result = { above: [], below: [], sameLevel: [] }
  if (!self) return result
  const level = locationLevel(self)
  if (level == null) return result
  for (const toId of self.connections || []) {
    const neighbor = locations.find(location => String(location.id) === String(toId))
    const neighborLevel = locationLevel(neighbor)
    if (neighborLevel == null) continue
    if (neighborLevel === level + 1) result.above.push(String(neighbor.id))
    else if (neighborLevel === level - 1) result.below.push(String(neighbor.id))
    else if (neighborLevel === level) result.sameLevel.push(String(neighbor.id))
  }
  for (const key of ['above', 'below', 'sameLevel']) result[key].sort()
  return result
}

/** 注册/读档校验：已声明 Level 的地点必须是 0.. 的安全整数；未声明的不算错误。 */
export function validateEoteLevels(state, locations = state?.locations) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('状态必须是对象')
  if (!Array.isArray(locations)) throw new TypeError('地点列表必须是数组')
  for (const location of locations) {
    if (!location || typeof location !== 'object' || Array.isArray(location)) throw new TypeError('地点必须是对象')
    const value = location.level
    if (value == null) continue
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`地点 ${location.id ?? '?'} 的 Level 无效`)
  }
  return true
}
