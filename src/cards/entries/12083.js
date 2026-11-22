// 12083 旧指南针（Old Compass）
// 卡面：[action]：调查([intellect])。本次调查你所在地点得到隐藏值 -1。
//       如果你检定失败，你可以横置旧指南针以再次尝试该检定。如果你这么做，本次调查你所在地点改为得到隐藏值 -2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [action] 资产能力 = kind:'action' + countsAs:'investigate'（行动种类/借机攻击判定）；
//   · 调查主流程 = api.investigate(seat, { shroudMod })（doInvestigate 唯一入口；返回本次检定结果）；
//   · 「失败后横置再试一次（改为 -2）」= api.exhaust（横置唯一写点）+ 第二次 api.investigate
//     （api.investigate 不扣行动点，等价于原卡「再次尝试该检定」）；第二次使用 -2 帷幕。

const CODE = '12083'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      label: '调查（帷幕 -1）；失败时可横置旧指南针再试一次（帷幕 -2）',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const result = api.investigate(inv.seat, { shroudMod: -1 })
        if (!result || result.success !== false) return
        if (!source || source.exhausted) return
        const answer = api.choice({
          kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '旧指南针：调查失败。是否横置旧指南针，以 -2 帷幕再次尝试？',
          options: [{ id: 'skip', label: '不再尝试' }, { id: 'retry', label: '横置旧指南针，再试一次（帷幕 -2）' }],
        })
        if (answer !== 'retry') return
        api.exhaust(source)
        api.info('🧭 「旧指南针」：横置以再次尝试调查（帷幕 -2）。')
        api.investigate(inv.seat, { shroudMod: -2 })
      },
    },
  ],
  modifiers: [],
}
