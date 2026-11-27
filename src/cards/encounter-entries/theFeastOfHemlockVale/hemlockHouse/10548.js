// 10548 小西尔维 / Little Sylvie · 剧情资产（story asset）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；Day 1 白天放在最底层的卧室。
// 卡面：[reaction] 本卡从手牌或牌堆被弃掉时：打出它（支付费用）。[reaction] 剧本卡效果要弃掉你
// 手牌或牌堆的卡时：横置本卡；把那张卡放到你的牌堆顶。
// 读点：behavior.placeResidents / resolution（Resolution 2「找到小西尔维」的奖励）。

const CODE = '10548'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  scenarioPlayable: true,
  flags: {
    littleSylvie: true,
    controlledBy: 'investigator',
    playWhenDiscarded: true,
    exhaustToSaveDiscard: true,
    foundByRecord: 'foundLittleSylvie',
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: ['handCardDiscarded', 'deckCardDiscarded'],
      label: '弃掉小西尔维后，支付费用打出它',
      criteria: [({ inv, context, helpers }) => context.seat === inv.seat && context.cardCode === CODE
        && inv.discard.includes(CODE) && helpers.availableResources() >= 1],
      resolve: ({ inv, api }) => api.playCardFromDiscard(inv.seat, CODE, { exileAfter: false }),
    },
    {
      kind: 'reaction',
      trigger: 'wouldDiscardPlayerCard',
      label: '横置小西尔维，把将被剧本弃掉的卡牌放到牌库顶',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => context.seat === inv.seat && !context.discardDestination
        && context.source?.kind === 'encounter' && ['hand', 'deck'].includes(context.from)
        && inv.assets.includes(source)],
      resolve: ({ context }) => {
        context.discardDestination = 'deckTop'
      },
    },
  ],
}
