export default { code: '07225', abilities: [{ kind: 'reaction', trigger: 'testInitiated', cost: { exhaust: true },
  label: '基础技能值视为 5；祝福可重整神灯，诅咒可多进行 1 行动',
  criteria: ({ state, inv, context }) => context.seat === inv.seat && state.phase === 'investigation' && state.currentSeat === inv.seat,
  resolve: ({ inv, source, api }) => api.playerTools.baseSkillForTest(inv.seat, source.id, 5),
}] }
