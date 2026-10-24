// 05024 指纹采集工具
// 卡面：使用(3补给)。
// 卡面：[action]横置指纹采集工具并花费1补给：调查。你本次调查得到+1[intellect]。
//       如果你检定成功，发现你所在地点额外1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05024 指纹采集工具：3 补给；[action] 横置 + 花 1 补给调查，本次 +1 智识；
// 成功时额外发现 1 个所在地点的线索（调查成功的 clueBonus 读点）。

export default {
  code: '05024',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '横置并花费 1 补给：调查（+1 智识，成功后额外发现 1 线索）',
      cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => api.investigate(inv.seat, { bonus: 1, clueBonus: 1 }),
    },
  ],
  modifiers: [

  ],
}
