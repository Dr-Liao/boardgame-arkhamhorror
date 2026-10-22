// 02046 莱斯的下落
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：[action]花费1个线索：弃掉遭遇牌库顶5张卡牌(单人游戏则改为弃掉遭遇牌库顶10张卡牌)。
// 卡面：强制-如果你以任何方式弃掉了“爵士”马利根，结算其显现效果。
// 卡面：目标-在你控制“爵士”马利根时，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02046', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.place('alchemyLabs')
      if (state.agendaIndex < 2 && !state.enemies.some(enemy => enemy.code === '02058')) api.spawn('02058', 'alchemyLabs')
      const done = state.campaign.scenarioResults?.some(result => result.scenarioId === 'theHouseAlwaysWins')
      if (done) {
        state.scenarioZones.underLocations ||= {}
        state.scenarioZones.underLocations.alchemyLabs = '02059'
      } else if (!state.scenarioZones.removed?.includes('02059')) {
        state.scenarioZones.removed ||= []
        state.scenarioZones.removed.push('02059')
        state.scenarioZones.concoctionClaimed = true
      }
    },
  },
}
