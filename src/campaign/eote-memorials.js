// 《地球边缘》（EotE）战役级原语 C：纪念逝者（Memorials of the Lost）。
//
// 规则来源：战役指南的幕间/检查点与参考卡表——伙伴在战役日志中被「划去」（阵亡/未救回）
// 后，幕间允许某位调查员把对应遗物（Memorials of the Lost 遭遇组剧情资产）加入牌组，
// 永久保留且不计入牌组张数。遗物是**剧情资产**，不占普通牌组槽位。
//
// 状态位置：`state.campaign.eote.memorials`（可选扩展 v1）。形状：
//   campaign.eote.memorials = {
//     entries: [{ partnerCode, relicCode }],
//     claimed?: ['<partnerCode>', ...],
//   }
//   · entries 是内容层（P7）传入的「伙伴 → 纪念遗物」映射，本模块不内置卡号；
//   · claimed 记录已领取过的伙伴（幂等：同一伙伴只能领取一次）。
//
// 本模块只提供记录原语：领取返回遗物卡号，**加入牌组由调用方**走既有
// `campaignCardChange(campaign, seat, code, 'add', reason)`（不改写 campaign.js/牌组）。
// 读点从不创建容器。
import { eoteCampaignState, assertEoteObject, assertEoteFields } from '../engine/eote-state.js'
import { partnerState } from './eote-partners.js'

// 「划去」状态：eliminated 是战役日志的划去；mia 在检查点/幕间里同样视为不可再获救。
export const MEMORIAL_CROSSED_OUT_STATUSES = Object.freeze(['eliminated', 'mia'])
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const INIT_ENTRY_FIELDS = Object.freeze(['partnerCode', 'relicCode'])
const STORED_FIELDS = Object.freeze(['partnerCode', 'relicCode'])

function campaignOf(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('纪念逝者记录需要对局状态或战役状态')
  return source.campaign && typeof source.campaign === 'object' ? source.campaign : source
}

function eoteOf(source, create = false) {
  const campaign = campaignOf(source)
  if (!create) return campaign.eote || null
  const eote = eoteCampaignState(source.campaign ? source : { campaign }, true)
  return assertEoteObject(eote, '战役 EotE 扩展')
}

function memorialsData(source, create = false) {
  const eote = eoteOf(source, create)
  if (!eote) return null
  if (!create) return eote.memorials || null
  eote.memorials ||= { entries: [] }
  return eote.memorials
}

function requireMemorialsData(state) {
  const data = memorialsData(state)
  if (!data) throw new TypeError('纪念逝者尚未初始化，不能读写纪念记录')
  return data
}

function memorialCode(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new TypeError(`${label} 必须是合法标识`)
  return value
}

function requireEntry(data, partnerCode) {
  memorialCode(partnerCode, '伙伴卡号')
  const entry = data.entries.find(item => item.partnerCode === partnerCode)
  if (!entry) throw new RangeError(`伙伴 ${partnerCode} 没有对应的纪念遗物`)
  return entry
}

function claimedSet(data) {
  return new Set(Array.isArray(data.claimed) ? data.claimed : [])
}

function isCrossedOut(state, partnerCode) {
  const partner = partnerState(state, partnerCode)
  return Boolean(partner && MEMORIAL_CROSSED_OUT_STATUSES.includes(partner.status))
}

// 初始化「伙伴 → 纪念遗物」映射：双方卡号唯一；返回条目数。
export function initializeMemorials(state, spec) {
  assertEoteFields(spec, ['entries'], '纪念逝者初始化声明')
  if (!Array.isArray(spec.entries) || !spec.entries.length) throw new TypeError('纪念逝者初始化声明缺少 entries 数组')
  const partnerCodes = new Set()
  const relicCodes = new Set()
  const entries = []
  for (const raw of spec.entries) {
    assertEoteFields(raw, INIT_ENTRY_FIELDS, '纪念遗物条目')
    const partnerCode = memorialCode(raw.partnerCode, '纪念伙伴卡号')
    const relicCode = memorialCode(raw.relicCode, '纪念遗物卡号')
    if (partnerCodes.has(partnerCode)) throw new TypeError(`重复的纪念伙伴卡号 ${partnerCode}`)
    if (relicCodes.has(relicCode)) throw new TypeError(`重复的纪念遗物卡号 ${relicCode}`)
    partnerCodes.add(partnerCode)
    relicCodes.add(relicCode)
    entries.push({ partnerCode, relicCode })
  }
  const eote = eoteOf(state, true)
  if (eote.memorials) throw new TypeError('纪念逝者已初始化，不能重复创建')
  eote.memorials = { entries }
  return entries.length
}

// 查询伙伴对应的纪念遗物卡号；未初始化返回 null，映射里没有该伙伴则抛错。
export function memorialFor(campaignOrState, partnerCode) {
  const data = memorialsData(campaignOrState)
  if (!data) return null
  return requireEntry(data, partnerCode).relicCode
}

// 已划去（eliminated/mia）伙伴的纪念遗物清单，含是否已领取；保持映射顺序。
export function crossedOutMemorials(campaignOrState) {
  const data = memorialsData(campaignOrState)
  if (!data) return []
  const claimed = claimedSet(data)
  return data.entries
    .filter(entry => isCrossedOut(campaignOrState, entry.partnerCode))
    .map(entry => ({ ...entry, claimed: claimed.has(entry.partnerCode) }))
}

// 已领取的纪念遗物清单（内容层用于界面/日志复核）。
export function claimedMemorials(campaignOrState) {
  const data = memorialsData(campaignOrState)
  if (!data) return []
  const claimed = claimedSet(data)
  return data.entries.filter(entry => claimed.has(entry.partnerCode)).map(entry => ({ ...entry }))
}

// 领取：伙伴已划去且未领取时记录并返回遗物卡号；不可领取/已领取返回 null。
// 牌组写入由调用方完成（本模块保持战役记录原语边界）。
export function claimMemorial(state, partnerCode) {
  const data = requireMemorialsData(state)
  const entry = requireEntry(data, partnerCode)
  const claimed = claimedSet(data)
  if (claimed.has(entry.partnerCode)) return null
  if (!isCrossedOut(state, entry.partnerCode)) return null
  data.claimed ||= []
  data.claimed.push(entry.partnerCode)
  return entry.relicCode
}

// 幕间批量领取：把所有已划去且未领取的伙伴纪念一次领完；返回本次领取的条目。
// 幂等：第二次调用返回空数组。
export function claimAllAtInterlude(state) {
  const data = memorialsData(state)
  if (!data) return []
  const claimed = []
  for (const entry of crossedOutMemorials(state)) {
    if (entry.claimed) continue
    const relicCode = claimMemorial(state, entry.partnerCode)
    if (relicCode != null) claimed.push({ partnerCode: entry.partnerCode, relicCode })
  }
  return claimed
}

// 存档校验：条目形状/唯一性、claimed 引用必须落在 entries 内。
export function validateEoteMemorials(state, value) {
  if (value == null) return
  assertEoteFields(value, ['entries', 'claimed'], '纪念逝者战役记录')
  if (!Array.isArray(value.entries) || !value.entries.length) throw new TypeError('纪念逝者战役记录缺少 entries')
  const partnerCodes = new Set()
  const relicCodes = new Set()
  for (const entry of value.entries) {
    assertEoteFields(entry, STORED_FIELDS, '纪念遗物记录')
    const partnerCode = memorialCode(entry.partnerCode, '纪念伙伴卡号')
    const relicCode = memorialCode(entry.relicCode, '纪念遗物卡号')
    if (partnerCodes.has(partnerCode)) throw new TypeError(`重复的纪念伙伴卡号 ${partnerCode}`)
    if (relicCodes.has(relicCode)) throw new TypeError(`重复的纪念遗物卡号 ${relicCode}`)
    partnerCodes.add(partnerCode)
    relicCodes.add(relicCode)
  }
  if (value.claimed == null) return
  if (!Array.isArray(value.claimed)) throw new TypeError('已领取的纪念记录必须为数组')
  const claimed = new Set()
  for (const partnerCode of value.claimed) {
    memorialCode(partnerCode, '已领取纪念伙伴卡号')
    if (claimed.has(partnerCode)) throw new TypeError(`重复的已领取纪念伙伴 ${partnerCode}`)
    if (!partnerCodes.has(partnerCode)) throw new TypeError(`已领取纪念伙伴 ${partnerCode} 不在纪念映射中`)
    claimed.add(partnerCode)
  }
}
