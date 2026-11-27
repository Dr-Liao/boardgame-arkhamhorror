// 09580 大巴扎 · 地点（dealingsInTheDark）
// 拥挤店铺：从这里揭露诱饵后，把这里的一个线索移到最近的异教徒。
export default {
  code: '09580',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 3, printedClues: 1 },
  abilities: [{
    kind: 'forced', trigger: 'tskExposed',
    label: '本地点的诱饵揭露后：移动 1 个线索到最近的异教徒',
    criteria: ({ inv, source, context }) => context.seat === inv.seat
      && context.decoy === true && context.location === source.id && source.clues > 0,
    resolve: ({ state, inv, source, api }) => {
      const cultists = state.enemies.filter(enemy => !enemy.defeated && enemy.location
        && api.cardTraits(enemy.originalCode || enemy.code).some(trait => trait.toLowerCase() === 'cultist'))
      if (!cultists.length) return false
      const distances = cultists.map(enemy => api.scenario.locationDistance(inv.location || source.id, [enemy.location]))
      const nearestDistance = Math.min(...distances.filter(distance => distance >= 0))
      const nearest = nearestDistance === Infinity ? cultists
        : cultists.filter((enemy, index) => distances[index] === nearestDistance)
      const picked = nearest.length === 1 ? nearest[0].id : api.choose({
        kind: 'enemy', source: '09580', seat: inv.seat,
        prompt: '拥挤店铺：选择最近的一名异教徒，向其移动 1 个线索。',
        options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = nearest.find(candidate => candidate.id === picked)
      return enemy ? api.scenario.moveClueToEnemy(enemy, { locationId: source.id }) > 0 : false
    },
  }],
}
