export default {
  code: '07137', scope: 'location', implemented: true,
  abilities: [{
    kind: 'forced', trigger: 'move', label: '国立第一杂货铺：在进入时经过的通道放置1个屏障',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: [({ source, context }) => context.location === source.id && source.connections?.includes(context.from)],
    resolve: ({ source, context, api }) => api.barriers.change(source.id, context.from, 1),
  }, {
    kind: 'action', actionKind: 'parley', label: '谈判：以最低技能值检定(2)，成功移除1个屏障', cost: { action: 1 },
    resolve: ({ inv, source, api }) => {
      const values = ['willpower','intellect','combat','agility'].map(skill => ({ skill, value: api.stat(inv.seat, skill) }))
      const lowest = Math.min(...values.map(entry => entry.value))
      const skills = values.filter(entry => entry.value === lowest).map(entry => entry.skill)
      const names = { willpower: '意志', intellect: '智力', combat: '战力', agility: '敏捷' }
      const skill = skills.length === 1 ? skills[0] : api.choice({ kind: 'skill', source: '07137', seat: inv.seat,
        prompt: '选择一个并列最低的技能进行检定。', options: skills.map(id => ({ id, label: names[id] })) })
      if (!skills.includes(skill)) return
      api.test(inv.seat, skill, 2, {
        source: { type: 'scenario', action: 'parley', code: '07137', name: source.name, ability: true },
        target: { kind: 'location', id: source.id }, actionKind: 'parley',
        resolve: result => { if (result.success) api.barriers.removeConnected(inv.seat, source.id) },
      })
    },
  }],
}
