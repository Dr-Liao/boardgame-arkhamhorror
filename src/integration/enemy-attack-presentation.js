import { ENEMY_ATTACK_STYLES } from '../../content/presentation/enemy-attack-styles.js'
import { ENEMY_ATTACK_GROUPS, ENEMY_ATTACK_FAMILIES } from '../../web/enemy-attack-themes.js'

// Context identity is process-local. It never enters a save, a rule window or a
// replay fingerprint. Nested reactions cannot inherit the parent's harm cue.
const origins = new WeakMap()
export function enemyAttackStyle(enemy, code = enemy.originalCode || enemy.code) {
  const role = enemy.scenarioEnemyRole
  const profile = role === 'nyarlathotepTrueShape' ? { group:'psychic', family:'nyarlathotep', variant:'trueShape' }
    : enemy.code === 'flyingPolyp' ? { group:'flying' }
    : enemy.code === 'xreanimated' ? { group:'melee' }
    : ENEMY_ATTACK_STYLES[code] || ENEMY_ATTACK_STYLES[enemy.code] || { group:'uncertain', provisional:true }
  return { attackStyle: Object.hasOwn(ENEMY_ATTACK_GROUPS, profile.group) ? profile.group : 'uncertain',
    ...(Object.hasOwn(ENEMY_ATTACK_FAMILIES, profile.family) ? { enemyFamily:profile.family } : {}),
    ...(profile.variant ? { enemyVariant:profile.variant } : {}),
    ...(profile.provisional ? { provisional:true } : {}) }
}
export function tagAttackHarm(context, origin) { origins.set(context, origin); return context }
export function attackHarmOrigin(context) { return context && origins.get(context) }
