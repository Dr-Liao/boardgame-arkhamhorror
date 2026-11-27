// 06145 乌撒之猫（theSearchForKadath）· 敌人（生物 / 精英，蜂拥2，胜利1）
// 卡面：蜂拥2。
// 卡面：当你尝试躲避本敌人而揭示混乱标记时，额外揭示1个混乱标记（每次检定仅限一次）。
// 卡面：强制 - 调查员第一次击败乌撒之猫（或其1张蜂拥卡牌）时：加3张蜂拥卡到其头领卡牌，
//       并记录「（该调查员名）已打破乌撒的法则」。
//
// 头领和附属蜂拥共用首次击败窗口，只有头领本身取消离场。
export default {
  code: '06145', scope: 'enemy', implemented: true,
  enemyRule: { extraEvadeChaosTokens: 1 },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyWouldBeDefeated',
    silent: true,
    label: '首次击败乌撒之猫或其蜂拥时增加 3 张蜂拥卡',
    criteria: ({ state, source, context }) => source?.id && !source.hostId
      && (context?.enemy?.id === source.id || context?.enemy?.hostId === source.id)
      && Number.isInteger(context.sourceSeat)
      && !state.scenarioFlags?.catsOfUltharFirstDefeat
      && !context.replaced && !context.cancelled,
    resolve: ({ state, source, context, api }) => {
      if (context.enemy.id === source.id && !api.enemyOutcomes.replace(context)) return
      api.setScenarioFlag('catsOfUltharFirstDefeat', true)
      api.scenario.swarm.place(source, 3, { source: '06145' })
      const investigator = state.investigators[context.sourceSeat]
      const names = api.campaignRecord('hasBrokenTheLawOfUlthar') || []
      if (investigator?.name && !names.includes(investigator.name)) {
        api.setCampaignRecord('hasBrokenTheLawOfUlthar', [...names, investigator.name])
      }
      api.info('🐈 首次击败乌撒之猫或其蜂拥：向头领加 3 张蜂拥卡，并记录打破乌撒的法则。')
    },
  }],
}
