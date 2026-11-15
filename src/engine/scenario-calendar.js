import { assertFields, integer, locationAt, mechanicState } from './mechanic-state.js'

const periods = ['day', 'night']
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const id = value => {
  if (typeof value !== 'string' || !identifier.test(value) || ['constructor', 'prototype', '__proto__'].includes(value)) {
    throw new TypeError('无效剧本标识')
  }
  return value
}
const strings = value => {
  if (!Array.isArray(value) || new Set(value).size !== value.length) throw new TypeError('剧本标识必须为无重复列表')
  return value.map(id)
}

// Persist only the active date and resolved entry keys. Branch definitions and text stay in content.
export function normalizeScenarioCalendar(spec) {
  if (spec == null) return null
  assertFields(spec, ['maximumDay', 'record', 'periodByLocationTrait'])
  integer(spec.maximumDay, 1)
  if (spec.record != null) id(spec.record)
  if (spec.periodByLocationTrait != null && (typeof spec.periodByLocationTrait !== 'string' || !spec.periodByLocationTrait.trim())) {
    throw new TypeError('昼夜覆盖需要有效地点特质')
  }
  return structuredClone(spec)
}

export function setScenarioDate(state, day, period) {
  const spec = normalizeScenarioCalendar(state.scenario?.mechanics?.calendar)
  if (!spec || integer(day, 1) > spec.maximumDay || !periods.includes(period)) throw new TypeError('无效剧本日期')
  const date = { day, period }
  mechanicState(state, true).scenarioDate = date
  if (spec.record) {
    state.campaign.records ||= {}
    state.campaign.records[spec.record] = `${day}:${period}`
  }
  return { ...date }
}

export function scenarioDate(state) {
  const date = mechanicState(state)?.scenarioDate
  if (date) return { ...date }
  const record = state.scenario?.mechanics?.calendar?.record
  const raw = record && state.campaign?.records?.[record]
  const [day, period] = typeof raw === 'string' ? raw.split(':') : []
  const n = Number(day)
  return Number.isSafeInteger(n) && n > 0 && n <= state.scenario.mechanics.calendar.maximumDay && periods.includes(period)
    ? { day: n, period } : null
}

export function scenarioPeriod(state, locationId = null) {
  const date = scenarioDate(state)
  if (!date) return null
  const trait = state.scenario?.mechanics?.calendar?.periodByLocationTrait
  if (!trait || locationId == null) return date.period
  const location = locationAt(state, locationId)
  return location.traits?.some(value => value.toLowerCase() === trait.toLowerCase()) ? 'night' : 'day'
}

export function normalizeCodex(spec) {
  if (spec == null) return null
  if (!Array.isArray(spec)) throw new TypeError('法典必须为条目数组')
  strings(spec.map(entry => entry?.id))
  for (const entry of spec) {
    assertFields(entry, ['id', 'limit', 'resident', 'branches'])
    if (entry.limit != null && !['scenario', 'act', 'unlimited'].includes(entry.limit)) throw new TypeError('无效法典限制')
    if (entry.resident != null) {
      assertFields(entry.resident, ['relationship', 'notes', 'crossedOut'])
      for (const value of Object.values(entry.resident)) id(value)
      if (!entry.resident.relationship || !entry.resident.notes || !entry.resident.crossedOut) throw new TypeError('居民法典缺少记录键')
    }
    if (!Array.isArray(entry.branches) || !entry.branches.length) throw new TypeError('法典条目需要分支')
    strings(entry.branches.map(branch => branch?.id))
    for (const branch of entry.branches) {
      assertFields(branch, ['id', 'minRelationship', 'maxRelationship', 'notes', 'withoutNotes'])
      if (branch.minRelationship != null) integer(branch.minRelationship)
      if (branch.maxRelationship != null) integer(branch.maxRelationship, branch.minRelationship ?? 0)
      if (branch.notes != null) strings(branch.notes)
      if (branch.withoutNotes != null) strings(branch.withoutNotes)
      if (!entry.resident && Object.keys(branch).length > 1) throw new TypeError('法典分支条件需要居民记录')
    }
  }
  return structuredClone(spec)
}

function codexSelection(state, entryId) {
  const entry = state.scenario?.mechanics?.codex?.find(row => row.id === entryId)
  if (!entry) return null
  const records = state.campaign?.records || {}
  const { relationship, notes: notesKey, crossedOut } = entry.resident || {}
  if (crossedOut && records[crossedOut]) return null
  const level = records[relationship] ?? 0
  const notes = records[notesKey] ?? []
  const branch = entry.branches.find(row => level >= (row.minRelationship ?? 0) && level <= (row.maxRelationship ?? Infinity)
    && (row.notes || []).every(note => notes.includes(note)) && (row.withoutNotes || []).every(note => !notes.includes(note)))
  if (!branch) return null
  const key = entry.limit === 'unlimited' ? null : entry.limit === 'act' ? `${entryId}:${state.actIndex ?? 0}` : entryId
  if (key && mechanicState(state)?.resolvedCodex?.includes(key)) return null
  return { branch: branch.id, key }
}

export const canResolveCodex = (state, entryId) => codexSelection(state, entryId) != null

export function resolveCodex(state, entryId, seat, resolve) {
  const selection = codexSelection(state, entryId)
  if (!selection) return false
  const actor = seat ?? state.campaign?.leadSeat
  if (!state.investigators?.[actor] || typeof resolve !== 'function') throw new TypeError('法典需要有效触发者和结算器')
  if (selection.key) {
    const data = mechanicState(state, true)
    data.resolvedCodex = [...(data.resolvedCodex || []), selection.key]
  }
  try {
    // Caller enters after its existing ability cost pipeline completes.
    resolve({ entry: entryId, branch: selection.branch, seat: actor })
  } catch (error) {
    if (selection.key) {
      const data = mechanicState(state)
      data.resolvedCodex = data.resolvedCodex.filter(key => key !== selection.key)
    }
    throw error
  }
  return true
}

export function validateCalendarSave(state, data) {
  if (data.scenarioDate != null) {
    const spec = normalizeScenarioCalendar(state.scenario?.mechanics?.calendar)
    const value = assertFields(data.scenarioDate, ['day', 'period'])
    if (!spec || integer(value.day, 1) > spec.maximumDay || !periods.includes(value.period)) throw new TypeError('无效存档剧本日期')
  }
  if (data.resolvedCodex != null) {
    const entries = state.scenario?.mechanics?.codex || []
    const seen = new Set(data.resolvedCodex)
    if (!Array.isArray(data.resolvedCodex) || seen.size !== data.resolvedCodex.length
      || data.resolvedCodex.some(key => typeof key !== 'string' || !entries.some(entry => entry.limit !== 'unlimited'
        && (entry.limit === 'act' ? key.startsWith(`${entry.id}:`) && /^\d+$/.test(key.split(':')[1]) : key === entry.id)))) {
      throw new TypeError('无效存档法典记录')
    }
  }
}
