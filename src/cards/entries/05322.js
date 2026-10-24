// 05322 第六感
// 卡面：[action]：调查。本次调查不使用[intellect]，改为使用[willpower]。你本次调查得到+2[willpower]。
//       如果本次检定期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，你可以选择与你所在地点之间
//       连接次数不超过2的一个已揭示地点；如同你在所在地点调查的同时，也在所选地点调查(你可以使用两个地点中任意一个地点的隐藏值)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05322 第六感：意志调查 +2（doInvestigate 的 skill / bonus 参数）。
// 符号标记后的「同时在另一个地点调查 / 任选隐藏值」未实现（检定难度与发现线索都在 doInvestigate 内部结算），见 note。

export default {
  code: '05322',
  simplified: true,
  note: '符号标记后的「视同同时在 2 格内另一已揭示地点调查、任选其中一个隐藏值」未实现：'
    + '调查的难度/线索归属在 doInvestigate 内部一次结算，没有「两个地点二选一隐藏值」的通用原语；意志调查主效果已实现。',
  abilities: [
    {
      kind: 'action',
      cost: { action: true },
      label: '调查（意志代替智力，+2 意志）',
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { skill: 'willpower', bonus: 2, sourceCode: '05322' })
      },
    },
  ],
  modifiers: [

  ],
}
