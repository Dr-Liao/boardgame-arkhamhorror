// The Scarlet Keys · 09759 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09759'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { hunter: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['enemyAttack'],
    label: '苋攻击时：她变换附属的每个钥匙',
    criteria: [({ source, context }) => !context?.enemy || context.enemy.id === source?.id],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state })
      api.info?.('「苋」变换了 ' + shifted + ' 把钥匙。')
    },
  }, {
    kind: 'forced', trigger: 'assetHarmPlaced',
    label: '这次攻击将伤害或恐惧分配给支援时：击败那个支援',
    criteria: ({ source, context }) => context?.attack?.enemyId === source?.id
      && (context.damage > 0 || context.horror > 0),
    resolve: ({ api, context }) => {
      if (api.defeatAsset(context.seat, context.assetId)) {
        api.info?.('「苋」的攻击击败了接受伤害或恐惧的支援。')
      }
    },
  }],
}
