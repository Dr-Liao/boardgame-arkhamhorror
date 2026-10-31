// 06198 海量研究
// 卡面：你每有一张其它手牌，海量研究的打出费用减少 1 点。
//       发现你所在地点的 2 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 动态费用：`beforePlayCost` 窗口（打出支付前）对「正在被打出的这张卡」开放
//     （src/engine/ability-exec.js 的专用补源），在 context.costReduction 里写减免，
//     doPlay 随后按折后费用扣款；
//   · 可用性预览：条目级 playCostReductionProvider（legalMoves/validateMove 的潜在减费读点），
//     保证资源只够折后费用时这张卡也会出现在可打出列表里。
// 口径：进入 beforePlayCost 窗口时本卡已移出手牌，因此 inv.hand.length 就是「其它手牌」数。

export default {
  code: '06198',
  playCostReductionProvider: (state, inv) => Math.max(0, (inv.hand || []).length - 1),
  abilities: [
    {
      kind: 'played',
      label: '发现所在地点的 2 个线索',
      effect: { type: 'discoverClue', amount: 2 },
    },
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      label: '每有一张其它手牌，打出费用 -1',
      // 同一次支付只减一次：第一次结算后 context.costReduction 非 0，不再作为候选重复出现。
      criteria: [({ context }) => Number(context?.costReduction || 0) === 0],
      resolve: ({ inv, context, api }) => {
        const reduction = Math.max(0, (inv.hand || []).length)
        if (!reduction) return
        context.costReduction = (Number(context.costReduction) || 0) + reduction
        api.info(`${inv.name} 的「海量研究」费用减少 ${reduction}（其它手牌 ${reduction} 张）。`)
      },
    },
  ],
  modifiers: [],
}
