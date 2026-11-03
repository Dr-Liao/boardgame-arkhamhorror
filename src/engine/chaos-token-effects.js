import { assertFields, integer } from './mechanic-state.js'
const TREATMENT_KEYS = ['index', 'as', 'modifier', 'cancel', 'stop', 'retain', 'autoSuccess', 'toPool']
export function setTokenTreatment(state, spec) {
  assertFields(spec, TREATMENT_KEYS)
  if (!state.skillTest || !state.chaos?.frames?.length) return false
  const index = spec.index ?? state._reaction?.context?.tokenIndex ?? state.chaos.revealed.length - 1
  integer(index)
  if (index < state.chaos.frames.at(-1) || index >= state.chaos.revealed.length) return false
  if (spec.modifier != null && !Number.isFinite(spec.modifier)) throw new TypeError('标记修正必须为有限数值')
  if (spec.as != null && !['bless', 'curse', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign'].includes(spec.as)) throw new TypeError('无效替换符号')
  for (const key of ['cancel', 'stop', 'retain', 'autoSuccess', 'toPool']) if (spec[key] != null && typeof spec[key] !== 'boolean') throw new TypeError(`${key} 必须为布尔值`)
  state.skillTest.tokenTreatments ||= {}
  state.skillTest.tokenTreatments[index] = { ...state.skillTest.tokenTreatments[index], ...spec, index }
  return true
}
export function tokenEffect(state, token, index = state.chaos?.revealed?.length - 1) {
  const rule = state.skillTest?.tokenTreatments?.[index] || {}
  const face = rule.as || token
  const cancel = rule.cancel === true
  return { face, modifier: cancel ? 0 : rule.modifier ?? (face === 'bless' ? 2 : face === 'curse' ? -2 : 0),
    drawAnother: cancel || (['bless', 'curse'].includes(face) && !rule.stop && !rule.autoSuccess),
    autoSuccess: !cancel && rule.autoSuccess === true, retain: rule.retain === true, cancelled: cancel }
}
