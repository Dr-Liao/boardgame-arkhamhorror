export default {
  code: '07140', scope: 'location', implemented: true,
  locationRule: { onReveal(state, location, api) { api.mechanics.keys.placeRandom(`location:${location.id}`) } },
  abilities: [{
    kind: 'action', actionKind: 'parley', label: '谈判：战力(2)或敏捷(2)，成功移除1个屏障', cost: { action: 1 },
    resolve: ({ inv, source, api }) => {
      const skill = api.choice({ kind: 'skill', source: '07140', seat: inv.seat, prompt: '选择本次谈判检定的技能。',
        options: [{ id: 'combat', label: '战力(2)' }, { id: 'agility', label: '敏捷(2)' }] })
      if (!['combat','agility'].includes(skill)) return
      api.test(inv.seat, skill, 2, {
        source: { type: 'scenario', action: 'parley', code: '07140', name: source.name, ability: true },
        target: { kind: 'location', id: source.id }, actionKind: 'parley',
        resolve: result => { if (result.success) api.barriers.removeConnected(inv.seat, source.id) },
      })
    },
  }],
}
