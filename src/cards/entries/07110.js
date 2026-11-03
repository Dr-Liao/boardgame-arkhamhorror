export default {
  code: '07110', abilities: [{ kind: 'reaction', trigger: 'chaosRevealStepEnded', label: '将任意数量的已揭示祝福放回袋内并忽略修正', cost: { exhaust: true },
    criteria: ({ state }) => state.chaos?.revealed?.slice(state.chaos.frames.at(-1)).includes('bless'),
    resolve: ({ inv, api }) => api.playerTools.returnRevealedBlessings(inv.seat) }],
}
