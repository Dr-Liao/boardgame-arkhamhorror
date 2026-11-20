import { ownSeat } from '../../engine/matcher.js'

const sealed = (state, source) => state.chaos?.sealed?.find(token => token.source === source.id)

export default {
  code: '11009',
  flags: { sealedTokenReplacement: true },
  abilities: [
    {
      kind: 'reaction', trigger: 'testEnds', label: '封印本次成功检定揭示的一枚数字标记',
      limit: { scope: 'perPhase', owner: 'instance' },
      criteria: [ownSeat(), ({ state, source, context }) => context.result?.success && !sealed(state, source)
        && !(state.skillTest?.releasedTokenSources || []).includes(source.id)
        && !!state.chaos?.revealed?.some(token => /^[+-]?\d+$/.test(token))],
      resolve: ({ state, inv, source, api }) => {
        const numbers = [...new Set(state.chaos.revealed.filter(token => /^[+-]?\d+$/.test(token)))]
        const token = api.choice({
          kind: 'token', source: source.id, seat: inv.seat, prompt: '选择要封印的数字标记。',
          options: numbers.map(id => ({ id, label: id })),
        })
        api.sealTestToken(inv.seat, token, source.id)
      },
    },
    {
      kind: 'forced', trigger: 'beforeChaosTokenReveal', label: '改为结算封印的标记并释放它',
      criteria: [ownSeat(), ({ state, source, context }) => !!sealed(state, source) && !context.replacementToken],
      resolve: ({ source, context, api }) => api.revealSealedTestToken(context, source.id),
    },
  ],
}
