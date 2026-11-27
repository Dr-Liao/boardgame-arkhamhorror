import { registeredEntry } from './ability.js'
import { enemyTextBlanked } from './card-text.js'
import { sourceCardDef } from './card-lookup.js'
import { nextInstanceId } from './rules-state.js'
import { hasWindowListener } from './window-listeners.js'

function damageContext(state, enemy, amount, seat, source, when) {
  return {
    when, seat, enemy, source, sourceCode: sourceCardDef(state, source)?.code ?? null,
    location: enemy.location, amount, damage: amount, windowInstance: nextInstanceId(state, 'w'),
  }
}

export function increaseEnemyDamage(context, amount) {
  if (context?.when !== 'enemyWouldTakeDamage' || context.cancelled
    || !Number.isSafeInteger(amount) || amount <= 0) return 0
  context.amount += amount
  context.damage = context.amount
  return amount
}

export function enemyDamageRedirectTarget(state, enemy) {
  return state.enemies.find(candidate => candidate !== enemy && !enemyTextBlanked(state, candidate)
    && registeredEntry(candidate.originalCode || candidate.code)?.enemyRule?.redirectDamageToSelf?.(state, candidate, enemy)) || null
}

export function adjustEnemyDamage(state, enemy, amount, seat, source, events, hooks) {
  if (amount <= 0) return 0
  if (hasWindowListener(state, 'enemyWouldTakeDamage')) {
    const context = damageContext(state, enemy, amount, seat, source, 'enemyWouldTakeDamage')
    hooks.reactionWindow(state, context.when, context, events, { allowNested: true })
    if (context.cancelled || !state.enemies.includes(enemy)) return 0
    amount = Math.max(0, context.amount)
  }
  const cap = hooks.enemyRuleFlags(enemy.originalCode || enemy.code).maxDamagePerSource
  return cap != null && !hooks.enemyTextBlanked(state, enemy) ? Math.min(cap, amount) : amount
}

export function enemyDamagePlaced(state, enemy, amount, seat, source, events, hooks) {
  if (amount <= 0 || !hasWindowListener(state, 'enemyDamagePlaced')) return
  const context = damageContext(state, enemy, amount, seat, source, 'enemyDamagePlaced')
  const health = hooks.enemyHealth(state, enemy)
  context.excess = health == null ? 0 : Math.min(amount, Math.max(0, enemy.damageTaken - health))
  hooks.reactionWindow(state, context.when, context, events, { allowNested: true })
}
