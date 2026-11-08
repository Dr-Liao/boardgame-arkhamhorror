// 《地球边缘》地点庇护值原语（P2-D `location.shelter`）。
//
// 规则口径：`Shelter N` 印在《亡命冰原》的地点卡上（印刷值 0–8），当前庇护值 = 营地地点的
// 印刷庇护值；[skull] 的修正按庇护值计算（具体数值口径属于内容层，P3 规则书接线）。
//
// 庇护值是**印刷数据**，因此本模块只读不写：读取地点实例或卡牌定义上的 `shelter` 字段
// （同时兼容参考实现的 `meta.shelter` 写法），缺省按 0；`SHELTER_MAX` 是防脏数据的硬上限
// （印刷 0–8，留 1 格余量）。本模块不新增状态：营地地点记录在 eote-camp.js 的
// `eote.shelter` 容器里，`campShelter` 只是把两者拼起来。
import { eoteScenarioState, assertEoteObject } from './eote-state.js'
import { locationAt } from './mechanic-state.js'
import { campLocationId } from './eote-camp.js'

// 庇护值的合理上界：印刷值最大 8，超过即是脏数据（0..9）。
export const SHELTER_MAX = 9

// 单一读点：卡牌定义与地点实例共用同一套校验（缺省 0）。
function shelterOf(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('庇护值来源必须为对象')
  const meta = source.meta
  if (meta != null && (typeof meta !== 'object' || Array.isArray(meta))) throw new TypeError('庇护值 meta 必须为对象')
  const value = source.shelter ?? meta?.shelter
  if (value == null) return 0
  if (!Number.isSafeInteger(value)) throw new TypeError('庇护值必须为整数')
  if (value < 0 || value > SHELTER_MAX) throw new RangeError(`庇护值必须在 0..${SHELTER_MAX} 之间`)
  return value
}

/** 读取卡牌定义或地点实例上的印刷庇护值（缺省 0）。 */
export function readShelter(source) {
  return shelterOf(source)
}

/** 地点当前庇护值；未知地点抛 RangeError。 */
export function locationShelter(state, locationId) {
  return shelterOf(locationAt(state, locationId))
}

/** 营地地点的庇护值；本关没有营地时返回 null（对应参考实现的 Maybe 语义）。 */
export function campShelter(state) {
  const camp = campLocationId(state)
  return camp == null ? null : locationShelter(state, camp)
}

/**
 * 存档校验（Lead 接进 save-migration）：`value` 为 `eote.shelter` 容器。
 * 校验在场地点抄录的印刷庇护值（0..SHELTER_MAX 整数，缺省合法）；营地若已设置必须能读出
 * 庇护值（地点不在场由 eote-camp 的校验负责，这里只做庇护值读点自检）。
 */
export function validateEoteShelter(state, value = eoteScenarioState(state)?.shelter) {
  const locations = state?.locations
  if (locations != null && !Array.isArray(locations)) throw new TypeError('地点列表必须为数组')
  for (const location of locations || []) shelterOf(location)
  if (value == null) return
  assertEoteObject(value, 'EotE 庇护容器')
  if (value.camp != null) {
    if (typeof value.camp !== 'string' || !value.camp) throw new TypeError('存档营地地点无效')
    locationShelter(state, value.camp)
  }
}
