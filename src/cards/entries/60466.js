// 60466 精神魅惑（Spiritual Charm，Marie Lambeau）
// 卡面：谈判。选择你所在地点或一个连接地点的一个非[[精英]]敌人。
//       将该敌人移动到你的所在地点，与你交战，并获得等于其伤害值与恐惧值之和的资源。
export default {
  code: '60466',
  abilities: [{
    kind: 'played',
    actionKind: 'parley',
    countsAs: 'parley',
    label: '谈判：把 1 个非精英敌人移到这里并交战，获得其伤害+恐惧值资源',
    resolve: ({ state, inv, api }) => {
      const local = state.locations.find(item => item.id === inv.location)
      const nearby = new Set([inv.location, ...(local?.connections || [])])
      const candidates = state.enemies.filter(enemy => !enemy.elite
        && nearby.has(enemy.location) && state.locations.some(item => item.id === enemy.location && item.revealed))
      if (!candidates.length) {
        api.info('附近没有可谈判的非精英敌人。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'target', source: '60466', seat: inv.seat,
        prompt: '选择要魅惑的非精英敌人。',
        options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = candidates.find(item => item.id === chosen) || candidates[0]
      api.moveEnemy(enemy, inv.location)
      api.engage(enemy, inv.seat)
      api.gainResources(inv.seat, (Number(enemy.damage) || 0) + (Number(enemy.horror) || 0))
    },
  }],
}
