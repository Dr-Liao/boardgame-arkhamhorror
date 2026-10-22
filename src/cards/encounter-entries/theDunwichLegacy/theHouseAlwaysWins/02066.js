// 02066 歪打正着
// 归属：关卡专用 · theHouseAlwaysWins（敦威治遗产 · 百赌百胜）
// 遭遇组：the_house_always_wins
// 卡面：[reaction]在你揭示一个混乱标记时：你可以将该标记视作混乱袋里的任意其他标记。如果你这么做，请记住你“作弊”了(团队每轮仅限一次)。
// 卡面：目标 - 调查员在收集的线索总计达到所需数量时，必须立即花费这些线索并推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：俱乐部 Always Wins（敦威治第二章）的幕/密谋脚本。

export default {
  code: '02066', scope: 'act',
  actRule: {
    // 第 115 轮：「歪打正着」允许作弊改判混乱标记（读者在章节 behavior.chaosTokenRevealed）。
    allowsCheating: true,
    onReveal(state, act, api) {
      api.place('darkenedHall')
      if (state.agendaIndex !== 0) return
      const code = api.discardUntilEnemy(state.currentSeat ?? state.campaign.leadSeat,
        def => (def.traits || []).some(trait => String(trait).toLowerCase() === 'criminal'))
      if (code) api.spawn(code, 'darkenedHall')
    },
  },
}
