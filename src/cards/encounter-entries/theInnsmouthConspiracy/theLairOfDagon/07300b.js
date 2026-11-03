import { hasTrait } from '../../_shared.js'
import { payablePoolTokens } from '../../_shared.js'

export default {
  code: '07300b', scope: 'storyAsset',
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置伊哈·恩斯雷雕塑：对本地类人敌人造成1点伤害',
    cost: { exhaust: true },
    criteria: ({ inv, source }) => inv.assets.some(asset => asset.id === source.id),
    target: { kind: 'enemy', query: ({ entity, canDamageEnemy }) => !entity.defeated && !entity.removedFromGame
      && hasTrait(entity, 'Humanoid') && canDamageEnemy(entity, '07300b') },
    resolve: ({ inv, target, api }) => api.damageEnemy(target.entity, 1, inv.seat, '07300b'),
  }, {
    kind: 'free', actionKind: 'activate', label: '横置伊哈·恩斯雷雕塑：将2个诅咒替换为祝福',
    cost: { exhaust: true },
    criteria: ({ state, inv, source }) => inv.assets.some(asset => asset.id === source.id)
      && payablePoolTokens(state, 'curse').length > 0,
    resolve: ({ api }) => api.chaosTokens.replace('curse', 'bless', 2),
  }],
}
