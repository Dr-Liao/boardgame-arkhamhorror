// 08690 冰川幻影（Glacial Phantom）· 敌人 · creatures_in_the_ice
// 卡面：强制 - 当敌军阶段结束时，如果冰川幻影处于重整状态：将其向调查员最多的地点移动一次。
//   按玩家顺序，每位在冰川幻影所在地点或连接地点的调查员，将忒咳哩-哩牌库顶的 1 张卡牌洗入
//   自己的牌库，不要查看内容（每位不能这么做的调查员受到 1 点恐惧）。
// 读点：forced + trigger 'enemyPhaseEnds'（turn.js 敌军阶段结束）；移动走 api.scenario.moveEnemyToward。
export default {
  code: '08690', scope: 'enemy', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束：冰川幻影向调查员最多的地点移动，相邻调查员各洗入 1 张忒咳哩-哩',
    criteria: ({ source }) => source && source.exhausted !== true && !source.defeated,
    resolve: ({ state, source, api }) => {
      const alive = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      const counts = new Map()
      for (const inv of alive) counts.set(inv.location, (counts.get(inv.location) || 0) + 1)
      let target = null
      for (const [locationId, count] of counts) {
        if (!state.locations.some(loc => loc.id === locationId)) continue
        if (target == null || count > (counts.get(target) || 0)) target = locationId
      }
      if (target && target !== source.location) api.scenario.moveEnemyToward(source, target, { ignoreAloof: true })
      const here = state.locations.find(loc => loc.id === source.location)
      const spots = new Set([source.location, ...(here?.connections || [])])
      const size = Number(api.mechanics.tekeli.size())
      for (const inv of alive) {
        if (!spots.has(inv.location)) continue
        const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, 1) : false
        if (Array.isArray(shuffled) && shuffled.length) continue
        api.info('「冰川幻影」：' + (inv.name || '调查员') + ' 无法洗入忒咳哩-哩，受到 1 点恐惧。')
        api.horror(inv.seat, 1)
      }
    },
  }],
}

