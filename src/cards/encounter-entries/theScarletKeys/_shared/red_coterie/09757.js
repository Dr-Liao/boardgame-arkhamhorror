// The Scarlet Keys · 09757 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09757'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { hunter: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['enemySpawn'],
    label: '索恩入场后：变换他们附属的每个钥匙',
    criteria: [({ source, context }) => !context?.enemy || context.enemy.id === source?.id],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state })
      api.info?.('「索恩」变换了 ' + shifted + ' 把钥匙。')
    },
  }, {
    kind: 'free', actionKind: 'activate',
    label: '[fast] 移除你身上的一把钥匙：把索恩加入胜利区，索恩成为该钥匙持有者',
    criteria: [({ state, source, api }) => Boolean(source) && api.tsk.keys.heldBy({ type: 'investigator', seat: state.currentSeat ?? 0 }).length > 0],
    resolve: ({ state, source, api }) => {
      const seat = Number.isSafeInteger(state.currentSeat) ? state.currentSeat : 0
      const held = api.tsk.keys.heldBy({ type: 'investigator', seat })
      const keyId = held[0]
      if (!keyId) return false
      api.tsk.keys.steal?.(keyId, { type: 'enemy', enemyId: source.id })
      api.setScenarioFlag?.('removedKey:' + keyId, true)
      api.buryEnemyInVictory?.(source)
      api.info?.('索恩成为「' + keyId + '」的持有者。')
      return true
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。猎手已接线；[fast] 分支保留「钥匙改为敌人持有 + 索恩进胜利区 + 移除键标记」；叙事胜利区文本由战役流程读取。',
}
