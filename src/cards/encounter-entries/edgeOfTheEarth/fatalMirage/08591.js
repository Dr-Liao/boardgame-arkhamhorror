// 08591 艾弗里·克莱普尔 · 坚毅伙伴
import { canChangeChaosToken } from '../../_shared.js'

const CODE = '08591'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, resolute: true },
  uses: 3, usesType: 'supplies',
  abilities: [{
    kind: 'reaction', trigger: 'tokenEffectWouldResolve',
    label: '横置：取消寒霜，然后揭示新标记或花费 1 补给',
    cost: { exhaust: true },
    criteria: ({ state, inv, source, context }) => context.token === 'frost' && context.location === inv.location
      && !context.cancelled && !context.rerollToken && !context.cannotCancel
      && canChangeChaosToken(state, inv.seat, context.token) && (state.chaosBag.length > 0 || source.uses > 0),
    resolve: ({ state, inv, source, context, api }) => {
      const options = []
      if (state.chaosBag.length) options.push({ id: 'reveal', label: '揭示 1 个新的混乱标记' })
      if (api.availableUses(source) > 0) options.push({ id: 'supply', label: '花费 1 补给' })
      const choice = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '取消寒霜后，选择一项。', options })
      if (choice === 'reveal') context.rerollToken = true
      else if (choice === 'supply' && api.spendUses(source, 1, { allowSubstitution: true })) {
        context.cancelled = true
        context.cancellationActorSeat = inv.seat
      }
    },
  }],
}
