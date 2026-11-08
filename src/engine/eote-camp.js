// 《地球边缘》场景级营地原语（P2-D `scenario.camp`）。
//
// 规则口径（参考实现 IceAndDeathPart3 / Scenarios/IceAndDeath/Helpers.hs）：
//   ·「the camp」是《亡命冰原》I–III 共用的一个地点（13 个候选地点按检查点记录选一个），
//     营地地点决定本关的「当前庇护值」（见 eote-shelter.js）、起始位置与开局线索清理；
//   · 检查点继承的「已揭示地点记录」（参考实现的 LocationsRevealed 记录）在下一部分
//     重新放置地点时用于恢复揭示状态。
//
// 状态落点（重要，已在交接中登记）：
//   P1 的 `eote-state.js#EOTE_SCENARIO_KEYS` 没有独立的 camp 槽位；而营地与庇护值在规则上
//   绑定（营地地点的印刷 Shelter 值就是当前庇护值），所以本模块把两者都放进场景级扩展的
//   `eote.shelter` 容器：`{ camp?: string, revealed?: string[] }`。
//   跨关持久（下一部分沿用哪个营地）属于战役记录层（P2-B/P2-C），本模块只记录**本关**的
//   营地与继承输入；不写 `state.campaign.eote`，也不创建 `mechanicState` 顶层新字段。
//
// 读点从不初始化容器；写点先整体校验再落笔（事务风格），非法游戏状态返回 false。
import { eoteScenarioState, assertEoteObject, assertEoteFields } from './eote-state.js'
import { locationAt } from './mechanic-state.js'

const CAMP_FIELDS = Object.freeze(['camp', 'revealed'])

// 只读取已存在的容器；缺省返回 null（旧存档/未使用本循环时不产生字段）。
function shelterState(state) {
  return eoteScenarioState(state)?.shelter ?? null
}

// 写入前取容器：已存在的坏形状直接拒绝，不静默覆盖。
function writableShelter(state) {
  const eote = eoteScenarioState(state, true)
  if (eote.shelter == null) eote.shelter = {}
  assertEoteObject(eote.shelter, 'EotE 营地状态')
  assertEoteFields(eote.shelter, [...CAMP_FIELDS], 'EotE 营地状态')
  return eote.shelter
}

function assertLocationId(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label}必须为非空地点 id`)
  return value
}

// 写入点的地点都必须真实在场，读点才不会拿到悬空 id。
function requireLocation(state, id) {
  locationAt(state, id)
  return id
}

/** 当前营地地点 id；未设置返回 null。只读、不初始化。 */
export function campLocationId(state) {
  return shelterState(state)?.camp ?? null
}

/** 当前关卡的已揭示地点记录（拷贝）；未设置返回 []。只读、不初始化。 */
export function revealedLocations(state) {
  const revealed = shelterState(state)?.revealed
  return Array.isArray(revealed) ? [...revealed] : []
}

/**
 * 设置本关营地地点。同值重复设置幂等返回 true；本关已有另一个营地时返回 false
 * （单关内营地不移动；下一关在新的 scenarioFlags 里重新设置）。
 */
export function setCampLocation(state, locationId) {
  const id = assertLocationId(locationId, '营地地点')
  requireLocation(state, id)
  const camp = campLocationId(state)
  if (camp != null) return camp === id
  writableShelter(state).camp = id
  return true
}

/** 记录一个已揭示地点（幂等）；未知地点抛 RangeError，已有记录不重复写入。 */
export function recordRevealedLocation(state, locationId) {
  const id = assertLocationId(locationId, '已揭示地点')
  requireLocation(state, id)
  const data = writableShelter(state)
  data.revealed ||= []
  if (!Array.isArray(data.revealed)) throw new TypeError('EotE 已揭示地点记录必须为数组')
  if (data.revealed.includes(id)) return false
  data.revealed.push(id)
  return true
}

/**
 * 检查点继承：把上一部分记录的已揭示地点并入本关（幂等、去重），返回新增条数。
 * 先整体校验（数组、无重复、地点都在场）再写入，任何一项失败都不产生部分写入。
 */
export function inheritRevealedLocations(state, locationIds) {
  if (!Array.isArray(locationIds)) throw new TypeError('检查点继承的已揭示地点必须为数组')
  if (new Set(locationIds).size !== locationIds.length) throw new TypeError('检查点继承的已揭示地点重复')
  for (const locationId of locationIds) requireLocation(state, assertLocationId(locationId, '已揭示地点'))
  const data = writableShelter(state)
  data.revealed ||= []
  if (!Array.isArray(data.revealed)) throw new TypeError('EotE 已揭示地点记录必须为数组')
  let added = 0
  for (const locationId of locationIds) {
    if (data.revealed.includes(locationId)) continue
    data.revealed.push(locationId)
    added++
  }
  return added
}

/** 营地快照（只读、不初始化）：`{ camp, revealed }`。 */
export function campState(state) {
  return { camp: campLocationId(state), revealed: revealedLocations(state) }
}

/**
 * 存档校验（Lead 接进 save-migration）：`value` 为 `eote.shelter` 容器。
 * 未知字段/坏形状/悬空营地立即失败；已揭示地点只校验形状与去重——检查点记录可能来自
 * 上一部分，本关尚未重新放置对应地点，因此不要求当前在场（写入点仍强制在场）。
 */
export function validateEoteCamp(state, value = shelterState(state)) {
  if (value == null) return
  assertEoteObject(value, 'EotE 营地状态')
  assertEoteFields(value, [...CAMP_FIELDS], 'EotE 营地状态')
  if (value.camp != null) {
    if (typeof value.camp !== 'string' || !value.camp) throw new TypeError('存档营地地点无效')
    if (!(state?.locations || []).some(location => location.id === value.camp)) throw new TypeError('存档营地地点不在场')
  }
  if (value.revealed != null) {
    if (!Array.isArray(value.revealed)) throw new TypeError('存档已揭示地点记录无效')
    const seen = new Set()
    for (const id of value.revealed) {
      if (typeof id !== 'string' || !id) throw new TypeError('存档已揭示地点 id 无效')
      if (seen.has(id)) throw new TypeError('存档已揭示地点重复')
      seen.add(id)
    }
  }
}
