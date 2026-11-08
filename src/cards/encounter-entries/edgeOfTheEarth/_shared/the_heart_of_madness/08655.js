// 08655 水下扩张区（Subnautical Sprawl）· 地点（古代设施）· the_heart_of_madness
// 卡面：在水下扩张区的每次技能检定期间，将揭示的第一个[frost]标记的修正值改为视为 -3，
//   而不是 -1（每轮仅限一次）。
// 读点：forced + trigger 'tokenReveal'；限制 perRound/instance；修正走 api.mechanics.chaosTokens.treat。
const CODE = '08655'

const frostSeenThisTest = state => (state.skillTest?.tokenResults || []).some(item => item.face === 'frost')

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { ancientFacility: true, firstFrostModifier: -3 },
  abilities: [{
    kind: 'forced', trigger: 'tokenReveal',
    label: '水下扩张区：每轮第一个 [frost] 修正视为 -3',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ state, source, inv, context }) => context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && state.investigators?.[inv.seat]?.location === source.id
      && !frostSeenThisTest(state),
    resolve: ({ api }) => {
      api.mechanics.chaosTokens.treat({ as: 'frost', modifier: -3 })
      api.info('🌊 「水下扩张区」：本轮第一个 [frost] 修正视为 -3。')
    },
  }],
}

