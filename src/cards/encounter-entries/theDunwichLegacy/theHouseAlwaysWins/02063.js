// 02063 四叶草俱乐部
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：每个[[罪犯]]敌人获得冷漠。
// 卡面：强制 - 如果调查员对[[罪犯]]敌人造成伤害：立即推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02063', scope: 'agenda',
  agendaRule: {
    // 第 115 轮：章节 behavior 从这两条数据读「罪犯获得冷漠」「伤害罪犯立即推进」。
    criminalAloof: true,
    criminalDamagedAdvancesAgenda: true,
    onReveal(state, agenda, api) {
      for (const enemy of state.enemies) {
        if (enemy.traits?.some(trait => trait.toLowerCase() === 'criminal')) api.clearEnemyAloof(enemy)
      }
      api.shuffleDiscard()
      if (state.campaign.scenarioResults?.some(result => result.scenarioId === 'extracurricularActivity')) {
        state.scenarioFlags.advanceDirectlyToAgenda = '02064'
      }
    },
  },
}
