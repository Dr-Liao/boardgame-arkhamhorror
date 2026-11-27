// 10522 棱柱碎片 · 剧情资产（writtenInRock）
// 卡面：使用（4  brilliance）。[reaction] 当一张剧本卡或弱点卡效果将要从你手中弃掉任意数量
// 的卡时，横置棱柱碎片并花费 1 brilliance：改为忽略该效果并抽同样数量的卡。
// 一张卡一个文件：碎片在幕间「塌方」放在列 4 最下方（与 10506 的 [action] 取得控制权配对）；
// 取得控制在 behavior.actions（writtenInRockTakeShard）。弃牌反应使用 wouldDiscardFromHand 窗口。
export default {
  code: '10522',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  scenarioPlayable: true,
  uses: 4,
  usesType: 'brilliance',
  flags: {
    prismaticShard: true,
    uses: 4,
    useKind: 'brilliance',
    takeControlAction: true,
    ignoreHandDiscardReaction: true,
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'wouldDiscardFromHand',
    label: '忽略剧本卡或弱点导致的弃手牌效果，改为抽等量牌',
    cost: { exhaust: true, uses: 1 },
    criteria: [({ inv, source, context }) => context?.seat === inv.seat
      && context.source?.kind === 'encounter' && !context.cancelled && context.amount > 0
      && (source.controllerSeat === inv.seat || inv.assets?.includes(source))],
    resolve: ({ api, context, inv }) => {
      context.cancelled = true
      api.drawCards(inv.seat, context.amount)
    },
  }],
}
