import { barrierCount } from '../../_shared.js'
export default {
  code: '07144', scope: 'enemy', implemented: true,
  enemyRule: { ignoreHunterBarriers: true },
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 2 * state.numInvestigators }],
  abilities: [{
    kind: 'forced', trigger: 'enemyMoved', label: '移动后：移除经过通道上的全部屏障',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, source, context }) => context.enemy?.id === source.id
      && context.from !== context.to && barrierCount(state, context.from, context.to) > 0,
    resolve: ({ context, api }) => api.barriers.set(context.from, context.to, 0),
  }],
}
