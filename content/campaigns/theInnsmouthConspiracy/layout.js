// 《印斯茅斯暗潮》桌面坐标共用工具（纯数据/排版层，不含任何规则）。
//
// 每个 `scenarios/<scenarioId>/layout.js` 只声明本章 `chapter-data.json` 真实提供的
// 设置位置（inTooDeep 的 grid、绝望深坑的 grid/adjacentInitialPositions、魔鬼礁石的
// 岛屿锚点、雾中之光的 column/row、达贡巢穴的楼层槽位、暗潮之下的随机格、全速恐惧的
// 道路顺序等）；本章其余「会按剧本放进场」的地点由 `fillFallback` 按固定蛇形补全，
// 保证注册期 `assertUiLayout` 能检查到每个已声明地点的有限 x/y。
//
// 布局不生成任何连线：TIC 地点的 `connections` 目前都是 `[]`（真实连接由各章 setup
// 与地点条目在运行时写入），`layoutFor` 只会镜像已声明的 `connections`，因此 edges 为空，
// 不会凭空创建规则连接。
import { chapterData, physicalLocationId } from './chapter-definition.js'

// 印刷物理地点 id（如 `07102:2` / `07102#1`）→ 场景内稳定 id。
export const physicalId = printed => physicalLocationId(String(printed))

// `[x, y]` 或 `{ x, y }` → 统一的有限坐标点。
export function point(value) {
  const raw = Array.isArray(value) ? value : [value?.x, value?.y]
  const target = { x: Number(raw[0]), y: Number(raw[1]) }
  return Number.isFinite(target.x) && Number.isFinite(target.y) ? target : null
}

// 把一条已声明的真实坐标写进 map（未知/非有限值直接跳过，留给 fillFallback）。
export function place(map, printed, value) {
  if (printed == null) return map
  const target = point(value)
  if (target) map[physicalId(printed)] = target
  return map
}

// 本章 chapter-data 声明的物理地点顺序（含 `:2` / `#1` 这类同卡多副本）。
export function chapterLocationIds(chapterId) {
  const spec = chapterData[chapterId]
  if (!spec) throw new RangeError(`Unknown Innsmouth chapter: ${chapterId}`)
  return spec.locations.map(location => physicalId(location.id))
}

// 确定性蛇形补全：从已声明坐标的下方开始按列填格，跳过已占用坐标。
// 同一份内容永远得到同一张桌面布局（不引入随机数，不影响重放指纹）。
export function fillFallback(map, ids, { columns = 6 } = {}) {
  const used = new Set(Object.values(map).map(item => `${item.x},${item.y}`))
  const baseY = Math.max(0, ...Object.values(map).map(item => item.y)) + 1
  let cursor = 0
  let column = 0
  for (const id of ids) {
    if (map[id]) continue
    let candidate = null
    while (!candidate) {
      const x = cursor % columns
      const y = baseY + Math.floor(cursor / columns)
      cursor += 1
      if (!used.has(`${x},${y}`)) candidate = { x, y }
    }
    column = Math.max(column, candidate.x)
    used.add(`${candidate.x},${candidate.y}`)
    map[id] = candidate
  }
  return map
}

// 桌面上已声明地点按 chapter-data 顺序编号；供各章 layout 模块统一收尾。
export function finishCoordinates(chapterId, map) {
  return fillFallback(map, chapterLocationIds(chapterId))
}
