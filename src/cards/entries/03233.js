// 03233 “吃我一招！”
// 卡面：只能投入你正在执行的技能检定。作为将“吃我一招！”投入技能检定的额外费用，花费最多3资源。
// 卡面：如果你检定成功且超过难度至少1点，获得两倍数量的该资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03233',
  abilities: [
    {
      kind: 'commit',
      label: '“吃我一招！”',
      skill: { selfTestOnly: true, wagerResources: 3 },
    },
  ],
  modifiers: [

  ],
}
