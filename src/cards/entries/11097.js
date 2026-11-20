export default {
  code: '11097',
  abilities: [
    {
      kind: 'commit', label: '每多揭示一个混乱标记多 1 个万能图标，最多加 3 个',
      skill: {
        maxPerTest: 1,
        resultIconBonus: ({ revealedCount }) => Math.max(0, Math.min(3, revealedCount - 1)),
      },
    },
  ],
}
