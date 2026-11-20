import { skillModifier } from './_shared.js'

export default {
  code: '11033',
  uses: 0,
  usesType: 'evidence',
  modifiers: [skillModifier('agility', 1)],
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestSuccess', label: '恰好成功 3 点：获得 1 证据',
      limit: { scope: 'perTest', owner: 'instance' },
      criteria: [({ state, inv, context }) => state.skillTest?.seat === inv.seat && context.successBy === 3],
      resolve: ({ source, api }) => api.addUses(source, 1),
    },
    {
      kind: 'free', label: '横置并花费等于此处帷幕的证据：发现 1 个线索',
      cost: { exhaust: true },
      criteria: [({ inv, source, helpers }) => {
        const shroud = helpers.locationShroud(inv.location, inv.seat, { includeLocationState: true })
        return Number.isFinite(shroud) && source.uses >= Math.max(0, shroud)
          && helpers.canDiscoverClueAt(inv.seat, inv.location)
      }],
      resolve: ({ inv, source, api }) => {
        const shroud = Math.max(0, api.locationShroud(inv.location, inv.seat, { includeLocationState: true }))
        if (shroud === 0 || api.spendUses(source, shroud)) api.discoverClue(inv.seat, 1, inv.location)
      },
    },
  ],
}
