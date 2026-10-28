// 剧本参考卡计数（P3 批次 3 原语 `scenario.markerCount`）。
//
// A2《千面之梦》的「神迹」：往剧本参考卡上放标记，X = 标记数（同时被蜂拥敌的
// `scenarioDamage` 口径引用）。B3 也有类似的参考卡计数。这里做成通用的「命名计数」，
// 不把「神迹」写死成唯一用途。
//
// 口径：食梦者迁移路线 §5.2 `scenario.markerCount`；账本 batch P3-3。
// 状态形状：`state.markerCounts = { [id]: number }`；只读函数不建字段。

export const REFERENCE_MARKER_ID = 'reference'

function markers(state) {
  state.markerCounts ||= {}
  return state.markerCounts
}

function readMarkers(state) {
  return state && typeof state === 'object' && state.markerCounts ? state.markerCounts : {}
}

/** 某个命名计数的当前值（默认 0）。 */
export function markerCountOf(state, id = REFERENCE_MARKER_ID) {
  const value = readMarkers(state)[id]
  return Number.isInteger(value) && value > 0 ? value : 0
}

/** 设置计数（0 下限；返回新值）。 */
export function setMarkerCount(state, id, value) {
  const next = Math.max(0, Math.trunc(Number(value) || 0))
  markers(state)[id] = next
  return next
}

/** 加/减计数（默认 +1，0 下限；返回新值）。 */
export function addMarker(state, id, delta = 1) {
  const next = Math.max(0, markerCountOf(state, id) + Math.trunc(Number(delta) || 0))
  markers(state)[id] = next
  return next
}

/** 剧本参考卡计数（A2 神迹 / B3 的 X 值）。 */
export function referenceMarkerCount(state) {
  return markerCountOf(state, REFERENCE_MARKER_ID)
}

/** 清空（新一章/新一局）；返回旧值。 */
export function resetMarkerCount(state, id = REFERENCE_MARKER_ID) {
  const previous = markerCountOf(state, id)
  if (state.markerCounts) delete state.markerCounts[id]
  return previous
}

/** 所有命名计数（观察投影用；不暴露内部对象）。 */
export function markerSummary(state) {
  return Object.entries(readMarkers(state)).map(([id, value]) => ({ id, count: Number(value) || 0 }))
}
