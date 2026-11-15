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
