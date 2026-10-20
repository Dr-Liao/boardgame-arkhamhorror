// Phase 1（A1）：state.effects[] 进入存档结构，schemaVersion 6 → 7；
// 同时把规则版本推到 n6.0（临时修正的结算方式变了，旧对局必须迁移而不是续算）。
export const STATE_SCHEMA_VERSION = 7
export const RULES_VERSION = 'n6.0'

// 印刷生命值（含「每逢调查员」印刷值）。剧本的常驻修正走 behavior 钩子；
// 卡牌的声明式修正（例如 02255「文本空白时按人数减少」）由 engine 的修正管线
// （modifiers.enemyHealthDelta）叠加，本函数只负责印刷值。
export function enemyHealthValue(state, enemy, behavior = null) {
  const modifier = behavior?.enemyStatModifier?.(state, enemy, 'health') || 0
  return Math.max(0, (enemy.health || 0) + modifier)
}

export function randomValue(state) {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0
  let value = state.rngState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function nextInstanceId(state, kind) {
  const next = (state.instanceSeq[kind] || 0) + 1
  if (!Number.isSafeInteger(next)) throw new Error('实例序号超出安全范围')
  state.instanceSeq[kind] = next
  return kind + next
}

export function doomCards(state) {
  return [...state.enemies, ...state.locations, ...state.investigators.flatMap(inv => [...inv.assets, ...inv.threat])]
}

// Doom on the current agenda is the only doom that counts toward the agenda's
// doom threshold (Rules Reference, "Agenda"). Doom sitting on enemies, locations
// and assets is a separate pool: it is not cleared when an agenda advances and it
// only matters where a card/token explicitly looks at it (e.g. the Midnight Masks
// [skull] token or "total doom in play" on hard/expert).
export function agendaDoom(state) {
  return state.doom || 0
}

// Every doom marker in play, agenda included. Used by card/token effects that
// literally count "doom in play", never by the agenda threshold check.
export function totalDoom(state) {
  return agendaDoom(state) + doomCards(state).reduce((sum, card) => sum + (card.doom || 0), 0)
}

export function stateCompatibilityError(state, resourceVersion) {
  if (state.schemaVersion !== STATE_SCHEMA_VERSION || state.rulesVersion !== RULES_VERSION) return '对局规则版本不兼容，请重新开局'
  if (state.resourceVersion !== resourceVersion) return '对局资源版本不兼容，请重新开局'
  return null
}
