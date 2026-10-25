// 05150 黑书（The Black Book · 血字签名）
// 归属：关卡专用 · theSecretName（P8 w-witch）。剧情资产：act1 背面交给一位调查员控制，
// 结局 1/2 可选择加入战役牌组（api.campaignCard，P2.10 原语）。
// 卡面：你得到 +1[willpower] 和 +1[intellect]；[reaction] 在你打出一张卡牌时，横置黑书并受到 X 点恐惧：
// 该卡牌的费用减少 X 点。
// 实现口径：被动技能加成走条目 passive.stats；「打牌减费」走引擎的 play-cost-interrupt 窗口
// （src/engine/actions.js 的 beforePlayCost：反应写 context.costReduction）。
// 第五轮：引擎的打出合法性会把场上受控支援声明的 `playCostReductionProvider` 计入
// 「印刷费用 - 潜在减费」（src/engine/moves.js 的 legalMoves/validateMove 同时扫描被打出的牌
// 自身与 inv.assets 里声明 provider 的受控支援，取最大减费）。黑书据此声明潜在减费上限，
// 使「资源本来不足、靠黑书减费才付得起」的牌也能被选择/提交。
// resolve 保证：靠潜在减费才付得起时，X 会被限制到「减到付得起」的最小值。
export default {
  code: '05150',
  scope: 'storyAsset',
  implemented: true,
  passive: { stats: { willpower: 1, intellect: 1 } },
  // 潜在减费上限：黑书未横置时 = min(该牌印刷费用, 剩余恐惧)。
  // 引擎读点签名：(state, inv, playedDef, sourceAsset)。
  playCostReductionProvider: (state, inv, playedDef = {}, sourceAsset = null) => {
    const source = sourceAsset
      || (inv?.assets || []).find(asset => String(asset.code) === '05150')
      || null
    if (!source || source.exhausted) return 0
    const printedCost = Math.max(0, Number(playedDef?.cost) || 0)
    if (!printedCost) return 0
    const remainingSanity = Math.max(0, Number(inv?.sanity ?? 0) - Number(inv?.horror ?? 0))
    return Math.min(printedCost, remainingSanity)
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'beforePlayCost',
    label: '横置黑书并受到 X 点恐惧：该卡牌的费用减少 X 点',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context?.seat === inv.seat
      && Boolean(context?.cardCode)
      && Number(context.cost) > 0
      && Math.max(0, Number(inv.sanity ?? 0) - Number(inv.horror ?? 0)) > 0],
    resolve: ({ inv, source, context, api }) => {
      const cost = Math.max(0, Number(context.cost) || 0)
      // X 的合法范围：不能超过卡牌费用（费用最低 0），也不能超过当前可承受的恐惧。
      const remainingSanity = Math.max(0, Number(inv.sanity ?? 0) - Number(inv.horror ?? 0))
      const maxX = Math.min(cost, remainingSanity)
      if (maxX <= 0) return
      // 若资源本来不足（合法性判定是靠潜在减费才允许打出），X 至少要减到付得起，否则支付会失败。
      const requiredReduction = Math.min(maxX, Math.max(0, cost - Number(inv.resources ?? 0)))
      const answer = Number(api.choice({
        kind: 'number', source: source?.code || '05150', seat: inv.seat,
        prompt: `黑书：选择受到多少点恐惧（${requiredReduction}–${maxX} 点，卡牌费用等量减少）。`,
        options: Array.from({ length: maxX - requiredReduction + 1 }, (_, index) => {
          const amount = requiredReduction + index
          return { id: String(amount), label: `受到 ${amount} 点恐惧（费用 -${amount}）` }
        }),
      }))
      const amount = Number.isInteger(answer) && answer >= requiredReduction && answer <= maxX
        ? answer : requiredReduction
      if (amount <= 0) return
      api.horror(inv.seat, amount)
      context.costReduction = (Number(context.costReduction) || 0) + amount
      api.info(`${inv.name} 横置「黑书」：受到 ${amount} 点恐惧，该卡牌费用减少 ${amount} 点。`)
    },
  }],
}
