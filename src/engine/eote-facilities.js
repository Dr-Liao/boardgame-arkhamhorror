// 《疯狂之心》古代设施与迷雾高塔原语（P2-D `scenario.facility` / `scenario.sealTowers`）。
//
// 规则口径（参考实现 Location/CardDefs/EdgeOfTheEarth/TheHeartOfMadness.hs、
// Scenarios/TheHeartOfMadness/Pylon.hs 与 Act 08673「Collapse the Pylons」）：
//   · 15 座「古代设施」是地点（`kind` 由内容层给出，例如 'ancientFacility'）：可被激活
//     （激活者/使用记录）与摧毁；数量与 id 都是内容数据，本模块不写死任何卡号；
//   · 5 座「迷雾高塔」（Mist-Pylon）也是地点，但可以「视为敌人」攻击：战斗值 = 隐蔽值，
//     生命值 = 该地点的线索值；伤害打满后「坍塌」（collapsed），坍塌后仍留在场上、
//     免疫后续伤害；
//   · 激活后的封印可以被放到高塔上。封印的身份/激活/控制权属于战役封印原语（P2-B
//     `src/campaign/eote-seals.js`），本模块只保存**不透明**的 sealId，不 import 封印模块；
//     单塔最多一枚封印、同一枚封印不能同时放在两座塔上。
//
// 状态落点（P1 eote-state.js 已声明的场景级字段）：
//   `eote.facilities = {
//      facilities: { <locationId>: { kind, activated, activatedBy?, destroyed } },
//      towers: { <locationId>: { towerIndex, mistPylon, health?, damage, collapsed } } }`
//   `eote.towerSeals = { <towerId>: <sealId> }`（首次放置才创建，避免空容器进存档）
// 设施/高塔的 id 都是 state.locations 里的地点 id；建局时校验在场，读档时不要求仍在场
// （《疯狂之心》终幕会把地点移出游戏，记录允许悬空）。
//
// 读点不初始化容器；写点先整体校验再落笔，非法游戏状态返回 false（不产生部分写入）。
import { eoteScenarioState, assertEoteObject, assertEoteFields } from './eote-state.js'
import { investigatorAt, integer, locationAt } from './mechanic-state.js'

const FORBIDDEN_IDS = Object.freeze(['__proto__', 'constructor', 'prototype'])
const FACILITY_FIELDS = Object.freeze(['kind', 'activated', 'destroyed', 'activatedBy'])
const TOWER_FIELDS = Object.freeze(['towerIndex', 'mistPylon', 'health', 'damage', 'collapsed'])
const TOWER_SPEC_FIELDS = Object.freeze(['id', 'towerIndex', 'mistPylon', 'health'])

function assertId(value, label) {
  if (typeof value !== 'string' || !value || value.length > 128 || /\s/.test(value) || FORBIDDEN_IDS.includes(value)) {
    throw new TypeError(`${label}必须为非空 id`)
  }
  return value
}

function facilityData(state) {
  return eoteScenarioState(state)?.facilities ?? null
}

function towerSealData(state) {
  return eoteScenarioState(state)?.towerSeals ?? null
}

// 已登记记录（容器不存在返回 null；容器存在但 id 未登记抛 RangeError，避免拼错被静默吞掉）。
function registeredFacility(state, id) {
  const facilityId = assertId(id, '设施 id')
  const data = facilityData(state)
  if (!data) return null
  const record = data.facilities?.[facilityId]
  if (!record) throw new RangeError(`无效设施 ${facilityId}`)
  return record
}

function registeredTower(state, id) {
  const towerId = assertId(id, '高塔 id')
  const data = facilityData(state)
  if (!data) return null
  const record = data.towers?.[towerId]
  if (!record) throw new RangeError(`无效高塔 ${towerId}`)
  return record
}

// 高塔生命：内容可显式给 `health`；否则按规则取「线索值」——优先地点实例的 clueValue
// （内容层可按情势覆盖），其次印刷线索值 maxClues，最后当前 clues；都没有按 0。
function towerHealthOf(state, id, record) {
  if (record.health != null) return record.health
  const location = (state?.locations || []).find(item => item.id === id)
  for (const value of [location?.clueValue, location?.maxClues, location?.clues]) {
    if (Number.isSafeInteger(value) && value >= 0) return value
  }
  return 0
}

/**
 * 建局：注册 15 座设施与 5 座高塔（数量/编号由内容传入）。
 * `spec = { facilities: [{ id, kind }], towers: [{ id, towerIndex, mistPylon, health? }] }`
 * 校验顺序：整体形状 → 逐条字段 → id/编号唯一 → 地点在场 → 未重复初始化，之后才写状态。
 */
export function initializeFacilities(state, spec) {
  assertEoteObject(spec, '设施声明')
  assertEoteFields(spec, ['facilities', 'towers'], '设施声明')
  if (!Array.isArray(spec.facilities) || !Array.isArray(spec.towers)) {
    throw new TypeError('设施声明必须同时提供 facilities 与 towers 数组')
  }
  const seen = new Set()
  const facilities = {}
  for (const item of spec.facilities) {
    assertEoteObject(item, '设施条目')
    assertEoteFields(item, ['id', 'kind'], '设施条目')
    const id = assertId(item.id, '设施 id')
    if (seen.has(id)) throw new TypeError(`设施/高塔 id 重复：${id}`)
    seen.add(id)
    if (typeof item.kind !== 'string' || !item.kind) throw new TypeError('设施 kind 必须为非空字符串')
    locationAt(state, id) // 设施是场地地点：id 必须来自 state.locations
    facilities[id] = { kind: item.kind, activated: false, destroyed: false }
  }
  const indexes = new Set()
  const towers = {}
  for (const item of spec.towers) {
    assertEoteObject(item, '高塔条目')
    assertEoteFields(item, [...TOWER_SPEC_FIELDS], '高塔条目')
    const id = assertId(item.id, '高塔 id')
    if (seen.has(id)) throw new TypeError(`设施/高塔 id 重复：${id}`)
    seen.add(id)
    if (!Number.isSafeInteger(item.towerIndex) || item.towerIndex < 0) {
      throw new TypeError('高塔 towerIndex 必须为非负整数')
    }
    if (indexes.has(item.towerIndex)) throw new TypeError(`高塔 towerIndex 重复：${item.towerIndex}`)
    indexes.add(item.towerIndex)
    if (typeof item.mistPylon !== 'boolean') throw new TypeError('高塔 mistPylon 必须为布尔值')
    if (item.health != null && (!Number.isSafeInteger(item.health) || item.health < 1)) {
      throw new TypeError('高塔 health 必须为正整数')
    }
    locationAt(state, id) // 高塔是场地地点：id 必须来自 state.locations
    towers[id] = { towerIndex: item.towerIndex, mistPylon: item.mistPylon, damage: 0, collapsed: false,
      ...(item.health != null ? { health: item.health } : {}) }
  }
  const eote = eoteScenarioState(state) // 读，不创建
  if (eote?.facilities != null) throw new Error('设施已初始化，不能重复创建')
  if (eote?.towerSeals != null) throw new Error('高塔封印状态缺少设施初始化，不能创建')
  eoteScenarioState(state, true).facilities = { facilities, towers }
  return { facilities: Object.keys(facilities).length, towers: Object.keys(towers).length }
}

/** 设施快照：`{ id, kind, activated, activatedBy, destroyed }`；未初始化返回 null。 */
export function facilityState(state, id) {
  const facilityId = assertId(id, '设施 id')
  const record = registeredFacility(state, facilityId)
  if (!record) return null
  return {
    id: facilityId,
    kind: record.kind,
    activated: record.activated === true,
    activatedBy: record.activatedBy ?? null,
    destroyed: record.destroyed === true,
  }
}

/** 高塔当前生命值；未初始化返回 null。 */
export function towerHealth(state, id) {
  const towerId = assertId(id, '高塔 id')
  const record = registeredTower(state, towerId)
  if (!record) return null
  return towerHealthOf(state, towerId, record)
}

/** 高塔快照（含派生的生命/剩余生命与封印）：`{ id, towerIndex, mistPylon, health, damage, remaining, collapsed, sealId }`。 */
export function towerState(state, id) {
  const towerId = assertId(id, '高塔 id')
  const record = registeredTower(state, towerId)
  if (!record) return null
  const health = towerHealthOf(state, towerId, record)
  const sealId = towerSealData(state)?.[towerId] ?? null
  return {
    id: towerId,
    towerIndex: record.towerIndex,
    mistPylon: record.mistPylon === true,
    health,
    damage: record.damage,
    remaining: Math.max(0, health - record.damage),
    collapsed: record.collapsed === true,
    sealId,
  }
}

/**
 * 攻击高塔：`spec = { towerId, amount, source? }`。
 * 伤害夹取到线索值生命；打满标记坍塌并返回结算结果；已坍塌/未初始化返回 false（不写入）。
 */
export function damageTower(state, spec) {
  assertEoteObject(spec, '高塔伤害声明')
  assertEoteFields(spec, ['towerId', 'amount', 'source'], '高塔伤害声明')
  const towerId = assertId(spec.towerId, '高塔 id')
  integer(spec.amount, 1)
  if (spec.source != null && (typeof spec.source !== 'string' || !spec.source)) {
    throw new TypeError('高塔伤害来源必须为非空字符串')
  }
  const record = registeredTower(state, towerId)
  if (!record) return false
  if (record.collapsed) return false
  const health = towerHealthOf(state, towerId, record)
  const damage = Math.min(health, record.damage + spec.amount)
  record.damage = damage
  record.collapsed = damage >= health
  return {
    towerId,
    damage,
    remaining: Math.max(0, health - damage),
    collapsed: record.collapsed,
    source: spec.source ?? null,
  }
}

/** 激活设施（记录激活者座位）；已激活/已摧毁/未初始化返回 false。 */
export function activateFacility(state, id, options = {}) {
  const facilityId = assertId(id, '设施 id')
  assertEoteObject(options, '设施激活选项')
  assertEoteFields(options, ['by'], '设施激活选项')
  const record = registeredFacility(state, facilityId)
  if (!record) return false
  if (options.by != null) investigatorAt(state, options.by)
  if (record.activated || record.destroyed) return false
  record.activated = true
  if (options.by != null) record.activatedBy = options.by
  return true
}

/** 摧毁设施；已摧毁/未初始化返回 false。激活记录保留（历史），但之后不能再激活。 */
export function destroyFacility(state, id) {
  const facilityId = assertId(id, '设施 id')
  const record = registeredFacility(state, facilityId)
  if (!record) return false
  if (record.destroyed) return false
  record.destroyed = true
  return true
}

/** 已坍塌高塔 id 列表（按 towerIndex 排序）；未初始化返回 []。 */
export function collapsedTowers(state) {
  const data = facilityData(state)
  if (!data?.towers) return []
  return Object.entries(data.towers)
    .filter(([, tower]) => tower.collapsed === true)
    .sort((a, b) => a[1].towerIndex - b[1].towerIndex)
    .map(([id]) => id)
}

/** 高塔封印列表 `[{ towerId, sealId, towerIndex }]`，按塔编号排序；封印 id 对引擎不透明。 */
export function towerSeals(state) {
  const eote = eoteScenarioState(state)
  const seals = eote?.towerSeals
  if (!seals) return []
  const towers = eote?.facilities?.towers || {}
  return Object.entries(seals).map(([towerId, sealId]) => {
    const tower = towers[towerId]
    if (!tower) throw new Error(`高塔封印状态不一致：${towerId}`)
    return { towerId, sealId, towerIndex: tower.towerIndex }
  }).sort((a, b) => a.towerIndex - b.towerIndex || (a.towerId < b.towerId ? -1 : a.towerId > b.towerId ? 1 : 0))
}

/**
 * 把一枚（已激活的）封印放到高塔上：`spec = { towerId, sealId }`。
 * 单塔已有封印、该封印已在别的高塔、塔未登记/未初始化时返回 false。
 * 封印激活/控制权由战役封印原语判定；坍塌的高塔仍在场上，允许放置。
 */
export function placeTowerSeal(state, spec) {
  assertEoteObject(spec, '高塔封印声明')
  assertEoteFields(spec, ['towerId', 'sealId'], '高塔封印声明')
  const towerId = assertId(spec.towerId, '高塔 id')
  if (typeof spec.sealId !== 'string' || !spec.sealId) throw new TypeError('封印 id 必须为非空字符串')
  const record = registeredTower(state, towerId)
  if (!record) return false
  const eote = eoteScenarioState(state)
  const seals = eote.towerSeals || {}
  if (seals[towerId]) return false
  if (Object.values(seals).includes(spec.sealId)) return false
  eote.towerSeals ||= {}
  eote.towerSeals[towerId] = spec.sealId
  return true
}

/**
 * 从高塔回收封印：`spec = { towerId, sealId? }`。没有封印、封印对不上、未初始化返回 false。
 * 塔上最后一枚封印被回收时删掉空容器，避免空对象进存档。
 */
export function removeTowerSeal(state, spec) {
  assertEoteObject(spec, '高塔封印移除声明')
  assertEoteFields(spec, ['towerId', 'sealId'], '高塔封印移除声明')
  const towerId = assertId(spec.towerId, '高塔 id')
  if (spec.sealId != null && (typeof spec.sealId !== 'string' || !spec.sealId)) {
    throw new TypeError('封印 id 必须为非空字符串')
  }
  const record = registeredTower(state, towerId)
  if (!record) return false
  const eote = eoteScenarioState(state)
  const seals = eote.towerSeals
  if (!seals?.[towerId]) return false
  if (spec.sealId != null && seals[towerId] !== spec.sealId) return false
  delete seals[towerId]
  if (!Object.keys(seals).length) delete eote.towerSeals
  return true
}

// 读档：设施/高塔 id 允许已移出游戏（《疯狂之心》终幕会移出地点），只校验形状与相互引用。
function validateFacilityRecords(value) {
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('存档设施记录无效')
}

/**
 * 存档校验（Lead 接进 save-migration）：`value` 为 `eote.facilities` 容器，
 * 同时校验同一模块负责的 `eote.towerSeals`。未知字段/坏形状/重复编号/悬空封印立即失败。
 */
export function validateEoteFacilities(state, value = eoteScenarioState(state)?.facilities) {
  const seals = towerSealData(state)
  if (value == null) {
    if (seals != null) throw new TypeError('存档高塔封印缺少设施数据')
    return
  }
  assertEoteObject(value, 'EotE 设施状态')
  assertEoteFields(value, ['facilities', 'towers'], 'EotE 设施状态')
  validateFacilityRecords(value.facilities)
  validateFacilityRecords(value.towers)

  for (const [id, record] of Object.entries(value.facilities)) {
    assertId(id, '存档设施 id')
    assertEoteObject(record, '存档设施记录')
    assertEoteFields(record, [...FACILITY_FIELDS], '存档设施记录')
    if (typeof record.kind !== 'string' || !record.kind) throw new TypeError('存档设施 kind 无效')
    if (typeof record.activated !== 'boolean' || typeof record.destroyed !== 'boolean') {
      throw new TypeError('存档设施状态无效')
    }
    if (record.activatedBy != null) {
      if (!Number.isSafeInteger(record.activatedBy) || !state?.investigators?.[record.activatedBy]) {
        throw new TypeError('存档设施激活者座位无效')
      }
      if (record.activated !== true) throw new TypeError('存档设施激活者记录与状态不一致')
    }
  }

  const indexes = new Set()
  for (const [id, record] of Object.entries(value.towers)) {
    assertId(id, '存档高塔 id')
    if (value.facilities[id]) throw new TypeError('存档设施与高塔 id 重复')
    assertEoteObject(record, '存档高塔记录')
    assertEoteFields(record, [...TOWER_FIELDS], '存档高塔记录')
    if (!Number.isSafeInteger(record.towerIndex) || record.towerIndex < 0) throw new TypeError('存档高塔编号无效')
    if (indexes.has(record.towerIndex)) throw new TypeError('存档高塔编号重复')
    indexes.add(record.towerIndex)
    if (typeof record.mistPylon !== 'boolean' || typeof record.collapsed !== 'boolean') {
      throw new TypeError('存档高塔状态无效')
    }
    if (!Number.isSafeInteger(record.damage) || record.damage < 0) throw new TypeError('存档高塔伤害无效')
    if (record.health != null) {
      if (!Number.isSafeInteger(record.health) || record.health < 1) throw new TypeError('存档高塔生命无效')
      if (record.damage > record.health) throw new TypeError('存档高塔伤害超过生命')
      if (record.collapsed !== (record.damage >= record.health)) throw new TypeError('存档高塔坍塌标记与伤害不一致')
    }
  }

  if (seals == null) return
  if (typeof seals !== 'object' || Array.isArray(seals)) throw new TypeError('存档高塔封印记录无效')
  const used = new Set()
  for (const [towerId, sealId] of Object.entries(seals)) {
    if (!value.towers[towerId]) throw new TypeError(`存档高塔封印指向未登记高塔 ${towerId}`)
    if (typeof sealId !== 'string' || !sealId) throw new TypeError('存档高塔封印 id 无效')
    if (used.has(sealId)) throw new TypeError('存档高塔封印重复')
    used.add(sealId)
  }
}
