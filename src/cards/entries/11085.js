export default {
  code: '11085',
  playableFromDiscard: true,
  playableOnlyFromDiscard: true,
  abilities: [{
    kind: 'forced', trigger: 'assetDefeated',
    label: '被击败时：改为洗入牌库',
    criteria: ({ source, context }) => context.asset?.id === source.id,
    resolve: ({ context }) => { context.shuffledIntoDeck = true },
  }],
}
