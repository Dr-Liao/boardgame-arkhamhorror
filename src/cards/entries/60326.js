// 60326 幸运烟盒
// 卡面：[reaction]你技能检定成功超过难度至少1点后，横置幸运烟盒：从你牌库顶X张卡牌中查找一张卡牌，抽取它，并将其余卡牌混洗入你的牌库。其中X为你成功超过难度的点数。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60326',
  abilities: [{
    kind: 'reaction', trigger: 'skillTestSuccess',
    label: '成功超过难度至少 1 点后横置：搜索牌库顶等量的牌并抽 1 张',
    cost: { exhaust: true },
    criteria: ({ state, inv, context }) => state.skillTest?.seat === inv.seat && context.successBy >= 1,
    resolve: ({ inv, context, api }) => api.searchTop(inv.seat, {
      amount: context.successBy, choose: 1, mandatory: true, source: '60326',
    }),
  }],
}
