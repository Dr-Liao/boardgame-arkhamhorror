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
    kind: 'forced', trigger: ['assetDamageAssigned'],
    label: '这次攻击伤害分配给支援时：击败那些支援',
    criteria: [({ context }) => Boolean(context?.damagedAssetIds?.length)],
    resolve: ({ state, api, context }) => {
      for (const inv of state.investigators || []) {
        for (const asset of [...(inv.assets || [])]) {
          if (!context.damagedAssetIds.includes(asset.id)) continue
          api.discardAsset?.(inv.seat, asset)
        }
      }
      api.info?.('「苋」的攻击击败了被分配伤害的支援。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。猎手已接线；攻击后变换钥匙 + 伤害分配给支援时击败它（assetDamageAssigned 窗口）。',
}
