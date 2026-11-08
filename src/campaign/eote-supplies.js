// 《地球边缘》（EotE）战役级原语 D：探险物资（Supplies）控制/携带/掉落/回收记录。
//
// 规则来源：参考卡表 7 件 Expedition 物资（Uses supplies/charges/ammo，随攀登携带；
// 失败时掉落在所在地点；结局按「Supplies Recovered」战役记录统计）与参考实现
// `Campaigns/EdgeOfTheEarth/Supplies.hs`（7 项补给枚举）以及 `Helpers.hs` 的
// `hasSupply` / `recoverSupply`（写入 `SuppliesRecovered` 记录集合）。
//
// 本模块只做**战役记录原语**：「Uses (N supplies)」资产本身的次数消耗由卡牌/uses 层（P7）
// 负责，这里只跟踪物资由谁控制、丢在哪里、是否回收。
//
// 状态位置：`state.campaign.eote.supplies`（可选扩展 v1）。形状：
//   campaign.eote.supplies = {
//     items: [{ code, label }],                 // 内容层（P7）传入 7 项物资定义
//     recoveredKey: 'SuppliesRecovered',        // 回收记录的战役记录键（可配置）
//     carriers?: { '<seat>': ['<code>', ...] }, // 控制者
//     dropped?: { '<code>': '<locationId>' },   // 掉落地点
//   }
//   · 「已回收」唯一权威是战役记录集合 campaign.records[recoveredKey]（复用 record-sets.js）；
//   · missingSupplies = 尚未回收的物资（与 recoveredSupplies 互补）；
//   · 写入前完成全部校验；失败返回 false 且不留部分写入；读点从不创建容器。
import { eoteCampaignState, assertEoteObject, assertEoteFields } from '../engine/eote-state.js'
import { recordSetAdd, recordSetValues } from './record-sets.js'

// 参考实现的战役记录键；内容层可覆盖，但默认值保证 P1 目录口径一致。
export const SUPPLIES_RECOVERED_KEY = 'SuppliesRecovered'
const RECORD_KEY_PATTERN = /^[a-zA-Z][\w-]*$/
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const INIT_ITEM_FIELDS = Object.freeze(['code', 'label'])
const STORED_ITEM_FIELDS = Object.freeze(['code', 'label'])

function campaignOf(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('探险物资记录需要对局状态或战役状态')
  return source.campaign && typeof source.campaign === 'object' ? source.campaign : source
}

function eoteOf(source, create = false) {
  const campaign = campaignOf(source)
  if (!create) return campaign.eote || null
  const eote = eoteCampaignState(source.campaign ? source : { campaign }, true)
  return assertEoteObject(eote, '战役 EotE 扩展')
}

function suppliesData(source, create = false) {
  const eote = eoteOf(source, create)
  if (!eote) return null
  if (!create) return eote.supplies || null
  eote.supplies ||= { items: [] }
  return eote.supplies
}

function requireSuppliesData(state) {
  const data = suppliesData(state)
  if (!data) throw new TypeError('探险物资尚未初始化，不能读写物资记录')
  return data
}

function supplyCode(value, label = '物资卡号') {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new TypeError(`${label} 必须是合法标识`)
  return value
}

function requireItem(data, code) {
  supplyCode(code)
  const item = data.items.find(entry => entry.code === code)
  if (!item) throw new RangeError(`未知的探险物资 ${code}`)
  return item
}

// 座位引用：优先运行时调查员数组，其次战役记录；两者都不可用时只校验整数。
function seatExists(state, seat) {
  const investigators = state?.investigators
  if (Array.isArray(investigators) && investigators.length) {
    return investigators.some(inv => inv && inv.seat === seat) ? 'ok' : 'missing'
  }
  const records = state?.campaign?.investigators
  if (records && typeof records === 'object' && Object.keys(records).length) {
    return Object.hasOwn(records, seat) || Object.hasOwn(records, String(seat)) ? 'ok' : 'missing'
  }
  return 'unknown'
}

function requireSeat(state, seat) {
  if (!Number.isSafeInteger(seat) || seat < 0) throw new RangeError('无效调查员座位')
  if (seatExists(state, seat) === 'missing') throw new RangeError(`不存在座位 ${seat} 的调查员`)
  return seat
}

function locationExists(state, locationId) {
  const locations = state?.locations
  if (!Array.isArray(locations)) return 'unknown'
  if (!locations.length) return 'unknown'
  return locations.some(location => location && location.id === locationId) ? 'ok' : 'missing'
}

function requireLocation(state, locationId) {
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('物资掉落地点必须为非空字符串')
  if (!Array.isArray(state?.locations)) throw new TypeError('运行时状态缺少地点列表，无法校验物资掉落地点')
  if (locationExists(state, locationId) === 'missing') throw new RangeError(`不存在地点 ${locationId}`)
  return locationId
}

// 把物资从所有控制者手里移除；清空后删除空记录，保持存档最小。
function removeCarrier(data, code) {
  if (!data.carriers) return false
  let removed = false
  for (const [key, list] of Object.entries(data.carriers)) {
    const index = list.indexOf(code)
    if (index < 0) continue
    list.splice(index, 1)
    removed = true
    if (!list.length) delete data.carriers[key]
  }
  if (!Object.keys(data.carriers).length) delete data.carriers
  return removed
}

function recoveredSet(source) {
  const data = suppliesData(source)
  if (!data) return new Set()
  return new Set(recordSetValues(campaignOf(source), data.recoveredKey))
}

// 初始化物资定义（7 项由内容层传入）与回收记录键；返回物资数量。
export function initializeSupplies(state, spec) {
  assertEoteFields(spec, ['items', 'recoveredKey'], '物资初始化声明')
  if (!Array.isArray(spec.items) || !spec.items.length) throw new TypeError('物资初始化声明缺少 items 数组')
  const codes = new Set()
  const items = []
  for (const raw of spec.items) {
    assertEoteFields(raw, INIT_ITEM_FIELDS, '物资条目')
    const code = supplyCode(raw.code)
    if (typeof raw.label !== 'string' || !raw.label.trim()) throw new TypeError(`物资 ${code} 缺少显示名`)
    if (codes.has(code)) throw new TypeError(`重复的物资卡号 ${code}`)
    codes.add(code)
    items.push({ code, label: raw.label })
  }
  const recoveredKey = spec.recoveredKey == null ? SUPPLIES_RECOVERED_KEY : spec.recoveredKey
  if (typeof recoveredKey !== 'string' || !RECORD_KEY_PATTERN.test(recoveredKey)) {
    throw new TypeError('物资回收记录键非法')
  }
  const eote = eoteOf(state, true)
  if (eote.supplies) throw new TypeError('探险物资已初始化，不能重复创建')
  eote.supplies = { items, recoveredKey }
  return items.length
}

// 全部物资定义（只读；未初始化返回空数组）。
export function supplyItems(campaignOrState) {
  const data = suppliesData(campaignOrState)
  return data ? data.items.map(item => ({ ...item })) : []
}

// 当前控制者座位；未被任何调查员控制返回 null。
export function supplyCarrier(campaignOrState, code) {
  const data = suppliesData(campaignOrState)
  if (!data) return null
  requireItem(data, code)
  for (const [key, list] of Object.entries(data.carriers || {})) {
    if (list.includes(code)) return Number(key)
  }
  return null
}

// 某座位携带的物资定义（只读）。
export function carriedSupplies(campaignOrState, seat) {
  if (!Number.isSafeInteger(seat) || seat < 0) throw new RangeError('无效调查员座位')
  const data = suppliesData(campaignOrState)
  if (!data) return []
  const codes = new Set((data.carriers || {})[seat] || [])
  return data.items.filter(item => codes.has(item.code)).map(item => ({ ...item }))
}

// 控制权转移：把物资交给某座位（从原控制者/掉落地点收回）；同座位重复指派返回 false。
export function assignSupply(state, code, seat) {
  const data = requireSuppliesData(state)
  requireItem(data, code)
  requireSeat(state, seat)
  if (supplyCarrier(state, code) === seat) return false
  removeCarrier(data, code)
  if (data.dropped && Object.hasOwn(data.dropped, code)) {
    delete data.dropped[code]
    if (!Object.keys(data.dropped).length) delete data.dropped
  }
  data.carriers ||= {}
  const key = String(seat)
  ;(data.carriers[key] ||= []).push(code)
  return true
}

// 释放控制：移除控制者但不确定新位置（物资变为未归属，等待掉落/回收）。
export function releaseSupply(state, code) {
  const data = requireSuppliesData(state)
  requireItem(data, code)
  return removeCarrier(data, code)
}

// 失败掉落：只有被调查员携带的物资才会掉落在当前地点；未携带返回 false。
export function dropSupplyAt(state, code, locationId) {
  const data = requireSuppliesData(state)
  requireItem(data, code)
  requireLocation(state, locationId)
  if (supplyCarrier(state, code) == null) return false
  removeCarrier(data, code)
  data.dropped ||= {}
  data.dropped[code] = locationId
  return true
}

// 回收：写入战役记录集合 recoveredKey（幂等）；已回收返回 false，不产生部分写入。
export function recoverSupply(state, code) {
  const data = requireSuppliesData(state)
  requireItem(data, code)
  if (!recordSetAdd(campaignOf(state), data.recoveredKey, code)) return false
  removeCarrier(data, code)
  if (data.dropped && Object.hasOwn(data.dropped, code)) {
    delete data.dropped[code]
    if (!Object.keys(data.dropped).length) delete data.dropped
  }
  return true
}

// 已回收的物资定义（按定义顺序）。
export function recoveredSupplies(campaignOrState) {
  const data = suppliesData(campaignOrState)
  if (!data) return []
  const recovered = recoveredSet(campaignOrState)
  return data.items.filter(item => recovered.has(item.code)).map(item => ({ ...item }))
}

// 尚未回收的物资定义（与 recoveredSupplies 互补）。
export function missingSupplies(campaignOrState) {
  const data = suppliesData(campaignOrState)
  if (!data) return []
  const recovered = recoveredSet(campaignOrState)
  return data.items.filter(item => !recovered.has(item.code)).map(item => ({ ...item }))
}

// 掉落在地点上的物资（含地点 id）；供 P7 失败结算与界面读点。
export function droppedSupplies(campaignOrState) {
  const data = suppliesData(campaignOrState)
  if (!data) return []
  const dropped = data.dropped || {}
  return data.items
    .filter(item => Object.hasOwn(dropped, item.code))
    .map(item => ({ ...item, locationId: dropped[item.code] }))
}

// 存档校验：定义唯一、控制者/掉落引用合法且互斥、回收记录与定义一致。
export function validateEoteSupplies(state, value) {
  if (value == null) return
  assertEoteFields(value, ['items', 'recoveredKey', 'carriers', 'dropped'], '探险物资战役记录')
  if (!Array.isArray(value.items) || !value.items.length) throw new TypeError('探险物资战役记录缺少 items')
  const codes = new Set()
  for (const item of value.items) {
    assertEoteFields(item, STORED_ITEM_FIELDS, '物资记录')
    const code = supplyCode(item.code)
    if (typeof item.label !== 'string' || !item.label.trim()) throw new TypeError(`物资 ${code} 缺少显示名`)
    if (codes.has(code)) throw new TypeError(`重复的物资卡号 ${code}`)
    codes.add(code)
  }
  if (typeof value.recoveredKey !== 'string' || !RECORD_KEY_PATTERN.test(value.recoveredKey)) {
    throw new TypeError('物资回收记录键非法')
  }
  const carried = new Set()
  if (value.carriers != null) {
    if (typeof value.carriers !== 'object' || Array.isArray(value.carriers)) throw new TypeError('物资控制者记录必须为对象')
    for (const [key, list] of Object.entries(value.carriers)) {
      const seat = Number(key)
      if (!Number.isSafeInteger(seat) || seat < 0 || String(seat) !== key) throw new TypeError(`物资控制者座位键非法：${key}`)
      if (seatExists(state, seat) === 'missing') throw new RangeError(`物资控制者座位 ${seat} 不在存档中`)
      if (!Array.isArray(list) || !list.length) throw new TypeError(`物资控制者 ${key} 的清单非法`)
      for (const code of list) {
        supplyCode(code)
        if (!codes.has(code)) throw new TypeError(`控制者 ${key} 携带未知物资 ${code}`)
        if (carried.has(code)) throw new TypeError(`物资 ${code} 同时由多名调查员控制`)
        carried.add(code)
      }
    }
  }
  const dropped = new Set()
  if (value.dropped != null) {
    if (typeof value.dropped !== 'object' || Array.isArray(value.dropped)) throw new TypeError('物资掉落记录必须为对象')
    for (const [code, locationId] of Object.entries(value.dropped)) {
      supplyCode(code)
      if (!codes.has(code)) throw new TypeError(`掉落记录引用未知物资 ${code}`)
      if (carried.has(code)) throw new TypeError(`物资 ${code} 不能同时被控制又掉落在某地`)
      if (typeof locationId !== 'string' || !locationId) throw new TypeError(`物资 ${code} 的掉落地点非法`)
      if (locationExists(state, locationId) === 'missing') throw new RangeError(`物资 ${code} 的掉落地点 ${locationId} 不在场`)
      dropped.add(code)
    }
  }
  // 回收记录集合是唯一权威：必须是已知物资，且不能同时被携带或掉落。
  const recovered = recordSetValues(campaignOf(state), value.recoveredKey)
  const recoveredSeen = new Set()
  for (const code of recovered) {
    supplyCode(code, '回收记录值')
    if (!codes.has(code)) throw new TypeError(`回收记录引用未知物资 ${code}`)
    if (recoveredSeen.has(code)) throw new TypeError(`回收记录重复 ${code}`)
    if (carried.has(code)) throw new TypeError(`物资 ${code} 已回收但仍被携带`)
    if (dropped.has(code)) throw new TypeError(`物资 ${code} 已回收但仍标记为掉落`)
    recoveredSeen.add(code)
  }
}
