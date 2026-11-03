export default {
  code: '07251', scope: 'location',
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '泵房：检定智力或敏捷(2)，调节淹没等级',
    resolve: ({ state, inv, source, api }) => {
      const skill = api.choice({ kind: 'skill', source: '07251', seat: inv.seat,
        prompt: '选择泵房检定使用的技能。',
        options: [{ id: 'intellect', label: '智力(2)' }, { id: 'agility', label: '敏捷(2)' }],
      })
      api.scenario.test(inv.seat, skill, 2, result => {
        if (!result.success) return
        const decrease = state.locations.filter(location => api.water.canChange(location.id, -1))
        if (!decrease.length) return
        const first = api.choice({ kind: 'location', source: '07251', seat: inv.seat,
          prompt: '选择一个地点，降低其淹没等级。',
          options: decrease.map(location => ({ id: location.id, label: location.name })),
        })
        api.water.change(first, -1)
        const increase = state.locations.filter(location => location.id !== first && api.water.canChange(location.id, 1))
        const maySkip = result.value - result.difficulty >= 2
        if (!increase.length) return
        const second = api.choice({ kind: 'location', source: '07251', seat: inv.seat,
          prompt: '选择另一个地点，提升其淹没等级。',
          options: [...(maySkip ? [{ id: 'skip', label: '仅降低一个地点的淹没等级' }] : []),
            ...increase.map(location => ({ id: location.id, label: location.name }))],
        })
        if (second !== 'skip') api.water.change(second, 1)
      }, 0, { type: 'location', code: '07251', locationId: source.id, ability: true })
    },
  }],
}
