import { DIRECT_DAMAGE_STYLES } from '../../content/presentation/direct-damage-styles.js'
import { CARD_DAMAGE_HARM_CODES, CARD_DAMAGE_STYLES, CARD_DAMAGE_SOURCE_ALIASES } from '../../content/presentation/card-damage-styles.js'
import { currentEffectSource } from '../engine/effect-provenance.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { ATTACK_THEMES } from '../../web/attack-themes.js'

const presentationFrames = new WeakMap()

// Legacy skills and elder signs can run without a card descriptor frame.
export function withDirectDamageHint(state, hint, resolve) {
  if (!hint) return resolve()
  const previous = presentationFrames.get(state)
  presentationFrames.set(state, { hint, origin: currentEffectSource(state), code: state._resolvingCardCode })
  try {
    return resolve()
  } finally {
    if (previous) presentationFrames.set(state, previous)
    else presentationFrames.delete(state)
  }
}

const configuredStyle = (styles, code) => Object.hasOwn(styles, code) ? styles[code] : null
const addedStyle = code => configuredStyle(CARD_DAMAGE_STYLES, code)
const existingStyle = code => configuredStyle(DIRECT_DAMAGE_STYLES, code)
function styleFor(code) {
  const canonical = ALL_CARDS[code]?.duplicateOfCode
  return existingStyle(code) || addedStyle(code) || existingStyle(canonical) || addedStyle(canonical)
}

// Read provenance at the moment damage is accepted, before death/discard removes
// its source/target. Explicit hints support legacy flows outside a descriptor;
// they affect presentation only, never damage attribution or immunity rules.
export function directDamageSource(state, source, hint = {}) {
  const origin = currentEffectSource(state)
  const frame = presentationFrames.get(state)
  if (frame && frame.origin === origin && frame.code === state._resolvingCardCode) hint = { ...frame.hint, ...hint }
  const sourceId = typeof source === 'object' ? source?.id : source
  const asset = state.investigators.flatMap(inv => inv.assets || []).find(asset => asset.id === sourceId)
  const resolvedCode = origin?.kind === 'scenarioRule' ? null : origin?.code || state._resolvingCardCode
  const explicitCode = typeof source === 'object' ? source?.originalCode || source?.code : source
  const candidate = hint.code || [resolvedCode, asset?.code, explicitCode].find(styleFor)
    || resolvedCode || asset?.code || explicitCode
  const code = configuredStyle(CARD_DAMAGE_SOURCE_ALIASES, candidate) || candidate
  const style = Object.hasOwn(ATTACK_THEMES, hint.style) ? hint.style : styleFor(code)
  if (!style) return null
  const newAudio = addedStyle(code) || addedStyle(ALL_CARDS[code]?.duplicateOfCode)
  const matchingFrame = code === resolvedCode
  const instanceId = hint.assetId || hint.sourceEnemyId || (matchingFrame ? origin?.sourceId || state._resolvingAssetId : null) || asset?.id
  const enemySource = ['enemy', 'enemy_location'].includes(ALL_CARDS[code]?.type)
  const sourceEnemy = enemySource && (state.enemies || []).find(enemy => instanceId
    ? enemy.id === instanceId : (enemy.originalCode || enemy.code) === code)
  return { code, style, assetId: enemySource ? null : instanceId || null,
    ...(enemySource ? { sourceEnemyId: hint.sourceEnemyId || sourceEnemy?.id || null } : {}),
    ...(newAudio || hint.audio === 'cardDamage' ? { audio: 'cardDamage' } : {}),
    sourceSeat: hint.sourceSeat ?? (matchingFrame ? origin?.controllerSeat ?? state._resolvingSeat : null) ?? null }
}

export function directDamageCue(origin, { seat, location, targets, tableState, cardName }) {
  return { type: 'presentation', kind: 'directDamage', ...origin, seat, location, targets, tableState,
    sourceName: cardName(origin.code), damage: targets.reduce((total, target) => total + target.damage, 0) }
}

export function cardHarmSource(state, hint) {
  const source = directDamageSource(state, null, hint ?? undefined)
  if (!source) return null
  const canonical = ALL_CARDS[source.code]?.duplicateOfCode
  if (source.style === 'blast' || Object.hasOwn(source, 'sourceEnemyId')
    || CARD_DAMAGE_HARM_CODES.has(source.code) || CARD_DAMAGE_HARM_CODES.has(canonical)) return source
  return null
}
