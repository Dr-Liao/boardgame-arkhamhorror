export default {
  code: '07091', scope: 'treachery', implemented: true, teamActivatable: true,
  encounterResolve(state, inv, card, api) {
    if (api.mechanics.water.effectiveLevel(inv.seat) === 0) return { gainSurge: true }
    return !!api.threat(inv.seat, '07091')
  },
  abilities: [{
    kind: 'forced', trigger: 'move', label: '暗流：移动后受到2伤害与2恐惧，然后弃掉暗流',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, source, context }) => context.seat === inv.seat && inv.threat.some(card => card.id === source.id),
    resolve: ({ inv, source, api }) => { api.harm(inv.seat, { damage: 2, horror: 2 }); api.removeThreat(source) },
  }, {
    kind: 'free', actionKind: 'activate', label: '弃1张手牌：战力(3)或敏捷(3)，成功弃掉暗流', cost: { discardHand: 1 },
    resolve: ({ inv, source, api }) => {
      const skill = api.choice({ kind: 'skill', seat: inv.seat, source: '07091', prompt: '选择对抗潮流的技能。',
        options: [{ id: 'combat', label: '战力' }, { id: 'agility', label: '敏捷' }] })
      if (!['combat','agility'].includes(skill)) return
      api.test(inv.seat, skill, 3, { source: { type: 'scenario', code: '07091', name: '暗流', ability: true },
        resolve: result => { if (result.success) api.removeThreat(source) } })
    },
  }],
}
