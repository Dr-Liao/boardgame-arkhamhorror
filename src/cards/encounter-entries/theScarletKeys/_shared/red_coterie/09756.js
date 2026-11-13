// The Scarlet Keys · 09756 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09756'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  spawnFarthestFromAll: true,
  enemyStatRule: { aura: { stat: 'fight', trait: 'Coterie', amount: 2 } },
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['defeatEnemy'],
    label: '另一个结社敌人离场后：变换他附属的每个钥匙（不含自己）',
    criteria: [({ source, context }) => Boolean(context?.enemy) && context.enemy.id !== source?.id],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state })
      api.info?.('「暗红骑士」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。结社光环 +2 战斗已接线（enemyStatRule.aura）；「另一个结社敌人离场后」用 defeatEnemy 窗口近似（离场窗口未注册）。',
}
