// 02194 应急物品
// 卡面：获得3资源并抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02194 应急物品：获得 3 资源，然后抽 1 张牌。

export default {
  code: '02194',
  abilities: [
    {
      kind: 'played', label: '获得 3 资源并抽 1 张牌',
      effect: {
        type: 'sequence',
        effects: [{ type: 'gainResource', amount: 3 }, { type: 'draw', amount: 1 }],
      },
    },
  ],
  modifiers: [

  ],
}
