// 10118 百折不挠：可从弃牌堆投入，随后混洗回牌库。
const CODE = '10118'

export default {
  code: CODE,
  abilities: [{
    kind: 'free',
    fromDiscard: true,
    trigger: 'test.beforeCommit',
    label: '将弃牌堆中的百折不挠投入此检定；检定结束后混洗回你的牌库',
    criteria: [({ state, inv, helpers }) => {
      const tester = state.investigators[state.skillTest?.seat]
      return Boolean(tester) && tester.location === inv.location
        && (tester.seat === inv.seat || !state.skillTest.committed.some(item => item.seat === inv.seat))
        && helpers.canCommitCard(CODE, { from: 'discard' })
    }],
    resolve: ({ inv, api }) => api.commitOrigins.commit(inv.seat, { code: CODE, from: 'discard', destination: 'shuffleIntoDeck' }),
  }],
}
