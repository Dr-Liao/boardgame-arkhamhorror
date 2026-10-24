// 调查员级「某类敌人不与你交战/不攻击你」被动读点（无副作用、无依赖的叶子模块）。
//
// 失落的时代 04325b/04326b（伊格的宽恕 / 另有他法）的参考实现给每位调查员挂
// CannotBeEngagedBy / CannotBeAttackedBy（按敌人特性）。这里用调查员实例字段
// `enemyPassiveTraits`（字符串数组，大小写不敏感）表示这类被动，由内容层写入，
// 引擎在「交战」「敌人攻击」两处读取。
export function traitKey(value) {
  return String(value ?? '').toLowerCase()
}

export function enemyHasTrait(enemy, trait) {
  const wanted = traitKey(trait)
  return (enemy?.traits || []).some(item => traitKey(item) === wanted)
}

export function investigatorHasEnemyPassiveTrait(inv, trait) {
  const wanted = traitKey(trait)
  return (inv?.enemyPassiveTraits || []).some(item => traitKey(item) === wanted)
}

export function enemyIgnoresInvestigator(state, inv, enemy) {
  if (!inv || !enemy) return false
  const passives = inv.enemyPassiveTraits || []
  if (!passives.length) return false
  return enemyHasTrait(enemy, passives)
}

export function grantEnemyPassiveTrait(state, trait, { investigators = null } = {}) {
  const targets = investigators || state?.investigators || []
  const wanted = traitKey(trait)
  for (const inv of targets) {
    if (!inv) continue
    inv.enemyPassiveTraits ||= []
    if (!investigatorHasEnemyPassiveTrait(inv, wanted)) inv.enemyPassiveTraits.push(String(trait))
    for (const enemy of (state?.enemies || []).filter(item => item.engagedSeat === inv.seat && enemyHasTrait(item, wanted))) {
      enemy.engagedSeat = null
      inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
    }
  }
  for (const enemy of (state?.enemies || []).filter(item => enemyHasTrait(item, wanted))) {
    if (enemy.engagedSeat == null) continue
    const holder = state.investigators[enemy.engagedSeat]
    if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
    enemy.engagedSeat = null
  }
}
