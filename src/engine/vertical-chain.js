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
