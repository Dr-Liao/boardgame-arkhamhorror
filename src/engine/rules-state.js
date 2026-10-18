export const STATE_SCHEMA_VERSION = 6
export const RULES_VERSION = 'n5.5'

export function enemyHealthValue(state, enemy) {
  const blank = enemy.textBlanked
  return enemy.health - (enemy.code === '02255' && blank?.round === state.round && blank.phase === state.phase ? state.numInvestigators : 0)
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
