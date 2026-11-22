import { ownSeat } from '../../engine/matcher.js'

const code = '60128'
const clueLocations = ({ state, inv, helpers }) => {
  const here = state.locations.find(location => location.id === inv.location)
  return state.locations.filter(location => (location.id === inv.location || here?.connections?.includes(location.id))
    && helpers.canDiscoverClueAt(inv.seat, location.id))
}

export default {
  code,
  modifiers: [
    { target: 'skill:combat', amount: 1 },
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [{
    kind: 'reaction', trigger: 'defeatEnemy', label: '横置本牌并使其受到 1 点伤害，在所在地或连接地点发现 1 个线索',
    cost: { exhaust: true, assetDamage: 1 },
    criteria: [ownSeat(), ctx => clueLocations(ctx).length > 0],
    resolve: ({ state, inv, api }) => {
      const options = clueLocations({ state, inv, helpers: api })
      const id = options.length === 1 ? options[0].id : api.choice({
        kind: 'location', source: code, seat: inv.seat, prompt: '选择要发现线索的地点。',
        options: options.map(location => ({ id: location.id, label: location.name })),
      })
      if (options.some(location => location.id === id)) api.discoverClue(inv.seat, 1, id)
    },
  }],
}
