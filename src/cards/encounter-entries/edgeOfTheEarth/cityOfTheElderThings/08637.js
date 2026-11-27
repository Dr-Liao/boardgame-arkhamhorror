// 08637 破败街道（Ruinous Streets）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   强制 - 当你在破败街道的技能检定期间揭示1个或更多[frost]混乱标记后：受到1点伤害。
//   [reaction]你发现破败街道上最后的线索后：发现一个连接地点的1个线索。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08637",
  scope: "location",
  implemented: true,
  locationRule: {
    flags: {
      frostForcedDamage: 1
    },
  },
  abilities: [{
    kind: 'reaction', trigger: 'clueDiscovered',
    label: '发现破败街道最后的线索后：发现一个连接地点的 1 个线索',
    criteria: ({ state, inv, source, context }) => context.seat === inv.seat && context.lastClue
      && context.location === source.id && state.locations.some(location =>
        location.clues > 0 && source.connections?.includes(location.id)),
    resolve: ({ state, inv, source, api }) => {
      const locations = state.locations.filter(location => location.clues > 0 && source.connections?.includes(location.id))
      const id = locations.length === 1 ? locations[0].id : api.choice({
        kind: 'location', source: '08637', seat: inv.seat, prompt: '选择发现线索的连接地点。',
        options: locations.map(location => ({ id: location.id, label: location.name })),
      })
      if (id) api.discoverClue(inv.seat, 1, id)
    },
  }],
}
