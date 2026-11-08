// 《地球边缘》（EotE）战役级原语 B：五枚古老封印（Seal A–E）。
//
// 参考实现：参考资源 `Campaigns/EdgeOfTheEarth/Seal.hs`（SealKind A–E、active、placedBy）
// 与《疯狂之心》卡面：地点的强制效果把**休眠**封印放到该地点；调查员花费线索取得其控制权；
// 地点/高塔动作把**激活**的封印放置到伊夸之门或迷雾高塔。五枚封印是战役级实体，跨章持久。
//
// 注意：这里的封印与 TIC 的混乱标记封印（chaos-token-pool）**不是**同一机制，互不影响。
//
// 状态位置：`state.campaign.eote.seals`（可选扩展 v1）。形状：
//   campaign.eote.seals = {
//     entries: [{ kind: 'A'|'B'|'C'|'D'|'E', active, placedBySeat, locationId }],
//   }
// 生命周期：
//   1. placeDormantSeal(kind, locationId)  —— 剧本强制把休眠封印放到地点（无控制者）；
//   2. recoverSeal(kind, { seat })         —— 调查员取得地点上封印的控制权（离开地点）；
//   3. activateSeal(kind)                  —— 激活自己控制的休眠封印（已激活再调用返回 false）；
//   4. placeSeal(kind, { seat, locationId })—— 把自己控制且已激活的封印放到地点（门/高塔）；
//   5. recoverSeal/placeSeal 可再次取回并改放；unplaceSeal 返回休眠无控制者状态（剧本重置）。
// 本模块不内置任何卡号/地点 id：种类固定 A–E，地点由调用方传入；读点从不创建容器。
import { eoteCampaignState, assertEoteObject, assertEoteFields } from '../engine/eote-state.js'

export const SEAL_KINDS = Object.freeze(['A', 'B', 'C', 'D', 'E'])
const STORED_FIELDS = Object.freeze(['kind', 'active', 'placedBySeat', 'locationId'])

function campaignOf(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('封印记录需要对局状态或战役状态')
  return source.campaign && typeof source.campaign === 'object' ? source.campaign : source
}

function eoteOf(source, create = false) {
  const campaign = campaignOf(source)
  if (!create) return campaign.eote || null
  const eote = eoteCampaignState(source.campaign ? source : { campaign }, true)
  return assertEoteObject(eote, '战役 EotE 扩展')
}

function sealsData(source, create = false) {
  const eote = eoteOf(source, create)
  if (!eote) return null
  if (!create) return eote.seals || null
  eote.seals ||= { entries: [] }
  return eote.seals
}

function requireSealsData(state) {
  const data = sealsData(state)
  if (!data) throw new TypeError('封印尚未初始化，不能读写封印记录')
  return data
}

function sealKind(value) {
  if (!SEAL_KINDS.includes(value)) throw new RangeError(`未知的封印种类 ${JSON.stringify(value)}`)
  return value
}

function findEntry(data, kind) {
  sealKind(kind)
  return data.entries.find(entry => entry.kind === kind) || null
}

function requireEntry(state, kind) {
  sealKind(kind)
  const data = requireSealsData(state)
  const entry = findEntry(data, kind)
  if (!entry) throw new RangeError(`封印 ${kind} 不在此战役中`)
  return entry
}

// 座位引用：优先按运行时调查员数组校验，其次战役记录；两者都不存在时只校验整数（轻量状态）。
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
  // 关间/旧存档没有在场地点：不做引用校验，避免拒绝合法旧存档。
  if (!locations.length) return 'unknown'
  return locations.some(location => location && location.id === locationId) ? 'ok' : 'missing'
}

function requireLocation(state, locationId) {
  if (typeof locationId !== 'string' || !locationId) throw new TypeError('封印放置地点必须为非空字符串')
  if (!Array.isArray(state?.locations)) throw new TypeError('运行时状态缺少地点列表，无法校验封印放置地点')
  if (locationExists(state, locationId) === 'missing') throw new RangeError(`不存在地点 ${locationId}`)
  return locationId
}

// 初始化声明：kinds 为 A–E 的非空子集，缺省五枚全建。
function normalizeKinds(spec) {
  assertEoteFields(spec, ['kinds'], '封印初始化声明')
  const kinds = spec.kinds == null ? [...SEAL_KINDS] : spec.kinds
  if (!Array.isArray(kinds) || !kinds.length) throw new TypeError('封印初始化声明缺少 kinds 数组')
  const seen = new Set()
  for (const kind of kinds) {
    sealKind(kind)
    if (seen.has(kind)) throw new TypeError(`重复的封印种类 ${kind}`)
    seen.add(kind)
  }
  return kinds
}

// 初始化封印：返回本次建立的封印数量（每枚初始为休眠、无控制者、未放置）。
export function initializeSeals(state, spec = {}) {
  const kinds = normalizeKinds(spec)
  const eote = eoteOf(state, true)
  if (eote.seals) throw new TypeError('封印已初始化，不能重复创建')
  eote.seals = { entries: kinds.map(kind => ({ kind, active: false, placedBySeat: null, locationId: null })) }
  return kinds.length
}

// 读取单枚封印；未初始化或本战役没有该种类时返回 null。
export function sealState(campaignOrState, kind) {
  sealKind(kind)
  const data = sealsData(campaignOrState)
  if (!data) return null
  const entry = findEntry(data, kind)
  return entry ? { ...entry } : null
}

// 读取全部封印，可按谓词过滤；保持 A–E 的固定顺序。
export function sealsOf(campaignOrState, predicate = null) {
  if (predicate != null && typeof predicate !== 'function') throw new TypeError('封印筛选条件必须为函数')
  const data = sealsData(campaignOrState)
  if (!data) return []
  const order = new Map(SEAL_KINDS.map((kind, index) => [kind, index]))
  return [...data.entries]
    .sort((left, right) => (order.get(left.kind) ?? 99) - (order.get(right.kind) ?? 99))
    .filter(entry => !predicate || predicate({ ...entry }))
    .map(entry => ({ ...entry }))
}

export function placedSeals(campaignOrState) {
  return sealsOf(campaignOrState, entry => entry.locationId != null)
}

export function activatedSeals(campaignOrState) {
  return sealsOf(campaignOrState, entry => entry.active)
}

// 某调查员当前控制的封印（已取回、未放到地点）。
export function heldSeals(campaignOrState, seat) {
  return sealsOf(campaignOrState, entry => entry.locationId == null && entry.placedBySeat === seat)
}

export function sealsAt(campaignOrState, locationId) {
  return sealsOf(campaignOrState, entry => entry.locationId === locationId)
}

// 剧本强制：把休眠封印（无控制者）放到地点；只能从未放置、未激活、无人控制的状态出发。
export function placeDormantSeal(state, kind, locationId) {
  const entry = requireEntry(state, kind)
  requireLocation(state, locationId)
  if (entry.locationId != null || entry.placedBySeat != null || entry.active) return false
  entry.locationId = locationId
  return true
}

// 取回：调查员取得地点上无控制者封印的控制权（封印离开地点，仍保持原激活状态）。
export function recoverSeal(state, kind, { seat } = {}) {
  const entry = requireEntry(state, kind)
  requireSeat(state, seat)
  if (entry.locationId == null) return false
  // 已被其他调查员控制的封印不能抢；自己已控制（理论上 locationId 非空）时也视为非法转移。
  if (entry.placedBySeat != null) return false
  entry.locationId = null
  entry.placedBySeat = seat
  return true
}

// 激活：只有被调查员控制的休眠封印才能激活；已激活再次调用返回 false（「只能激活一次」）。
export function activateSeal(state, kind) {
  const entry = requireEntry(state, kind)
  if (entry.active) return false
  if (entry.placedBySeat == null) return false
  entry.active = true
  return true
}

// 休眠：仅用于剧本强制/重置；已放到地点的封印不能休眠（规则上激活状态随放置保留）。
export function deactivateSeal(state, kind) {
  const entry = requireEntry(state, kind)
  if (!entry.active) return false
  if (entry.locationId != null) return false
  entry.active = false
  return true
}

// 放置：只能由控制者把**已激活且未放置**的封印放到真实地点（伊夸之门/迷雾高塔等）。
export function placeSeal(state, kind, { seat, locationId } = {}) {
  const entry = requireEntry(state, kind)
  requireSeat(state, seat)
  requireLocation(state, locationId)
  if (!entry.active) return false
  if (entry.locationId != null) return false
  if (entry.placedBySeat !== seat) return false
  entry.locationId = locationId
  return true
}

// 取下：把放置中的封印返回「休眠、无控制者、未放置」（剧本重置/清理读点）。
export function unplaceSeal(state, kind) {
  const entry = requireEntry(state, kind)
  if (entry.locationId == null) return false
  entry.locationId = null
  entry.placedBySeat = null
  entry.active = false
  return true
}

// 存档校验：形状 + 状态一致性 + 座位/地点引用（地点表为空时跳过引用校验）。
export function validateEoteSeals(state, value) {
  if (value == null) return
  assertEoteFields(value, ['entries'], '封印战役记录')
  if (!Array.isArray(value.entries) || !value.entries.length) throw new TypeError('封印战役记录缺少 entries')
  const kinds = new Set()
  for (const entry of value.entries) {
    assertEoteFields(entry, STORED_FIELDS, '封印记录')
    if (!SEAL_KINDS.includes(entry.kind)) throw new RangeError(`封印种类非法：${JSON.stringify(entry.kind)}`)
    if (kinds.has(entry.kind)) throw new TypeError(`重复的封印种类 ${entry.kind}`)
    kinds.add(entry.kind)
    if (typeof entry.active !== 'boolean') throw new TypeError(`封印 ${entry.kind} 的 active 必须为布尔值`)
    if (entry.placedBySeat != null) {
      if (!Number.isSafeInteger(entry.placedBySeat) || entry.placedBySeat < 0) {
        throw new TypeError(`封印 ${entry.kind} 的控制者座位非法`)
      }
      if (seatExists(state, entry.placedBySeat) === 'missing') {
        throw new RangeError(`封印 ${entry.kind} 的控制者座位 ${entry.placedBySeat} 不在存档中`)
      }
    }
    if (entry.locationId != null) {
      if (typeof entry.locationId !== 'string' || !entry.locationId) {
        throw new TypeError(`封印 ${entry.kind} 的放置地点非法`)
      }
      if (locationExists(state, entry.locationId) === 'missing') {
        throw new RangeError(`封印 ${entry.kind} 的放置地点 ${entry.locationId} 不在场`)
      }
    }
    // 激活必须有控制者（剧本只能通过 recover→activate 激活）；未放置且无控制者只能是休眠。
    if (entry.active && entry.placedBySeat == null) throw new TypeError(`封印 ${entry.kind} 已激活但没有控制者`)
  }
}
