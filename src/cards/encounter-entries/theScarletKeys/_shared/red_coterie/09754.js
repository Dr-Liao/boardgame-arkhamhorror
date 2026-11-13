// The Scarlet Keys · 09754 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09754'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { hunter: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['defeatEnemy'],
    label: '被击败时：变换他附属的每个钥匙两次',
    criteria: [({ context, source }) => context?.enemy?.id === source?.id || context?.enemy?.code === CODE],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state }, 2)
      api.info?.('「血色监视者」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。猎手关键词已接线；被击败时双次变换走共享 helper。',
}
