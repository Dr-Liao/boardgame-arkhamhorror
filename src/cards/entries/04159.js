// 04159 反复尝试
// 卡面：使用(3次数)。如果反复尝试没有次数，弃掉本卡牌。
// 卡面：[reaction]在技能检定失败后，如果有投入到该检定的技能卡牌归你所有，横置反复尝试并花费1次数：将这些技能卡牌中的一张返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04159 再试一次：检定失败后横置并消耗 1 次，取回投入的技能卡。
// 5c-18：候选与归还走 api.recallCommittedSkill（提示文案与询问来源沿用旧原语）。

export default {
  code: '04159',
  uses: 3,
  usesType: 'tries',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestFail', id: 'tryAndTryAgain', legacyReaction: true,
      criteria: { selfOnly: true }, label: '检定失败后取回投入的技能卡',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => { api.recallCommittedSkill(inv.seat, { source: '04159' }) },
    },
  ],
  modifiers: [

  ],
}
