// 60325 心灵手巧
// 卡面：每次技能检定最多投入1张。
// 卡面：如果本次检定成功，抽取1张卡牌(如果成功超过难度至少2点，改为抽取2张卡牌)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60325',
  abilities: [{
    kind: 'commit',
    label: '最多投入一张；成功抽一张，超过难度至少 2 点则抽两张',
    skill: {
      maxPerTest: 1,
      onSuccessResolve: ({ inv, result, api }) => api.drawCards(inv.seat, result.successBy >= 2 ? 2 : 1),
    },
  }],
}
