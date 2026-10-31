// 06189 剧情支援「银钥匙」（The Silver Key · 梦境之门的钥匙）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror（剧情支援，卡池带 encounterCode 但牌组外携带）。
// 卡面：[reaction] 在你将要受到恐惧时，横置银钥匙：取消该恐惧中的 1 点。
//
// 依据 Haskell Asset/Cards/...（银钥匙在结局 1 加入调查员牌组，不计入牌组张数）：
//   · 「将要受到恐惧」→ 引擎的 harmDealt 窗口（reactionWindow；与 05021/05280 同一读点），
//     条目的反应把窗口上下文的 horror 减 1（取消 1 点）；
//   · 横置费用走描述子 cost.exhaust；卡牌本身由战役层/结局获得（P8 不重复实现入队逻辑）。
export default {
  code: '06189',
  scope: 'storyAsset',
  implemented: true,
  abilities: [{
    kind: 'reaction',
    trigger: 'harmDealt',
    label: '横置银钥匙：取消该恐惧中的 1 点',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context?.seat === inv?.seat && Number(context?.horror || 0) > 0],
    resolve: ({ inv, context, api }) => {
      context.horror = Math.max(0, Number(context.horror || 0) - 1)
      api.info?.(`🗝️ 「银钥匙」：${inv.name} 取消了 1 点恐惧。`)
    },
  }],
}
