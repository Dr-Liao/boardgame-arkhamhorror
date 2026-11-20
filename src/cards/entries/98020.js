function matching(state, inv, cardDef) {
  const test = state.skillTest
  const enemy = state.enemies.find(item => item.id === test?.target?.id)
  const card = cardDef(enemy?.originalCode || enemy?.code || test?.source?.code)
  if (!card || (!enemy && !['enemy', 'treachery', 'location', 'act', 'agenda'].includes(card.type))) return []
  const traits = (card.traits || []).map(trait => trait.toLowerCase())
  return [...new Set((state.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[inv.code] || [])
    .filter(code => cardDef(code)?.traits?.some(trait => traits.includes(trait.toLowerCase()))))]
}

export default {
  code: '98020',
  abilities: [{
    kind: 'reaction', trigger: 'testInitiated', label: '弃掉同特质的暗置遭遇牌：难度 -2',
    limit: { scope: 'perTest', owner: 'instance' },
    criteria: ({ state, inv, helpers }) => matching(state, inv, helpers.cardDef).length > 0,
    resolve: ({ state, inv, api, source }) => {
      const code = api.choice({
        kind: 'card', source: source.id, seat: inv.seat, prompt: '选择要弃掉的暗置遭遇牌。',
        options: matching(state, inv, api.cardDef).map(id => ({ id, cardCode: id, label: api.cardName(id) })),
      })
      if (api.discardStashedEncounter(inv.seat, code)) api.reduceTestDifficulty(2)
    },
  }],
}
