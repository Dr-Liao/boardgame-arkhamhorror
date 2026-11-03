import { KEY_COLORS, transferKey } from './scenario-keys.js'
import { mechanicState } from './mechanic-state.js'

export function validateKeyCost(spec) {
  if (spec == null) return
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)
    || Object.keys(spec).some(key => !['colors', 'scope', 'destination'].includes(key))
    || !Array.isArray(spec.colors) || !spec.colors.length || new Set(spec.colors).size !== spec.colors.length
    || spec.colors.some(color => !KEY_COLORS.includes(color))
    || spec.scope != null && !['self', 'here', 'anywhere'].includes(spec.scope)
    || spec.destination != null && !['reference', 'source'].includes(spec.destination)) throw new TypeError('Invalid additional key cost')
}

function destinationHolder(state, source, spec) {
  if (spec.destination !== 'source') return 'reference'
  if (!source?.id) return null
  if (state.locations.some(loc => loc.id === source.id)) return `location:${source.id}`
  if (state.enemies.some(enemy => enemy.id === source.id)) return `enemy:${source.id}`
  if ([...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])].some(asset => asset.id === source.id)) return `asset:${source.id}`
  return null
}

export function keyCostCandidates(state, inv, source, spec) {
  if (!spec || !destinationHolder(state, source, spec)) return []
  const holders = new Map(state.investigators.filter(other => !other.defeated && !other.resigned
    && (spec.scope === 'anywhere' || (spec.scope === 'here' ? other.location === inv.location : other.seat === inv.seat)))
    .map(other => [`investigator:${other.seat}`, other]))
  return Object.entries(mechanicState(state)?.keys || {}).filter(([color, key]) => spec.colors.includes(color) && holders.has(key.holder))
    .map(([color, key]) => ({ color, holder: key.holder, seat: holders.get(key.holder).seat }))
}

export function keyCostAvailable(state, inv, source, spec) {
  return !spec || keyCostCandidates(state, inv, source, spec).length > 0
}

export function payKeyCost(state, inv, source, spec, select) {
  if (!spec) return true
  const candidates = keyCostCandidates(state, inv, source, spec)
  if (!candidates.length) return false
  const selected = candidates.length === 1 ? candidates[0] : select({ operation: 'spendKey', optional: false,
    stage: 'cost', source: source?.id, prompt: '选择支付的钥匙', min: 1, max: 1,
    candidates: candidates.map(candidate => ({ value: candidate, keyColor: candidate.color,
      label: `${candidate.color} · ${state.investigators[candidate.seat].name}` })) })?.[0]
  if (!selected || !keyCostCandidates(state, inv, source, spec).some(candidate => candidate.color === selected.color && candidate.holder === selected.holder)) return false
  return transferKey(state, selected.color, selected.holder, destinationHolder(state, source, spec), { reveal: true })
}
