import { assertFields, integer } from './mechanic-state.js'
const TREATMENT_KEYS = ['index', 'as', 'modifier', 'cancel', 'stop', 'retain', 'autoSuccess', 'toPool']
// 「视为某标记」的合法目标面：祝福／诅咒、四个剧本符号、自动失败、旧印，以及 EotE 的寒霜
// （「将本标记视为 [frost] 标记」）。只改揭示后的结算面，不改变袋内实物面。
const TREATMENT_FACES = ['bless', 'curse', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign', 'frost']
export function setTokenTreatment(state, spec) {
  assertFields(spec, TREATMENT_KEYS)
  if (!state.skillTest || !state.chaos?.frames?.length) return false
  const index = spec.index ?? state._reaction?.context?.tokenIndex ?? state.chaos.revealed.length - 1
  integer(index)
  if (index < state.chaos.frames.at(-1) || index >= state.chaos.revealed.length) return false
  if (spec.modifier != null && !Number.isFinite(spec.modifier)) throw new TypeError('标记修正必须为有限数值')
  if (spec.as != null && !TREATMENT_FACES.includes(spec.as)) throw new TypeError('无效替换符号')
  for (const key of ['cancel', 'stop', 'retain', 'autoSuccess', 'toPool']) if (spec[key] != null && typeof spec[key] !== 'boolean') throw new TypeError(`${key} 必须为布尔值`)
  state.skillTest.tokenTreatments ||= {}
  state.skillTest.tokenTreatments[index] = { ...state.skillTest.tokenTreatments[index], ...spec, index }
  return true
}
export function tokenEffect(state, token, index = state.chaos?.revealed?.length - 1) {
  const rule = state.skillTest?.tokenTreatments?.[index] || {}
  const face = rule.as || token
  const cancel = rule.cancel === true
  // 默认修正：祝福 +2、诅咒 -2、寒霜 -1（EotE：地点规则可把它改成 -3，
  // 「视为 frost」也沿用这里，例如 cultist→frost 保留标记本身修正时显式传 modifier）。
  const defaultModifier = face === 'bless' ? 2 : face === 'curse' ? -2 : face === 'frost' ? -1 : 0
  return { face, modifier: cancel ? 0 : rule.modifier ?? defaultModifier,
    drawAnother: cancel || (['bless', 'curse'].includes(face) && !rule.stop && !rule.autoSuccess),
    autoSuccess: !cancel && rule.autoSuccess === true, retain: rule.retain === true, cancelled: cancel }
}
