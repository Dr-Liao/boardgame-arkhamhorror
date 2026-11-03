import { hasTrait } from '../../_shared.js'

export default {
  code: '07179',
  scope: 'storyAsset',
  abilities: [{
    kind: 'reaction',
    trigger: ['floodChanged', 'enemySpawn'],
    cost: { exhaust: true },
    label: '所在地水位改变或深潜者生成后：立即进行一次行动',
    criteria: ({ inv, source, context }) => inv.assets.some(asset => asset.id === source.id)
      && context.location === inv.location
      && (context.when === 'floodChanged'
        ? context.before !== context.after
        : hasTrait(context.enemy, 'Deep One')),
    resolve: ({ inv, source, api }) => api.beginImmediateAction(inv.seat, { source: source.id }),
  }],
}
