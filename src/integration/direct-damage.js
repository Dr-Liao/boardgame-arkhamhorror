import { DIRECT_DAMAGE_STYLES } from '../../content/presentation/direct-damage-styles.js'
import { currentEffectSource } from '../engine/effect-provenance.js'
import { ALL_CARDS } from '../cards/cards-data.js'
import { ATTACK_THEMES } from '../../web/attack-themes.js'

// Read provenance at the moment damage is accepted, before death/discard removes
// its source/target. Explicit hints support legacy flows outside a descriptor;
// they affect presentation only, never damage attribution or immunity rules.
export function directDamageSource(state, source, hint = {}) {
  const origin = currentEffectSource(state)
  const asset = state.investigators.flatMap(inv => inv.assets || []).find(asset => asset.id === source)
  const code = hint.code || origin?.code || state._resolvingCardCode || asset?.code
    || (typeof source === 'object' ? source?.code : source)
  const canonical = ALL_CARDS[code]?.duplicateOfCode
  const style = Object.hasOwn(ATTACK_THEMES, hint.style) ? hint.style
    : Object.hasOwn(DIRECT_DAMAGE_STYLES, code) ? DIRECT_DAMAGE_STYLES[code]
    : canonical && Object.hasOwn(DIRECT_DAMAGE_STYLES, canonical) ? DIRECT_DAMAGE_STYLES[canonical] : null
  if (!style) return null
  return { code, style, assetId: hint.assetId || origin?.sourceId || state._resolvingAssetId || asset?.id || null,
    sourceSeat: hint.sourceSeat ?? origin?.controllerSeat ?? state._resolvingSeat ?? null }
}

export function directDamageCue(state, { source, hint, seat, enemy, targetSeat, damage, tableState, cardName }) {
  const origin = directDamageSource(state, source, hint)
  if (!origin || !(damage > 0)) return null
  return { type: 'presentation', kind: 'directDamage', ...origin, seat,
    location: enemy?.location ?? state.investigators[targetSeat]?.location,
    sourceName: cardName(origin.code), damage,
    targets: [enemy ? { enemyId: enemy.id, name: enemy.name, damage }
      : { seat: targetSeat, name: state.investigators[targetSeat]?.name, damage }],
    tableState }
}
