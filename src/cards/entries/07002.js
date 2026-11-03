export default {
  code: '07002', kind: 'investigator',
  investigator: { investigationStart: true, beneathPublic: true, elderSign: { bonus: 0 } },
  elderSign: { label: '旧印：可将下方牌的图标翻倍', resolve: ({ inv, state, api }) => {
    const index = state.skillTest.committed.findIndex(item => item.origin?.host === inv.code && item.seat === inv.seat)
    if (index >= 0 && api.choice({ kind: 'reaction', seat: inv.seat, source: inv.code, canSkip: true,
      prompt: '是否将下方牌本次检定的图标翻倍？', options: [{ id: 'skip', label: '不翻倍' }, { id: 'double', label: '翻倍图标' }] }) === 'double') {
      api.investigatorTools.multiplyCommitment(index)
    }
    return { delta: 0 }
  } },
  abilities: [
    { kind: 'forced', trigger: 'investigationPhaseStarts', label: '抽牌并更换下方牌',
      criteria: ({ state }) => state.phase === 'investigation',
      resolve: ({ inv, api }) => api.investigatorTools.rotateBeneath(inv.seat, inv.code) },
    { kind: 'forced', trigger: 'testBegins', label: '投入下方牌，检定后保留',
      criteria: ({ inv, state, context }) => context.seat === inv.seat
        && !state.skillTest.committed.some(item => item.origin?.host === inv.code)
        && (state.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[inv.code]?.length || 0) > 0,
      resolve: ({ inv, api }) => api.investigatorTools.commitBeneath(inv.seat, inv.code) },
  ],
}
