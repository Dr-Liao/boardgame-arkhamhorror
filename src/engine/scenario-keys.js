import { enemyForKeyHolder } from './enemy-zones.js'
import { registeredEntry } from './ability.js'
import { randomValue } from './rules-state.js'
import { mechanicState, investigatorAt, locationAt } from './mechanic-state.js'
export const KEY_COLORS = Object.freeze(['red', 'yellow', 'green', 'blue', 'purple', 'white', 'black'])

// 《地球边缘》古神之城的「数值钥匙」是**物理钥匙卡**：每张有一个混乱标记 identity
// （2×[skull]、2×[cultist]、2×[tablet]、2×[elder_thing]、2×"0"、2×"-1"、2×"-2"、2×"-3"），
// 可以放在地点/敌人上、由调查员控制、成对花费。它与 TIC 的彩色钥匙（一种颜色一枚）是两套
// identity：本模块把数值钥匙作为同一 `mechanicState.keys` 容器里的独立身份条目
// （`{ kind: 'value', value, holder, revealed: true }`，键名为不透明实体 id），彩色钥匙仍按
// 颜色名为键。彩色钥匙的读点全部过滤 `kind === 'value'`，两套 API 互不串门。
// 数值钥匙始终正面朝上，`revealed` 固定 true 只为满足既有钥匙存档字段约定。
export const VALUE_KEY_FACES = Object.freeze(['skull', 'cultist', 'tablet', 'elderthing'])
// 数值 identity 的允许范围：混乱标记数值（+1、0、-1 … -8），留一格余量。
export const VALUE_KEY_VALUE_LIMIT = 9
const KEY_HOLDER_SPECIALS = Object.freeze(['setAside', 'removed', 'reference'])
const VALUE_KEY_HOLDER_SPECIALS = Object.freeze([...KEY_HOLDER_SPECIALS, 'spent'])
const VALUE_KEY_FIELDS = Object.freeze(['kind', 'value', 'holder', 'revealed'])

function isValueKey(key) {
  return key?.kind === 'value'
}
function holder(state, target, specials = KEY_HOLDER_SPECIALS) {
  if (specials.includes(target)) return target
  if (typeof target !== 'string') throw new TypeError('无效钥匙目标')
  const [kind, ...parts] = target.split(':'); const id = parts.join(':')
  if (kind === 'investigator') investigatorAt(state, Number(id))
  else if (kind === 'location') locationAt(state, id)
  else if (kind === 'enemy') { if (!enemyForKeyHolder(state,id)) throw new RangeError('无效钥匙目标') }
  else if (kind === 'act') { if (!state.acts?.some(act => act.id === id)) throw new RangeError('无效钥匙目标') }
  else if (kind !== 'asset' || ![...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].some(asset => asset.id === id)) throw new RangeError('无效钥匙目标')
  return target
}
export function initializeKeys(state, specs) {
  if (!Array.isArray(specs) || new Set(specs.map(s => s.color)).size !== specs.length) throw new TypeError('钥匙声明重复或无效')
  const entries = specs.map(spec => {
    if (!KEY_COLORS.includes(spec.color) || typeof spec.revealed !== 'boolean') throw new TypeError('无效钥匙声明')
    return [spec.color, { holder: holder(state, spec.holder || 'setAside'), revealed: spec.revealed }]
  })
  const data = mechanicState(state, true)
  if (data.keys) throw new Error('钥匙已初始化，不能重复创建')
  data.keys = Object.fromEntries(entries)
  return entries.length
}
export function keysAt(state, target, { reveal = false } = {}) {
  holder(state, target)
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => !isValueKey(key) && key.holder === target)
    .map(([color, key]) => reveal || key.revealed ? color : 'unrevealed')
}

export function keysHeldAtLocation(state, id) {
  locationAt(state, id)
  const holders = new Set((state.investigators || []).filter(inv => inv.location === id && !inv.defeated && !inv.resigned).map(inv => `investigator:${inv.seat}`))
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => !isValueKey(key) && holders.has(key.holder)).map(([color]) => color)
}
export function keysHeldByGroup(state) {
  const holders = new Set((state.investigators || []).filter(inv => !inv.defeated && !inv.resigned).map(inv => `investigator:${inv.seat}`))
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => !isValueKey(key) && holders.has(key.holder)).map(([color]) => color)
}

export function linkKeyAsset(state, color, assetId) {
  const key = mechanicState(state)?.keys?.[color]
  const asset = [...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].find(asset => asset.id === assetId)
  if (!key || isValueKey(key) || !asset) return false
  key.linkedAssetId = assetId
  return true
}
function syncLinkedAsset(state, key, to) {
  if (!key.linkedAssetId) return
  const groups = [state.storyAssets || [], ...state.investigators.map(inv => inv.assets)]
  const source = groups.find(cards => cards.some(asset => asset.id === key.linkedAssetId))
  if (!source) return // A removed or destroyed relic is never recreated.
  const asset = source.splice(source.findIndex(asset => asset.id === key.linkedAssetId), 1)[0]
  if (to.startsWith('investigator:')) {
    const inv = state.investigators[Number(to.slice(13))]
    delete asset.near; delete asset.uncontrolled; delete asset.location
    inv.assets.push(asset)
  } else if (to.startsWith('location:') || to.startsWith('enemy:') || to.startsWith('asset:')) {
    const id = to.slice(to.indexOf(':') + 1)
    const host = [...state.locations, ...state.enemies, ...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].find(card => card.id === id)
    asset.near = to; asset.uncontrolled = true; asset.location = state.locations.includes(host) ? host.id : host?.location
    state.storyAssets ||= []; state.storyAssets.push(asset)
  } else {
    state.removedFromGame ||= []; state.removedFromGame.push(asset.originalCode || asset.code)
  }
}
export function transferKey(state, color, from, to, { reveal = false } = {}) {
  holder(state, from); holder(state, to)
  const key = mechanicState(state)?.keys?.[color]
  if (!key || isValueKey(key) || key.holder !== from) return false
  key.holder = to; if (reveal) key.revealed = true
  syncLinkedAsset(state, key, to)
  return true
}
export function placeRandomUnrevealedKey(state, to) {
  holder(state, to)
  const choices = Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => !isValueKey(key) && key.holder === 'setAside' && !key.revealed)
  if (!choices.length) return false
  const [color] = choices[Math.floor(randomValue(state) * choices.length)]
  transferKey(state, color, 'setAside', to)
  return true // Do not reveal the randomly placed color to the caller/UI.
}
export function canClaimKey(state, seat, color = null) {
  const inv = investigatorAt(state, seat), location = locationAt(state, inv.location)
  if (inv.defeated || inv.resigned || (location.clues || 0) > 0) return false
  const traits = registeredEntry(state.acts?.[state.actIndex]?.originalCode || state.acts?.[state.actIndex]?.code)?.actRule?.keyClaimBlockedTraits || []
  if(traits.some(trait=>location.traits?.includes(trait)))return false
  const keys = mechanicState(state)?.keys || {}
  return Object.entries(keys).some(([candidate,key])=>(color==null||color===candidate)&&!isValueKey(key)&&key.holder==='location:'+inv.location)
}
export function canGiveKeys(state, seat) {
  const inv=investigatorAt(state,seat)
  return !inv.defeated&&!inv.resigned&&keysAt(state,'investigator:'+seat).length>0&&state.investigators.some(other=>other.seat!==seat&&!other.defeated&&!other.resigned&&other.location===inv.location)
}
export function claimKey(state, seat, color) {
  const inv = investigatorAt(state, seat), location = locationAt(state, inv.location)
  if (!canClaimKey(state,seat,color)) return false
  return transferKey(state, color, `location:${inv.location}`, `investigator:${seat}`, { reveal: true })
}
export function spendKey(state, seat, color, destination = 'reference') {
  investigatorAt(state, seat)
  return transferKey(state, color, `investigator:${seat}`, destination)
}
export function keysOnExit(state, target, location, responsibleSeat = null) {
  const entries = Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => !isValueKey(key) && key.holder === target)
  if (!entries.length) return 0
  locationAt(state, location)
  const inv = responsibleSeat == null ? null : investigatorAt(state, responsibleSeat)
  const to = inv && !inv.defeated && !inv.resigned ? `investigator:${responsibleSeat}` : `location:${location}`
  for (const [color] of entries) transferKey(state, color, target, to, { reveal: !!inv })
  return entries.length
}
export function giveKeys(state, from, to, colors) {
  const owner = investigatorAt(state, from), recipient = investigatorAt(state, to)
  if (owner.location !== recipient.location || owner.defeated || owner.resigned || recipient.defeated || recipient.resigned) return false
  const data = mechanicState(state)?.keys || {}
  if (!Array.isArray(colors) || new Set(colors).size !== colors.length || colors.some(color => isValueKey(data[color]) || data[color]?.holder !== `investigator:${from}`)) return false
  for (const color of colors) transferKey(state, color, `investigator:${from}`, `investigator:${to}`)
  return true
}

// ---------------------------------------------------------------------------------------------
// 数值钥匙（EotE《古神之城》，P2-D `scenario.keys` 扩展）：入口/读点/原子花费。
// ---------------------------------------------------------------------------------------------
function valueKeyId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(id)) {
    throw new TypeError('数值钥匙 id 必须为 1–64 位合法标识符')
  }
  if (KEY_COLORS.includes(id)) throw new TypeError(`数值钥匙 id 不能与彩色钥匙同名：${id}`)
  return id
}
function valueKeyValue(value) {
  if (Number.isSafeInteger(value)) {
    if (value < -VALUE_KEY_VALUE_LIMIT || value > VALUE_KEY_VALUE_LIMIT) {
      throw new RangeError(`数值钥匙 identity 必须在 -${VALUE_KEY_VALUE_LIMIT}..${VALUE_KEY_VALUE_LIMIT} 之间`)
    }
    return value
  }
  if (typeof value === 'string' && VALUE_KEY_FACES.includes(value)) return value
  throw new TypeError('数值钥匙 identity 必须为整数或合法标记面')
}
function valueKeyHolder(state, target) {
  return holder(state, target, VALUE_KEY_HOLDER_SPECIALS)
}
// 读档只校验持有者形状（实体可能已离场/被移出游戏，与彩色钥匙的读档口径一致）。
function valueKeyHolderShape(target) {
  if (typeof target !== 'string') throw new TypeError('无效数值钥匙目标')
  if (VALUE_KEY_HOLDER_SPECIALS.includes(target)) return target
  const [kind, ...parts] = target.split(':')
  const id = parts.join(':')
  if (!id || !['investigator', 'location', 'enemy', 'act', 'asset'].includes(kind)) throw new TypeError('无效数值钥匙目标')
  if (kind === 'investigator' && !/^\d+$/.test(id)) throw new TypeError('无效数值钥匙目标')
  return target
}

/**
 * 建局：声明全部数值钥匙。`specs = [{ id, value, holder? }]`
 * `value` 为整数（0、-1、-2、-3 等）或 'skull'/'cultist'/'tablet'/'elderthing'；
 * `holder` 缺省 'setAside'。与彩色钥匙共用 keys 容器，因此一个关卡只能初始化一套 identity。
 */
export function initializeValueKeys(state, specs) {
  if (!Array.isArray(specs) || !specs.length) throw new TypeError('数值钥匙声明必须为非空数组')
  const seen = new Set()
  const entries = specs.map(spec => {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('无效数值钥匙声明')
    for (const key of Object.keys(spec)) if (!['id', 'value', 'holder'].includes(key)) throw new TypeError(`数值钥匙声明未知字段 ${key}`)
    const id = valueKeyId(spec.id)
    if (seen.has(id)) throw new TypeError(`数值钥匙 id 重复：${id}`)
    seen.add(id)
    return [id, {
      kind: 'value',
      value: valueKeyValue(spec.value),
      holder: valueKeyHolder(state, spec.holder == null ? 'setAside' : spec.holder),
      revealed: true,
    }]
  })
  const data = mechanicState(state, true)
  if (data.keys) throw new Error('钥匙已初始化，不能重复创建')
  data.keys = Object.fromEntries(entries)
  return entries.length
}

/** 全部数值钥匙 id（按 id 排序）；未初始化返回 []。只读、不初始化。 */
export function valueKeyIds(state) {
  return Object.entries(mechanicState(state)?.keys || {}).filter(([, key]) => isValueKey(key)).map(([id]) => id).sort()
}

/** 某个持有者手上的数值钥匙 `[{ id, value }]`（按 id 排序）；目标非法抛错。只读、不初始化。 */
export function valueKeysAt(state, target) {
  valueKeyHolder(state, target)
  return Object.entries(mechanicState(state)?.keys || {})
    .filter(([, key]) => isValueKey(key) && key.holder === target)
    .map(([id, key]) => ({ id, value: key.value }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * 原子花费：`spec = { values, destination? }`。`values` 是 identity 多重集
 * （如两枚 [elder_thing] → ['elderthing', 'elderthing']），按目标持有者逐枚配对；
 * 不足/不匹配返回 false 且不产生部分花费。`destination` 缺省 'spent'（已花费实体钥匙，
 * 内容可再用 valueKeysAt('spent') 读出并决定是否入混乱袋/移出游戏）。
 */
export function spendValueKeys(state, target, spec = {}) {
  valueKeyHolder(state, target)
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('数值钥匙花费声明必须为对象')
  for (const key of Object.keys(spec)) if (!['values', 'destination'].includes(key)) throw new TypeError(`数值钥匙花费未知字段 ${key}`)
  if (!Array.isArray(spec.values) || !spec.values.length) throw new TypeError('数值钥匙花费必须声明非空的 values 数组')
  const wanted = spec.values.map(valueKeyValue)
  const destination = spec.destination == null ? 'spent' : valueKeyHolder(state, spec.destination)
  const data = mechanicState(state)?.keys || {}
  const candidates = Object.keys(data).filter(id => isValueKey(data[id]) && data[id].holder === target)
  const used = new Set()
  const chosen = []
  for (const value of wanted) {
    const id = candidates.find(candidate => !used.has(candidate) && data[candidate].value === value)
    if (id == null) return false // 先配对再写入：不足时原状态不动。
    used.add(id)
    chosen.push(id)
  }
  for (const id of chosen) data[id].holder = destination
  return true
}

/**
 * 存档校验（Lead 接进 save-migration）：`value` 为 `mechanicState.keys` 容器。
 * 只校验 `kind === 'value'` 的条目（彩色钥匙由 mechanic-state.js 的既有校验负责）；
 * 未知身份/未知字段/坏 identity/非正面朝上/坏持有者形状立即失败。
 */
export function validateEoteValueKeys(state, value = mechanicState(state)?.keys) {
  if (value == null) return
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('存档钥匙记录必须为对象')
  for (const [id, key] of Object.entries(value)) {
    if (!key || typeof key !== 'object' || Array.isArray(key)) throw new TypeError('存档钥匙记录无效')
    if (key.kind === undefined) continue // 彩色钥匙走 mechanic-state.js 的既有校验。
    if (key.kind !== 'value') throw new TypeError(`存档钥匙身份未知：${key.kind}`)
    for (const field of Object.keys(key)) if (!VALUE_KEY_FIELDS.includes(field)) throw new TypeError(`存档数值钥匙未知字段 ${field}`)
    valueKeyId(id)
    valueKeyValue(key.value)
    if (key.revealed !== true) throw new TypeError('存档数值钥匙必须正面朝上')
    valueKeyHolderShape(key.holder)
  }
}
