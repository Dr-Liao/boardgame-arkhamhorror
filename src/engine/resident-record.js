import { assertFields, integer } from './mechanic-state.js'
import { recordSetAdd, recordSetRemove, recordSetValues } from '../campaign/record-sets.js'

export function normalizeResidentRecord(spec) {
  assertFields(spec, ['level', 'notes', 'crossedOut', 'max'])
  const keys = [spec.level, spec.notes, spec.crossedOut]
  if (new Set(keys).size !== 3 || keys.some(key => typeof key !== 'string' || !/^[a-zA-Z][\w-]*$/.test(key)
    || ['constructor', 'prototype'].includes(key))) throw new TypeError('无效居民记录键')
  integer(spec.max, 1)
  return spec
}

export function residentStatus(campaign, raw) {
  const spec = normalizeResidentRecord(raw)
  const records = campaign.records || {}
  const level = records[spec.level] ?? 0
  if (integer(level) > spec.max) throw new RangeError('居民关系超过上限')
  const crossedOut = records[spec.crossedOut] === true
  return { level, crossedOut, notes: crossedOut ? [] : recordSetValues(campaign, spec.notes) }
}

export function changeRelationship(campaign, raw, delta, { reset = false } = {}) {
  if (!Number.isSafeInteger(delta) || typeof reset !== 'boolean') throw new TypeError('无效关系等级调整')
  const spec = normalizeResidentRecord(raw)
  const { level, crossedOut } = residentStatus(campaign, spec)
  if (crossedOut) return false
  const next = reset ? 0 : Math.max(0, Math.min(spec.max, level + delta))
  if (next !== level) (campaign.records ||= {})[spec.level] = next
  return next
}

export function changeResidentNote(campaign, raw, note, remove = false) {
  const spec = normalizeResidentRecord(raw)
  if (residentStatus(campaign, spec).crossedOut) return false
  return remove ? recordSetRemove(campaign, spec.notes, note) : recordSetAdd(campaign, spec.notes, note)
}

export function crossOutResident(campaign, raw) {
  const spec = normalizeResidentRecord(raw)
  if (residentStatus(campaign, spec).crossedOut) return false
  const records = campaign.records ||= {}
  records[spec.crossedOut] = true
  return true
}

// P4：场景声明的居民清单（内容层给 id 与记录键；引擎只保存与校验，不写居民名）。
// 形状 [{ id, name, nameEn?, record: { level, notes, crossedOut, max } }]；记录键跨居民唯一，
// 保证投影与关系增减不会写到同一个战役记录。声明位置：`scenarioFlags.mechanics.residents`。
const residentId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
export function normalizeResidentList(spec) {
  if (spec == null) return null
  if (!Array.isArray(spec) || !spec.length) throw new TypeError('居民清单必须为非空数组')
  const ids = new Set()
  const keys = new Set()
  for (const entry of spec) {
    assertFields(entry, ['id', 'name', 'nameEn', 'record'])
    if (typeof entry.id !== 'string' || !residentId.test(entry.id) || ids.has(entry.id)
      || ['constructor', 'prototype', '__proto__'].includes(entry.id)) throw new TypeError('无效居民 id')
    ids.add(entry.id)
    if (typeof entry.name !== 'string' || !entry.name.trim()) throw new TypeError('居民缺少名称')
    if (entry.nameEn != null && (typeof entry.nameEn !== 'string' || !entry.nameEn.trim())) throw new TypeError('无效居民英文名')
    const record = normalizeResidentRecord(entry.record)
    for (const key of [record.level, record.notes, record.crossedOut]) {
      if (keys.has(key)) throw new TypeError('居民记录键重复')
      keys.add(key)
    }
  }
  return structuredClone(spec)
}

