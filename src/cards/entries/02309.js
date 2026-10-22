// 02309 反复尝试
// 卡面：[reaction]在技能检定失败后，如果有投入到该检定的技能卡牌归你所有，横置反复尝试：将这些技能卡牌中的一张返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02309 再来一次：技能检定失败后横置，取回投入的技能卡。

export default {
  code: '02309',
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestFail', id: 'tryAgain', legacyReaction: true,
      label: '技能检定失败后取回投入的技能卡', cost: { exhaust: true },
      // 第 121 轮：取回投入的技能卡走通用原语 api.recallCommittedSkill（与 04159 同一实现）。
      resolve: ({ inv, api }) => api.recallCommittedSkill(inv.seat, {
        source: '02309',
        prompt: '选择一张已投入的技能牌返回其持有者手牌。',
      }),
    },
  ],
  modifiers: [

  ],
}
