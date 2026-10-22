// 02042 宁静的走廊
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02042', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        if (inv.discard.length >= 5) api.horror(inv.seat, inv.discard.length >= 10 ? 2 : 1)
      }
      const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
      if (done) state.scenarioFlags.advanceDirectlyToAgenda = '02043'
    },
  },
}
