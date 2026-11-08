// 《地球边缘》（EotE）战役级原语 A：探险队伙伴（Partner）名册与状态机。
//
// 参考实现：参考资源 `Campaigns/EdgeOfTheEarth/Partner.hs`（9 位伙伴、跨关持久伤害/恐惧、
// Safe/Mia/Eliminated/Resolute 四态、坚毅面替换）与战役指南「检查点 I：失踪」
// （按营地庇护值随机保护存活伙伴，其余记为 MIA）。伙伴是**战役级**实体：跨场景持久，
// 不占盟友槽位，伤害/恐惧在每场游戏结束时记入战役日志。
//
// 状态位置：`state.campaign.eote.partners`（`src/engine/eote-state.js` 提供的可选扩展 v1）。
// 形状（version 1）：
//   campaign.eote.partners = {
//     roster: [{ code, damage, horror, status, resolute? }],
//   }
//
// 口径：
//   · 本模块不内置任何卡号——名册与坚毅替换映射都由内容层（P7）通过 `initializePartners`
//     传入；验证只查形状，不查具体卡牌是否存在。
//   · 读点从不创建容器（`create=false`）；只有 initialize 写 `campaign.eote`。
//   · 写入前先完成全部校验，失败时不留部分写入（与 TIC 原语同一事务口径）。
//   · 随机性必须注入 `random` 回调（测试/回放可确定），缺省才退回引擎的 `randomValue(state)`。
import { eoteCampaignState, assertEoteObject, assertEoteFields } from '../engine/eote-state.js'
import { randomValue } from '../engine/rules-state.js'

// 四态：安全、失踪（MIA）、划去（阵亡/永久离队）、坚毅（Fatal Mirage 强化面）。
export const PARTNER_STATUSES = Object.freeze(['safe', 'mia', 'eliminated', 'resolute'])
// 「仍然存活」的两态：检查点 I 抽选与剩余伙伴列表只读它们。
export const PARTNER_ALIVE_STATUSES = Object.freeze(['safe', 'resolute'])
// 合法状态转移：safe→mia（失踪）/eliminated（划去）/resolute（坚毅）；
// mia→safe（第 II 部分救回）/eliminated（未救回、划去）；resolute→eliminated；eliminated 终态。
export const PARTNER_TRANSITIONS = Object.freeze({
  safe: Object.freeze(['mia', 'eliminated', 'resolute']),
  mia: Object.freeze(['safe', 'eliminated']),
  resolute: Object.freeze(['eliminated']),
  eliminated: Object.freeze([]),
})

// 通用标识形状：允许 EotE 卡号（纯数字）与内容层稳定 id；不校验具体卡号。
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const STORED_FIELDS = Object.freeze(['code', 'damage', 'horror', 'status', 'resolute'])
const INIT_ENTRY_FIELDS = Object.freeze(['code', 'damage', 'horror'])

function campaignOf(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new TypeError('伙伴记录需要对局状态或战役状态')
  return source.campaign && typeof source.campaign === 'object' ? source.campaign : source
}

// 战役级 EotE 扩展容器：create=false 时只读（返回 null），绝不初始化。
function eoteOf(source, create = false) {
  const campaign = campaignOf(source)
  if (!create) return campaign.eote || null
  const eote = eoteCampaignState(source.campaign ? source : { campaign }, true)
  return assertEoteObject(eote, '战役 EotE 扩展')
}

function partnersData(source, create = false) {
  const eote = eoteOf(source, create)
  if (!eote) return null
  if (!create) return eote.partners || null
  eote.partners ||= { roster: [] }
  return eote.partners
}

function requirePartnersData(state) {
  const data = partnersData(state)
  if (!data) throw new TypeError('伙伴尚未初始化，不能读写伙伴记录')
  return data
}

function partnerCode(value, label = '伙伴卡号') {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new TypeError(`${label} 必须是合法标识`)
  return value
}

function harmValue(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} 必须为非负整数`)
  return value
}

function harmDelta(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} 变化量必须为整数`)
  return value
}

function findEntry(data, code) {
  partnerCode(code)
  return data.roster.find(entry => entry.code === code) || null
}

function requireEntry(state, code) {
  partnerCode(code)
  const data = requirePartnersData(state)
  const entry = findEntry(data, code)
  if (!entry) throw new RangeError(`未知的伙伴卡号 ${code}`)
  return entry
}

// 初始化声明：名册条目只允许 code/damage/horror；坚毅替换映射允许对象或二元组数组。
// 返回完全规范化的名册，调用方确认无错后才建容器。
function normalizeRoster(spec) {
  assertEoteFields(spec, ['partners', 'resoluteForms'], '伙伴初始化声明')
  if (!Array.isArray(spec.partners) || !spec.partners.length) throw new TypeError('伙伴初始化声明缺少 partners 数组')
  const codes = new Set()
  const roster = []
  for (const raw of spec.partners) {
    assertEoteFields(raw, INIT_ENTRY_FIELDS, '伙伴条目')
    const code = partnerCode(raw.code)
    if (codes.has(code)) throw new TypeError(`重复的伙伴卡号 ${code}`)
    codes.add(code)
    roster.push({
      code,
      damage: harmValue(raw.damage, '伙伴伤害'),
      horror: harmValue(raw.horror, '伙伴恐惧'),
      status: 'safe',
    })
  }
  const mapping = new Map()
  if (spec.resoluteForms != null) {
    const pairs = Array.isArray(spec.resoluteForms)
      ? spec.resoluteForms.map(pair => {
        if (!Array.isArray(pair) || pair.length !== 2) throw new TypeError('坚毅替换必须以 [基础卡号, 坚毅卡号] 给出')
        return pair
      })
      : Object.entries(spec.resoluteForms)
    for (const [baseCode, resoluteCode] of pairs) {
      partnerCode(baseCode, '坚毅替换基础卡号')
      partnerCode(resoluteCode, '坚毅替换卡号')
      if (!codes.has(baseCode)) throw new RangeError(`坚毅替换的基础伙伴不在名册中：${baseCode}`)
      if (mapping.has(baseCode)) throw new TypeError(`重复的坚毅替换基础伙伴 ${baseCode}`)
      if (mapping.has(resoluteCode) || [...mapping.values()].includes(resoluteCode)) throw new TypeError(`重复的坚毅替换卡号 ${resoluteCode}`)
      if (resoluteCode === baseCode || codes.has(resoluteCode)) throw new TypeError('坚毅替换卡号不能与名册中的伙伴卡号重复')
      mapping.set(baseCode, resoluteCode)
    }
  }
  for (const entry of roster) {
    const resolute = mapping.get(entry.code)
    if (resolute) entry.resolute = resolute
  }
  return roster
}

// 初始化伙伴名册：内容层传入 9 位伙伴与坚毅替换映射；返回名册人数。
export function initializePartners(state, spec) {
  const roster = normalizeRoster(spec)
  const eote = eoteOf(state, true)
  if (eote.partners) throw new TypeError('伙伴已初始化，不能重复创建')
  eote.partners = { roster }
  return roster.length
}

// 读取单个伙伴记录；未初始化或名册不含该卡号时返回 null。
export function partnerState(campaignOrState, code) {
  const data = partnersData(campaignOrState)
  if (!data) return null
  const entry = findEntry(data, code)
  return entry ? { ...entry } : null
}

// 按状态筛选（单个状态或状态数组），保持名册顺序；未初始化返回空数组。
export function partnersWithStatus(campaignOrState, statuses) {
  const wanted = Array.isArray(statuses) ? statuses : [statuses]
  for (const status of wanted) if (!PARTNER_STATUSES.includes(status)) throw new RangeError(`未知的伙伴状态 ${status}`)
  const data = partnersData(campaignOrState)
  if (!data) return []
  return data.roster.filter(entry => wanted.includes(entry.status)).map(entry => ({ ...entry }))
}

// 仍存活的伙伴（safe + resolute）。
export function remainingPartners(campaignOrState) {
  return partnersWithStatus(campaignOrState, [...PARTNER_ALIVE_STATUSES])
}

// 跨关持久伤害/恐惧：变化量可为负（治疗），结果下限 0；先校验后写，不留部分写入。
export function adjustPartnerHarm(state, code, { damage = 0, horror = 0 } = {}) {
  const deltaDamage = harmDelta(damage, '伙伴伤害')
  const deltaHorror = harmDelta(horror, '伙伴恐惧')
  const entry = requireEntry(state, code)
  const nextDamage = Math.max(0, entry.damage + deltaDamage)
  const nextHorror = Math.max(0, entry.horror + deltaHorror)
  if (!Number.isSafeInteger(nextDamage) || !Number.isSafeInteger(nextHorror)) throw new RangeError('伙伴伤害/恐惧超出安全范围')
  entry.damage = nextDamage
  entry.horror = nextHorror
  return { ...entry }
}

// 状态转移：非法转移或同态重复返回 false（不写）；卡号/状态参数非法则抛错。
export function setPartnerStatus(state, code, status) {
  if (!PARTNER_STATUSES.includes(status)) throw new RangeError(`未知的伙伴状态 ${status}`)
  const entry = requireEntry(state, code)
  if (entry.status === status) return false
  if (!PARTNER_TRANSITIONS[entry.status].includes(status)) return false
  entry.status = status
  return true
}

// 「仍然存活」查询：未初始化/未知卡号返回 false（只读，不抛错）。
export function isPartnerAlive(campaignOrState, code) {
  try {
    return PARTNER_ALIVE_STATUSES.includes(partnerState(campaignOrState, code)?.status)
  } catch {
    return false
  }
}

// 坚毅替换映射：返回该伙伴的坚毅面卡号；未配置映射返回 null。未初始化返回 null。
export function resoluteFormOf(campaignOrState, code) {
  const data = partnersData(campaignOrState)
  if (!data) return null
  const entry = requireEntry(campaignOrState, code)
  return entry.resolute != null ? entry.resolute : null
}

// 检查点 I 语义：存活伙伴洗混后，前「庇护值」名安全，其余全部记为 MIA。
// 只写状态字段；`random` 必须返回 [0,1)，非法随机源在任何写入之前抛错。
export function chooseMissingPartners(state, shelterValue, random = null) {
  if (!Number.isSafeInteger(shelterValue) || shelterValue < 0) throw new RangeError('庇护值必须为非负整数')
  if (random != null && typeof random !== 'function') throw new TypeError('随机源必须为函数')
  const data = requirePartnersData(state)
  const pool = data.roster.filter(entry => PARTNER_ALIVE_STATUSES.includes(entry.status))
  if (!pool.length) return []
  const roll = random || (() => randomValue(state))
  // Fisher-Yates：与参考实现的「洗混后随机取庇护值数量」等价；同一回调序列结果确定。
  const shuffled = [...pool]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const value = roll()
    if (typeof value !== 'number' || !(value >= 0 && value < 1)) throw new RangeError('随机源必须返回 [0,1) 的数值')
    const target = Math.floor(value * (index + 1))
    const swap = shuffled[index]
    shuffled[index] = shuffled[target]
    shuffled[target] = swap
  }
  const safeCount = Math.min(shelterValue, shuffled.length)
  const missing = shuffled.slice(safeCount)
  for (const entry of missing) entry.status = 'mia'
  return missing.map(entry => ({ ...entry }))
}

// 存档校验：只校验形状与状态域（不查具体卡牌）；value 缺失表示旧存档没有该记录。
export function validateEotePartners(state, value) {
  if (value == null) return
  assertEoteFields(value, ['roster'], '伙伴战役记录')
  if (!Array.isArray(value.roster) || !value.roster.length) throw new TypeError('伙伴战役记录缺少 roster')
  const codes = new Set()
  const resoluteCodes = new Set()
  for (const entry of value.roster) {
    assertEoteFields(entry, STORED_FIELDS, '伙伴记录')
    const code = partnerCode(entry.code)
    if (codes.has(code)) throw new TypeError(`重复的伙伴卡号 ${code}`)
    codes.add(code)
    harmValue(entry.damage, `伙伴 ${code} 的伤害`)
    harmValue(entry.horror, `伙伴 ${code} 的恐惧`)
    if (!PARTNER_STATUSES.includes(entry.status)) throw new RangeError(`伙伴 ${code} 的状态非法：${JSON.stringify(entry.status)}`)
  }
  // 坚毅替换引用必须在名册内、目标唯一且不与名册卡号冲突。
  for (const entry of value.roster) {
    if (entry.resolute == null) continue
    partnerCode(entry.resolute, `伙伴 ${entry.code} 的坚毅卡号`)
    if (resoluteCodes.has(entry.resolute)) throw new TypeError(`重复的坚毅替换卡号 ${entry.resolute}`)
    resoluteCodes.add(entry.resolute)
    if (codes.has(entry.resolute)) throw new TypeError(`坚毅替换卡号 ${entry.resolute} 不能是名册中的伙伴`)
  }
}
