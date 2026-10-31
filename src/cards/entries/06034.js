// 06034 意外的发现
// 卡面：多重。
//       X为你弃牌堆中的意外的发现张数(不包括本卡牌)。
//       调查。你本次调查得到+X[intellect]。如果你检定成功，发现你所在地点额外X个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06034 意外的发现：
//   · 源数据 cost 为 -2（导入笔误，实际印刷费用 0）；playCost 会把负数钳到 0，因此打出费用为 0。
//   · X = 打出前弃牌堆里同名卡张数（本卡仍在手牌/已离手但尚未进弃牌堆，不计自身）。
//   · X 同时作为本次调查的技能加值（api.investigate 的 bonus）与成功后额外线索数（clueBonus）。

export default {
  code: '06034',
  abilities: [
    {
      kind: 'played',
      label: '调查：+X[智力]，成功发现 X 个额外线索',
      resolve: ({ inv, api }) => {
        const x = (inv.discard || []).filter(code => code === '06034').length
        api.info(`「意外的发现」：弃牌堆中有 ${x} 张同名卡，本次调查 +${x}[智力]，成功后额外发现 ${x} 个线索。`)
        api.investigate(inv.seat, { bonus: x, clueBonus: x })
      },
    },
  ],
  modifiers: [],
}
