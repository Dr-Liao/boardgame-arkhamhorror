// 双线结局矩阵（P3 批次 3 原语 `campaign.epilogueMatrix`）。
//
// 食梦者的终局由两条线的最后一章共同决定：A4《梦境尽头》的分歧 × B4《编织宇宙》的分歧，
// 4 × 4 = 16 段结局。这里只做**矩阵数据 + 查表 + 完整性校验**；正文与分支接线属 P8-T。
//
// 矩阵形状（由剧本内容声明，纯数据）：
//   { a: [{ id, title }], b: [{ id, title }], entries: { 'aId|bId': { title, textKey } } }
// 口径：docs/tde-migration-roadmap.md §5.2 `campaign.epilogueMatrix`；账本 batch P3-3。
//
// P2-C（EotE）扩展：`campaign.epilogue` 的第二种形状是**记录驱动的分支表**——《地球边缘》的尾声
// 由「哪几对伙伴还活着 / 肯斯勒的研究 / 丹佛斯 / 古代封印」等布尔记录共同决定，且多条可以同时成立
// （按声明顺序依次播放），不是互斥的矩阵格。形状（codes/records 全部来自剧本参数，本模块不写死）：
//
//   {
//     records: { <记录键>: 'boolean' | 'number' | 'string' | 'string[]' },  // 已知记录 → 期望类型
//     rows: [
//       { id, when: <记录条件>, title?, textKey?, section? },               // 命中即播放
//       …
//     ],
//   }
//
// `when` 只允许记录条件（record + equals/atLeast/includes，可嵌套 all/any/not），与
// `campaign-flow.js#flowCondition` 的判定语义一致；`all/any/not` 之外的条件（completed/resolution/…）
// 在注册期拒绝，避免尾声依赖未投影的运行时状态。`normalizeEpilogueBranches` 校验唯一 id 与已知记录，
// `resolveEpilogueBranches` 返回命中的行、未命中行及原因（供日志/验收解释）。
import { flowCondition } from './campaign-flow.js'

export const MATRIX_AXES = Object.freeze(['a', 'b'])
export const EPILOGUE_RECORD_TYPES = Object.freeze(['boolean', 'number', 'string', 'string[]'])
const RECORD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/

function cellKey(aId, bId) {
  if (!aId || !bId) throw new Error('结局矩阵需要两个轴的 id')
  return `${aId}|${bId}`
}

/** 矩阵是否成形（两轴非空、entries 为对象）。 */
export function isEpilogueMatrix(matrix) {
  return Boolean(matrix && Array.isArray(matrix.a) && Array.isArray(matrix.b)
    && matrix.entries && typeof matrix.entries === 'object')
}

/**
 * 完整性校验：每个格子都必须有结局；返回 `{ ok, expected, found, missing, extra }`。
 * `missing` 是 `aId|bId` 列表（顺序按 a 轴再 b 轴），由内容注册期拒绝。
 */
export function normalizeEpilogueMatrix(matrix) {
  if (!isEpilogueMatrix(matrix)) return { ok: false, expected: 0, found: 0, missing: [], extra: [], broken: true }
  const expectedKeys = []
  for (const a of matrix.a) for (const b of matrix.b) expectedKeys.push(cellKey(a.id, b.id))
  const foundKeys = Object.keys(matrix.entries)
  const missing = expectedKeys.filter(key => !foundKeys.includes(key))
  const extra = foundKeys.filter(key => !expectedKeys.includes(key))
  return {
    ok: missing.length === 0 && extra.length === 0,
    expected: expectedKeys.length,
    found: foundKeys.length,
    missing,
    extra,
    broken: false,
  }
}

/** 查表：未知组合返回 null（不抛错，便于 UI 显示「未定义」）。 */
export function epilogueFor(matrix, aId, bId) {
  if (!isEpilogueMatrix(matrix)) return null
  return matrix.entries[cellKey(aId, bId)] || null
}

/** 某条线某结局对应的全部结局（调试/验收用）。 */
export function epiloguesForA(matrix, aId) {
  if (!isEpilogueMatrix(matrix)) return []
  return matrix.b
    .map(b => ({ b: b.id, entry: epilogueFor(matrix, aId, b.id) }))
    .filter(item => Boolean(item.entry))
}

/** 把矩阵展开成扁平列表（16 条），顺序稳定：先 a 轴后 b 轴。 */
export function flattenEpilogueMatrix(matrix) {
  if (!isEpilogueMatrix(matrix)) return []
  const rows = []
  for (const a of matrix.a) {
    for (const b of matrix.b) {
      const entry = epilogueFor(matrix, a.id, b.id)
      if (entry) rows.push({ a: a.id, b: b.id, title: entry.title || null, textKey: entry.textKey || null })
    }
  }
  return rows
}

/** 反向：给一个结局 id 找它的轴坐标（用于「玩家打出了哪段」的记账）。 */
export function locateEpilogue(matrix, textKey) {
  if (!isEpilogueMatrix(matrix) || !textKey) return null
  for (const a of matrix.a) {
    for (const b of matrix.b) {
      const entry = epilogueFor(matrix, a.id, b.id)
      if (entry?.textKey === textKey) return { a: a.id, b: b.id }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 记录驱动的尾声分支表（P2-C EotE：`campaign.epilogue` 的第二种形状）
// ---------------------------------------------------------------------------

/** 是否记录驱动分支表（`{ records, rows }`）。坏形状返 false，由 normalize 报告细节。 */
export function isEpilogueBranches(table) {
  return Boolean(table && typeof table === 'object' && !Array.isArray(table)
    && Array.isArray(table.rows) && table.records && typeof table.records === 'object' && !Array.isArray(table.records))
}

function branchRecordDeclarations(records, errors) {
  const declarations = {}
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    errors.push('尾声分支缺少 records 声明（记录键 → 类型）')
    return declarations
  }
  for (const [key, type] of Object.entries(records)) {
    if (!RECORD_KEY_PATTERN.test(key) || ['constructor', 'prototype'].includes(key)) {
      errors.push(`尾声记录键不合法：${key}`)
      continue
    }
    if (!EPILOGUE_RECORD_TYPES.includes(type)) errors.push(`尾声记录 ${key} 的类型未知：${String(type)}`)
    else declarations[key] = type
  }
  if (!Object.keys(declarations).length && !errors.length) errors.push('尾声分支没有声明任何记录')
  return declarations
}

const BRANCH_CONDITION_FIELDS = Object.freeze(['all', 'any', 'not', 'record', 'equals', 'atLeast', 'includes'])

/** 尾声条件的注册期校验（只允许记录条件；返回错误消息或 null）。 */
function branchConditionError(condition, declarations) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return '条件必须是对象'
  const keys = Object.keys(condition)
  if (!keys.length) return '条件不能是空对象'
  const unknown = keys.filter(key => !BRANCH_CONDITION_FIELDS.includes(key))
  if (unknown.length) return `尾声条件只允许记录条件，未知字段 ${unknown.join('、')}`
  const combinators = ['all', 'any', 'not'].filter(key => Object.hasOwn(condition, key))
  if (combinators.length > 1) return '条件组合器 all/any/not 只能出现一个'
  if (combinators.length === 1) {
    const key = combinators[0]
    if (keys.length > 1) return `${key} 不能与其它条件字段并列`
    if (key === 'not') return branchConditionError(condition.not, declarations)
    const children = condition[key]
    if (!Array.isArray(children) || !children.length) return `${key} 必须是非空条件数组`
    for (const [index, child] of children.entries()) {
      const error = branchConditionError(child, declarations)
      if (error) return `${key}[${index}]：${error}`
    }
    return null
  }
  if (typeof condition.record !== 'string' || !condition.record) return 'record 必须是非空记录键'
  const type = declarations[condition.record]
  if (!type) return `尾声条件引用了未声明的记录 ${condition.record}`
  const operators = ['equals', 'atLeast', 'includes'].filter(key => Object.hasOwn(condition, key))
  const extra = keys.filter(key => key !== 'record' && !operators.includes(key))
  if (extra.length) return `记录条件含未知字段 ${extra.join('、')}`
  if (operators.length !== 1) return '记录条件必须且只能声明 equals/atLeast/includes 之一'
  const operator = operators[0]
  const value = condition[operator]
  if (type === 'boolean') {
    if (operator !== 'equals') return `布尔记录 ${condition.record} 只支持 equals`
    if (typeof value !== 'boolean') return `布尔记录 ${condition.record} 的 equals 必须是布尔值`
  } else if (type === 'number') {
    if (operator === 'includes') return `数值记录 ${condition.record} 不支持 includes`
    if (!Number.isFinite(value)) return `数值记录 ${condition.record} 的比较值必须是有限数值`
  } else if (type === 'string') {
    if (operator !== 'equals') return `字符串记录 ${condition.record} 只支持 equals`
    if (typeof value !== 'string') return `字符串记录 ${condition.record} 的 equals 必须是字符串`
  } else if (type === 'string[]') {
    if (operator !== 'includes') return `集合记录 ${condition.record} 只支持 includes`
    if (typeof value !== 'string' || !value) return `集合记录 ${condition.record} 的 includes 必须是非空字符串`
  }
  return null
}

/** 条件里记录叶子的读取顺序（注册期已保证形状合法；诊断/evidence 共用）。 */
function branchConditionLeaves(condition, out = []) {
  if (!condition || typeof condition !== 'object') return out
  if (Array.isArray(condition.all)) { for (const child of condition.all) branchConditionLeaves(child, out); return out }
  if (Array.isArray(condition.any)) { for (const child of condition.any) branchConditionLeaves(child, out); return out }
  if (condition.not) { branchConditionLeaves(condition.not, out); return out }
  if (typeof condition.record === 'string') {
    const operator = ['equals', 'atLeast', 'includes'].find(key => Object.hasOwn(condition, key))
    out.push({ record: condition.record, operator, value: condition[operator] })
  }
  return out
}

function branchReadRecord(campaign, key) {
  return (campaign?.records || {})[key]
}

function lemmaSatisfied(readValue, leaf) {
  if (leaf.operator === 'equals') return readValue === leaf.value
  if (leaf.operator === 'atLeast') return Number(readValue || 0) >= Number(leaf.value)
  return Array.isArray(readValue) && readValue.includes(leaf.value)
}

function describeLeaf(leaf) {
  const read = leaf.operator === 'atLeast' ? `>= ${String(leaf.value)}` : `${leaf.operator === 'includes' ? '包含' : '='} ${JSON.stringify(leaf.value)}`
  return `${leaf.record} ${read}`
}

/**
 * 完整性校验：记录键/类型、行 id 唯一、条件只引用已声明记录且类型匹配。
 * 返回 `{ ok, errors, records, rows }`（注册期由内容注册表按 `ok` 拒绝；不抛错）。
 */
export function normalizeEpilogueBranches(table) {
  const errors = []
  if (!isEpilogueBranches(table)) {
    return { ok: false, errors: ['尾声分支表必须是 { records, rows } 对象'], records: {}, rows: [] }
  }
  const records = branchRecordDeclarations(table.records, errors)
  if (!Array.isArray(table.rows) || !table.rows.length) errors.push('尾声分支表 rows 必须是非空数组')
  const ids = new Set()
  const rows = []
  for (const [index, row] of (Array.isArray(table.rows) ? table.rows : []).entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`尾声分支 rows[${index}] 必须是对象`)
      continue
    }
    if (typeof row.id !== 'string' || !row.id || !RECORD_KEY_PATTERN.test(row.id)) {
      errors.push(`尾声分支 rows[${index}] 的 id 不合法：${String(row.id)}`)
      continue
    }
    if (ids.has(row.id)) errors.push(`尾声分支 id 重复：${row.id}`)
    ids.add(row.id)
    const conditionError = branchConditionError(row.when, records)
    if (conditionError) errors.push(`尾声分支 ${row.id} 的 when：${conditionError}`)
    for (const field of ['title', 'textKey', 'section']) {
      if (row[field] != null && (typeof row[field] !== 'string' || !row[field])) errors.push(`尾声分支 ${row.id} 的 ${field} 必须是非空字符串`)
    }
    rows.push(row)
  }
  return { ok: errors.length === 0, errors, records, rows }
}

/** 把分支表压成扁平列表（`[{ id, title, textKey, section }]`，顺序稳定，供 UI/验收用）。 */
export function flattenEpilogueBranches(table) {
  if (!isEpilogueBranches(table)) return []
  return table.rows
    .filter(row => row && typeof row.id === 'string')
    .map(row => ({ id: row.id, title: row.title || null, textKey: row.textKey || null, section: row.section || null }))
}

/**
 * 求值：按声明顺序返回命中的分支（多条可同时成立），未命中的行给出原因。
 * 返回 `{ ok, branches, skipped, errors, broken }`：
 *   · `ok=false`（表不合法）时 `branches` 为空——失败关闭，不播放可疑尾声；
 *   · `branches[].evidence` 是命中的记录叶子（`{ record, value }`），便于日志与验收解释。
 */
export function resolveEpilogueBranches(table, campaign) {
  if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) throw new TypeError('resolveEpilogueBranches 需要战役状态')
  const normalized = normalizeEpilogueBranches(table)
  if (!normalized.ok) {
    return { ok: false, broken: !isEpilogueBranches(table), branches: [], skipped: [], errors: normalized.errors }
  }
  const branches = []
  const skipped = []
  for (const row of normalized.rows) {
    if (flowCondition(row.when, campaign)) {
      const evidence = branchConditionLeaves(row.when).map(leaf => ({ record: leaf.record, value: branchReadRecord(campaign, leaf.record) }))
      branches.push({
        id: row.id,
        title: row.title || null,
        textKey: row.textKey || null,
        section: row.section || null,
        evidence,
      })
    } else {
      const failing = branchConditionLeaves(row.when).find(leaf => !lemmaSatisfied(branchReadRecord(campaign, leaf.record), leaf))
      skipped.push({
        id: row.id,
        reason: failing
          ? `记录 ${describeLeaf(failing)} 不满足（当前 ${JSON.stringify(branchReadRecord(campaign, failing.record))}）`
          : '记录条件不满足',
      })
    }
  }
  return { ok: true, broken: false, branches, skipped, errors: [] }
}
