import { assertFields, integer, locationAt, mechanicState } from './mechanic-state.js'
import { barrierCount, changeBarrierCount } from './edge-barriers.js'

const types = ['decoy', 'trap']

export function placeLocationDefense(state, type, id) {
  if (!types.includes(type)) throw new TypeError('未知防御工事')
  if (!state.scenario?.mechanics?.defenses) return false
  if (locationAt(state, id).noLocationDefenses === true) return false
  const data = mechanicState(state, true)
  const defense = data.defenses ||= { decoy: [], trap: [], cannotReady: {} }
  if (defense[type].includes(id)) return false
  defense[type].push(id)
  return true
}

export function blockKeywordMove(state, enemy, to, cause, ignored) {
  if (!state.scenario?.mechanics?.defenses || !['hunter', 'patrol'].includes(cause) || ignored.includes('barrier')) return false
  if (!barrierCount(state, enemy.location, to)) return false
  changeBarrierCount(state, enemy.location, to, -1, { setup: true })
  return true
}

export function applyLocationDefenses(state, enemy, ignored, deps) {
  if (!state.scenario?.mechanics?.defenses) return
  const defense = mechanicState(state)?.defenses
  if (!defense) return
  const arrival = enemy.location
  const pending = types.filter(type => !ignored.includes(type) && defense[type].includes(arrival))
  while (pending.length && state.enemies.includes(enemy) && enemy.location === arrival) {
    const type = pending.length === 1 ? pending[0] : deps.choose(pending)
    if (!pending.includes(type)) throw new RangeError('无效工事结算顺序')
    pending.splice(pending.indexOf(type), 1)
    const index = defense[type].indexOf(arrival)
    if (index < 0) continue
    defense[type].splice(index, 1)
    if (type === 'decoy') {
      deps.disengage(enemy)
      deps.exhaust(enemy)
      defense.cannotReady[enemy.id] = state.round
    }
    deps.damage(enemy, type === 'decoy' ? 1 : 2)
  }
}

export function defensePreventsReady(state, enemy) {
  return state.scenario?.mechanics?.defenses === true && mechanicState(state)?.defenses?.cannotReady[enemy.id] === state.round
}

export function validateLocationDefenses(state, value) {
  if (value == null) return
  assertFields(value, [...types, 'cannotReady'])
  for (const type of types) {
    const ids = value[type]
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new TypeError('无效存档地点工事')
    for (const id of ids) locationAt(state, id)
  }
  if (!value.cannotReady || typeof value.cannotReady !== 'object' || Array.isArray(value.cannotReady)) throw new TypeError('无效存档重整限制')
  for (const round of Object.values(value.cannotReady)) integer(round)
}
