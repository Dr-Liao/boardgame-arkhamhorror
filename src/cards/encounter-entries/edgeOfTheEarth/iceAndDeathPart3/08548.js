// 08548 千变幻景：从最近的渗出梦魇底下随机翻出敌人；它底下没有牌时则移动并攻击。
const CODE = '08548'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const nightmares = state.enemies.filter(enemy => (enemy.originalCode || enemy.code) === '08547'
      && !enemy.defeated && !enemy.removedFromGame)
    if (!nightmares.length) return { gainSurge: true }
    const investigators = state.investigators.filter(other => !other.defeated && !other.resigned)
    const distances = nightmares.map(enemy => Math.min(...investigators.map(other => api.mechanics.map.distance(other.location, enemy.location))))
    const closest = Math.min(...distances)
    const targets = nightmares.filter((enemy, index) => distances[index] === closest)
    const id = targets.length === 1 ? targets[0].id : api.choice({
      kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择最近的渗出梦魇。',
      options: targets.map(enemy => ({ id: enemy.id, label: enemy.name, cardCode: enemy.code })),
    })
    const enemy = targets.find(candidate => candidate.id === id)
    if (!enemy) return false
    if (enemy.beneath?.some((code, index) => enemy.beneathFaceDown?.[index] !== false)) api.spawnRandomEnemyBeneath(enemy)
    else api.resolveEnemyPhaseOf(enemy, { exhaust: false })
    return false
  },
}
