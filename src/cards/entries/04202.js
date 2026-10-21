// 04202 勇斗异劫
// 卡面：快速。在你执行一次技能检定，且检定难度高于你的基础技能值时打出。
// 卡面：本次技能检定额外揭示X个混乱标记。选择其中一个结算并忽略其余标记。X为本次检定难度和你基础技能值的差值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04202 勇斗异劫：额外揭示与「难度-属性」同数量的标记并选 1 个。

export default {
  code: '04202',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'testBegins',
      criteria: { requiresDifficultyAboveBase: true, selfOnly: true },
      label: '勇斗异劫',
      resolve: ({ state, inv, api }) => {
        const test = state.skillTest
        if (!test) { api.info('只能在自己的技能检定期间打出。'); return }
        const base = api.stat(inv.seat, test.skill)
        const extra = Math.max(1, test.difficulty - base)
        api.addExtraChaosChoices(extra, '04202')
        api.info(`💪 「${api.cardName('04202')}」：本次检定额外揭示 ${extra} 个混乱标记并选择 1 个结算。`)
      },
    },
  ],
  modifiers: [

  ],
}
