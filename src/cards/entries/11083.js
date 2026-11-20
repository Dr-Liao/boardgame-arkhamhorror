import { skillModifier } from './_shared.js'

export default {
  code: '11083',
  modifiers: [skillModifier('intellect', 1)],
  abilities: [{
    kind: 'reaction', trigger: 'handCardDiscarded', cost: { exhaust: true },
    label: '在你的回合弃掉手牌后：横置，获得 1 资源',
    criteria: ({ inv, state, context, helpers }) => context.seat === inv.seat && helpers.canGainResources()
      && state.phase === 'investigation' && state.currentSeat === inv.seat && !inv.turnEnded,
    resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
  }],
}
