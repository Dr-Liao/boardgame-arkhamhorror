export default {
  code: '07005', kind: 'investigator', investigator: { elderSign: { bonus: 0 } },
  elderSign: { label: '旧印：从弃牌堆投入技能，结束后收回', resolve: ({ inv, api }) => {
    api.interactions.commit(inv.seat, { from: 'discard', retain: true, cardType: 'skill' })
    return { delta: 0 }
  } },
  abilities: [{ kind: 'reaction', trigger: 'chaosTokenRevealed', label: '收回一张自己投入的技能', limit: 'oncePerRound',
    criteria: ({ inv, state, context, helpers }) => context.seat === inv.seat
      && state.skillTest.committed.some(item => item.seat === inv.seat && helpers.cardType(item.code) === 'skill'),
    resolve: ({ inv, api }) => api.interactions.returnCommitment(inv.seat, { cardType: 'skill' }) }],
}
