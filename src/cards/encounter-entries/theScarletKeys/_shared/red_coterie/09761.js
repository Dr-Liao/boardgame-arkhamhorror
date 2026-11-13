// The Scarlet Keys · 09761 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09761'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { aloof: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['enemyPhaseBegins'],
    label: '敌军阶段结束：每位调查员看牌库顶并作为空洞放一边；若已有同名空洞则变换她附属的每个钥匙',
    criteria: [({ source }) => Boolean(source) && source.defeated !== true],
    resolve: ({ state, source, api }) => {
      const hollow = api.tsk?.hollow
      if (!hollow) return
      for (const inv of state.investigators || []) {
        if (inv.defeated || inv.resigned) continue
        const top = inv.deck?.[inv.deck.length - 1]
        if (!top) continue
        const taken = api.takeDeckCard?.(inv.seat, top)
        if (!taken) continue
        if (hollow.isHollowed?.(top)) {
          const shifted = shiftAttachedKeys(source, { api, state })
          api.info?.('「阿莉奇」变换了 ' + shifted + ' 把钥匙。')
        } else {
          hollow.hollow?.({ code: top, scope: 'team', source: 'deck' })
        }
      }
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。冷漠已接线；敌军阶段结束的牌库顶空洞化用 enemyPhaseBegins 窗口近似，同名空洞触发变换钥匙。',
}
