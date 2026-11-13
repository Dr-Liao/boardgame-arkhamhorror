// The Scarlet Keys · 09760 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09760'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { hunter: true, retaliate: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['wouldSucceedTest'],
    label: '攻击或躲避她成功且超过难度 2 点以上：她变换附属的每个钥匙',
    criteria: [({ state, source, context }) => {
      const test = state.skillTest
      if (!test || source?.defeated === true) return false
      if (!['combat', 'agility'].includes(context?.skill || test.skill)) return false
      if (test.source?.enemyId && test.source.enemyId !== source.id) return false
      return (Number(context?.successBy) || 0) >= 2
    }],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state })
      api.info?.('「朱三娘」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。猎手 + 反击已接线；攻击/躲避成功超难度 2 点触发走 wouldSucceedTest 窗口。',
}
