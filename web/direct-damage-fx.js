import { attackChoreography } from './attack-fx.js'
import { ATTACK_THEMES } from './attack-themes.js'

// Direct damage has no new test, miss, or action. Reuse strike geometry and add
// a short, legible impact/amount. Styles are public presentation data only.
export function directDamageChoreography(style, geometry) {
  const { node, start, end, damage } = geometry
  const base = { firearm: 'firearm', ambush: 'blade', arcane: 'spell', curse: 'spell', flash: 'spell', redirect: 'spell' }[style] || 'default'
  const plan = attackChoreography(Object.hasOwn(ATTACK_THEMES, style) ? style : base, geometry)
  const marker = node('div', `ah-direct-mark is-${style}`)
  Object.assign(marker.style, { left: end.x + 'px', top: end.y + 'px' })
  const amount = node('div', 'ah-direct-number', `−${damage}`)
  Object.assign(amount.style, { left: end.x + 'px', top: end.y + 'px' })
  const sourceRing = node('div', 'ah-direct-source')
  Object.assign(sourceRing.style, { left: start.x + 'px', top: start.y + 'px' })
  const hitSample = { impact: 'directImpact', bite: 'directBite', glass: 'directGlass', arcane: 'directArcane', curse: 'directArcane', flash: 'directArcane', redirect: 'directArcane' }[style]
  return {
    ...plan, style,
    elements: [...plan.elements, sourceRing, marker, amount],
    impactSound: hitSample ? { sample: hitSample } : plan.impactSound,
    strike: source => [...plan.strike(source), [sourceRing, [{ scale: '.5', opacity: 0 }, { scale: '1.1', opacity: .9, offset: .3 }, { scale: '1.4', opacity: 0 }], 300]],
    impact: target => [...plan.impact(target),
      [marker, [{ scale: '.4', rotate: '-15deg', opacity: 0 }, { scale: '1', rotate: '0deg', opacity: 1, offset: .25 }, { scale: '1.3', opacity: 0 }], 430],
      [amount, [{ translate: '-50% -30%', opacity: 0 }, { translate: '-50% -70%', opacity: 1, offset: .2 }, { translate: '-50% -140%', opacity: 0 }], 750]],
  }
}
