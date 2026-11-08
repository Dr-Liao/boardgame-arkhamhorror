// 七循环《地球边缘》investigator.discipline 原语（P2-F）。
//
// 印刷规则（08010 陈丽丽 + 08011a/b–08014a/b 演武 + 08015 命运重担）：
//   · 演武是双面永久支援：正面 [[Unbroken]]、背面 [[Broken]]（卡表用两个卡号表达同一张印刷卡的两面）；
//   · 开局时牌组里每张演武以 Unbroken 面在场；Unbroken 面行动翻到 Broken，Broken 面在轮末满足
//     条件时翻回 Unbroken（翻面条件由卡条目描述子读取，本模块只记录当前面）；
//   · 每张演武在构筑时配 1 张命运重担（08015）；命运重担让演武在本轮不能翻回，由调用方读
//     disciplineFace / 状态决定，本模块不解释卡面。
//
// 状态形状（战役级可选扩展，见 eote-state.js；纯 JSON，随存档往返，读点从不初始化）：
//   state.campaign.eote.disciplines = {
//     sets: [{ unbrokenCode: string, brokenCode: string, burdenCode: string }],
//     faces: { "<unbrokenCode>": 'unbroken' | 'broken' },
//     selected: [unbrokenCode, ...],   // 按经验选择的演武集合（内容层/构筑层写入）
//   }
// 卡号全部由参数提供，本模块不写死任何 EotE 卡号。
import { eoteCampaignState } from './eote-state.js'

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const FACES = Object.freeze(['unbroken', 'broken'])

function assertCode(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} 必须是非空卡号字符串`)
  return value
}

function disciplineStore(state, create = false) {
  const campaign = eoteCampaignState(state, create)
  if (!campaign) return null
  if (create) campaign.disciplines ||= { sets: [], faces: {}, selected: [] }
  return campaign.disciplines || null
}

function normalizeSets(sets) {
  if (!Array.isArray(sets) || !sets.length) throw new TypeError('演武声明必须是非空数组')
  // Unbroken/Broken 是同一张印刷卡的两面（各自唯一）；命运重担 08015 是重复卡，允许多张演武共用，
  // 因此只对两面卡号做全局唯一校验，命运重担只要求不等于本组两面。
  const seenFaces = new Set()
  return sets.map((raw, index) => {
    if (!isPlainObject(raw)) throw new TypeError(`演武声明第 ${index + 1} 项必须是对象`)
    for (const key of Object.keys(raw)) if (!['unbrokenCode', 'brokenCode', 'burdenCode'].includes(key)) throw new TypeError(`演武声明未知字段 ${key}`)
    const unbrokenCode = assertCode(raw.unbrokenCode, 'Unbroken 面卡号')
    const brokenCode = assertCode(raw.brokenCode, 'Broken 面卡号')
    const burdenCode = assertCode(raw.burdenCode, '命运重担卡号')
    if (unbrokenCode === brokenCode) throw new TypeError('演武两面不能是同一卡号')
    for (const code of [unbrokenCode, brokenCode]) {
      if (seenFaces.has(code)) throw new TypeError(`演武卡号重复 ${code}`)
      seenFaces.add(code)
    }
    if (burdenCode === unbrokenCode || burdenCode === brokenCode) throw new TypeError('命运重担不能与演武面同号')
    return { unbrokenCode, brokenCode, burdenCode }
  })
}

export function validateEoteDisciplines(state, value = disciplineStore(state)) {
  if (value == null) return true // 旧存档没有该扩展时保持原状。
  if (!isPlainObject(value)) throw new TypeError('演武状态必须是对象')
  for (const key of Object.keys(value)) if (!['sets', 'faces', 'selected'].includes(key)) throw new TypeError(`演武状态未知字段 ${key}`)
  if (!Array.isArray(value.sets)) throw new TypeError('演武 sets 必须是数组')
  const sets = normalizeSets(value.sets)
  const byUnbroken = new Map(sets.map(set => [set.unbrokenCode, set]))
  if (!isPlainObject(value.faces || {})) throw new TypeError('演武面状态无效')
  for (const [code, face] of Object.entries(value.faces || {})) {
    if (!byUnbroken.has(code)) throw new TypeError(`演武面状态引用了未声明的演武 ${code}`)
    if (!FACES.includes(face)) throw new TypeError(`演武面状态非法 ${face}`)
  }
  if (!Array.isArray(value.selected || [])) throw new TypeError('演武选择记录必须是数组')
  for (const code of value.selected || []) {
    if (!byUnbroken.has(assertCode(code, '演武选择卡号'))) throw new TypeError(`演武选择记录引用了未声明的演武 ${code}`)
  }
  if (new Set(value.selected || []).size !== (value.selected || []).length) throw new TypeError('演武选择记录不能重复')
  return true
}

/** 初始化演武集合（每场战役一次；重复初始化视为调用错误）。 */
export function initializeDisciplines(state, { sets } = {}) {
  if (!state?.campaign || typeof state.campaign !== 'object') throw new TypeError('战役状态缺失，无法初始化演武')
  const existing = disciplineStore(state)
  if (existing && Array.isArray(existing.sets) && existing.sets.length) throw new Error('演武已经初始化')
  const normalized = normalizeSets(sets)
  const data = disciplineStore(state, true)
  data.sets = normalized
  data.faces = Object.fromEntries(normalized.map(set => [set.unbrokenCode, 'unbroken']))
  data.selected = []
  return { sets: normalized.map(set => ({ ...set })), faces: { ...data.faces }, selected: [] }
}

/** 按任一面卡号定位演武声明；未知返回 null。 */
export function disciplineSet(state, code) {
  if (typeof code !== 'string' || !code) return null
  return (disciplineStore(state)?.sets || []).find(set => set.unbrokenCode === code || set.brokenCode === code) || null
}

/** 当前面（'unbroken' | 'broken'）；未知演武返回 null。 */
export function disciplineFace(state, code) {
  const set = disciplineSet(state, code)
  if (!set) return null
  return disciplineStore(state)?.faces?.[set.unbrokenCode] || 'unbroken'
}

/** 当前面卡号（用于“视为哪张印刷面在场”的读点）；未知返回 null。 */
export function disciplineFaceCode(state, code) {
  const set = disciplineSet(state, code)
  if (!set) return null
  return disciplineFace(state, code) === 'broken' ? set.brokenCode : set.unbrokenCode
}

/** 翻面：to 缺省时在两面之间切换；返回 {code, from, to, changed}。 */
export function flipDiscipline(state, code, { to = null } = {}) {
  const set = disciplineSet(state, code)
  if (!set) throw new RangeError(`未知演武 ${code}`)
  if (to != null && !FACES.includes(to)) throw new TypeError(`非法演武面 ${to}`)
  const data = disciplineStore(state)
  const faces = data.faces ||= {}
  const from = faces[set.unbrokenCode] || 'unbroken'
  const target = to ?? (from === 'unbroken' ? 'broken' : 'unbroken')
  const targetCode = target === 'broken' ? set.brokenCode : set.unbrokenCode
  if (target === from) return { code: targetCode, from, to: target, changed: false }
  faces[set.unbrokenCode] = target
  return { code: targetCode, from, to: target, changed: true }
}

/** 演武配对的命运重担卡号；未知返回 null。 */
export function disciplineBurden(state, code) {
  return disciplineSet(state, code)?.burdenCode ?? null
}

/** 已声明演武各自的命运重担配对（构筑/幕间校验用）。 */
export function bondsOfDiscipline(state) {
  return (disciplineStore(state)?.sets || []).map(set => ({ discipline: set.unbrokenCode, burden: set.burdenCode }))
}

/**
 * 按经验选择演武：available 为可选的演武卡号（任一面卡号），count 为可选数量，
 * random 为注入的确定性随机源（() => [0,1)）。返回选中的 unbrokenCode 数组。
 */
export function selectDisciplines(state, { available, count, random } = {}) {
  const data = disciplineStore(state)
  if (!data || !Array.isArray(data.sets) || !data.sets.length) throw new Error('演武尚未初始化')
  if (!Array.isArray(available) || !available.length) throw new TypeError('可选演武必须是非空数组')
  if (!Number.isSafeInteger(count) || count < 0 || count > available.length) throw new TypeError('演武选择数量非法')
  if (typeof random !== 'function') throw new TypeError('演武选择需要注入确定性 random 函数')
  const normalized = []
  for (const code of available) {
    const set = disciplineSet(state, code)
    if (!set) throw new RangeError(`未知演武 ${code}`)
    if (!normalized.includes(set.unbrokenCode)) normalized.push(set.unbrokenCode)
  }
  if (count > normalized.length) throw new TypeError('演武选择数量超过去重后的可选项')
  if (count === 0) {
    data.selected = []
    return []
  }
  const pool = [...normalized]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  data.selected = pool.slice(0, count)
  return [...data.selected]
}
