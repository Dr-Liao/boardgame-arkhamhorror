// The Scarlet Keys · 09752 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09752'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { retaliate: true },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['tskKeyShifted'],
    label: '钥匙翻至稳定面后：戴红手套的男子攻击你，然后变换他附属的每个钥匙',
    criteria: [({ source, context }) => Boolean(source) && source.defeated !== true && context?.keyStable === true],
    resolve: ({ state, source, context, api, inv }) => {
      const seat = Number.isSafeInteger(context?.seat) ? context.seat : null
      if (seat != null) api.enemyAttackByCard?.(source, '「戴红手套的男子」：钥匙翻至稳定面', seat)
      const shifted = shiftAttachedKeys(source, { api, inv, state })
      api.info?.('「戴红手套的男子」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。反制关键词已接线；钥匙变换走共享 shiftAttachedKeys（tskKeyShifted 窗口派发）。',
}
