export const enemyIsPart = enemy => typeof enemy?.partOf === 'string'
export const enemyIsBody = enemy => enemy?.hasParts === true

export function enemyParts(state, body) {
  return enemyIsBody(body) ? state.enemies.filter(enemy => enemy.partOf === body.id) : []
}

export function enemyBody(state, enemy) {
  return enemyIsPart(enemy) ? state.enemies.find(body => body.id === enemy.partOf) : enemy
}

export function enemyInEngagement(state, enemy, investigator) {
  const body = enemyBody(state, enemy)
  if (enemyIsPart(enemy) && body?.massive && body.exhausted) return false
  return !!body && (body.engagedSeat === investigator.seat || (body.massive && body.location === investigator.location))
}

export function enemyCombatTargets(state, enemy) {
  return enemyIsBody(enemy) ? enemyParts(state, enemy) : [enemy]
}

export function setEnemyPosition(state, enemy, location) {
  enemy.location = location
  for (const part of enemyParts(state, enemy)) part.location = location
}

export function linkEnemyParts(state, bodyId, partIds) {
  if (typeof bodyId !== 'string' || !bodyId || !Array.isArray(partIds) || !partIds.length
    || partIds.some(id => typeof id !== 'string' || !id) || new Set(partIds).size !== partIds.length || partIds.includes(bodyId)) {
    throw new TypeError('无效的多部位敌人声明')
  }
  const body = state.enemies.find(enemy => enemy.id === bodyId)
  const parts = partIds.map(id => state.enemies.find(enemy => enemy.id === id))
  const separate = enemy => enemy && !enemyIsPart(enemy) && !enemyIsBody(enemy)
    && !enemy.hostId && !enemy.swarmCards?.length && !enemy.enemyLocation
  if (!separate(body) || !state.locations.some(location => location.id === body.location)
    || parts.some(part => !separate(part) || part.location !== body.location || part.engagedSeat != null
      || state.investigators.some(inv => inv.engaged?.includes(part.id)))) return false
  body.hasParts = true
  for (const part of parts) part.partOf = body.id
  return true
}

export function validateEnemyParts(state) {
  const enemies = state.enemies || []
  for (const enemy of enemies) {
    if (!Object.hasOwn(enemy, 'hasParts') && !Object.hasOwn(enemy, 'partOf')) continue
    if (enemy.hostId || enemy.swarmCards?.length || enemy.enemyLocation) throw new TypeError('多部位敌人不能同时使用其他组合结构')
    if (Object.hasOwn(enemy, 'hasParts') && (!enemyIsBody(enemy) || Object.hasOwn(enemy, 'partOf'))) {
      throw new TypeError('无效的多部位敌人主体')
    }
    if (!Object.hasOwn(enemy, 'partOf')) continue
    const body = enemyBody(state, enemy)
    if (!enemyIsPart(enemy) || !enemyIsBody(body) || body === enemy || body.location !== enemy.location
      || enemy.engagedSeat != null || (state.investigators || []).some(inv => inv.engaged?.includes(enemy.id))) {
      throw new TypeError('无效的敌人部位存档')
    }
  }
}
