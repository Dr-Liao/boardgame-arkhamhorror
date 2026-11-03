const labels = { willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' }
const keyLabels = { black: '黑色', red: '红色', green: '绿色', blue: '蓝色', white: '白色', yellow: '黄色', purple: '紫色' }

export default {
  code: '07291', scope: 'location',
  abilities: [{
    kind: 'forced', trigger: 'move', label: '进入达贡巢穴：检定最低技能(3)',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && context.location === source.id,
    resolve: ({ inv, source, api }) => {
      const skills = Object.keys(labels)
      const value = skill => api.scenario.investigatorStat(inv.seat, skill)
      const lowest = Math.min(...skills.map(value))
      const choices = skills.filter(skill => value(skill) === lowest)
      const skill = choices.length === 1 ? choices[0] : api.choice({ kind: 'skill', source: '07291', seat: inv.seat,
        prompt: '选择一个并列最低的技能进行检定。', options: choices.map(id => ({ id, label: `${labels[id]}(3)` })),
      })
      api.scenario.test(inv.seat, skill, 3, result => { if (!result.success) api.horror(inv.seat, 1) }, 0,
        { type: 'location', code: '07291', locationId: source.id, ability: true })
    },
  }, {
    kind: 'action', actionKind: 'activate', label: '检定意志或敏捷(3)：将你的线索放到当前场景',
    resolve: ({ state, inv, source, api }) => {
      const skill = api.choice({ kind: 'skill', source: '07291', seat: inv.seat,
        prompt: '选择达贡巢穴检定使用的技能。',
        options: [{ id: 'willpower', label: '意志(3)' }, { id: 'agility', label: '敏捷(3)' }],
      })
      api.scenario.test(inv.seat, skill, 3, result => {
        const performer = state.investigators[inv.seat]
        if (!result.success || performer.clues < 1) return
        api.scenario.spendClues(inv.seat, 1)
        api.scenario.placeCluesOnAct(1)
        if (performer.clues < 1) return
        const keys = api.keys.at(`investigator:${inv.seat}`)
        if (!keys.length) return
        const key = api.choice({ kind: 'effect', source: '07291', seat: inv.seat,
          prompt: '可以花费1把钥匙，再将你的1个线索放到当前场景。',
          options: [{ id: 'skip', label: '不花费钥匙' }, ...keys.map(color => ({ id: color, label: `花费${keyLabels[color]}钥匙` }))],
        })
        if (key !== 'skip' && api.keys.spend(inv.seat, key, 'reference')) {
          api.scenario.spendClues(inv.seat, 1)
          api.scenario.placeCluesOnAct(1)
        }
      }, 0, { type: 'location', code: '07291', locationId: source.id, ability: true })
    },
  }],
}
