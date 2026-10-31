// 06284 背水一战
// 卡面：如果你的资源数量少于5，获得资源，直到你的资源数量等于5。
//       如果你的手牌数量少于5，抽取卡牌，直到你的手牌数量等于5。
//       将背水一战从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06284 背水一战：0 费事件。
//   · 打出条件：资源 <5 或 手牌 <5（参考实现的 cdCriteria 同一口径）；
//   · 结算：资源补到 5、手牌补到 5（补手牌走 api.drawCards，弱点/抽牌窗口照常结算）；
//   · 打出后从游戏中移除：played 描述子的 exileAfterPlay（engine actions.js 的结算去向读点）。
// 注意：事件卡在结算前已移出手牌，所以「手牌补到 5」计的是结算时的手牌数（与规则一致）。

export default {
  code: '06284',
  playCondition: [{
    when: ({ inv }) => (inv?.resources || 0) < 5 || (inv?.hand || []).length < 5,
    message: '只有资源少于 5 或手牌少于 5 时才能打出「背水一战」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '背水一战：资源与手牌补至 5，然后移出游戏',
      exileAfterPlay: true,
      resolve: ({ inv, api }) => {
        if ((inv.resources || 0) < 5) api.gainResources(inv.seat, 5 - (inv.resources || 0))
        const missing = 5 - (inv.hand || []).length
        if (missing > 0) api.drawCards(inv.seat, missing)
      },
    },
  ],
  modifiers: [],
}
