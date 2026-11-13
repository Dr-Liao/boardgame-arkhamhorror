// The Scarlet Keys · 09753 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09753'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { aloof: true },
  spawnFarthestFromAll: true,
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['enemyPhaseBegins'],
    label: '敌军阶段结束时若未交战：每位调查员失去 1 资源给她，然后她变换附属的每个钥匙',
    criteria: [({ source }) => Boolean(source) && source.engagedSeat == null && source.defeated !== true],
    resolve: ({ state, source, api }) => {
      let moved = 0
      for (const inv of state.investigators || []) {
        if (inv.defeated || inv.resigned) continue
        const amount = Math.min(1, Number(inv.resources) || 0)
        if (!amount) continue
        api.loseResources?.(inv.seat, amount)
        moved += amount
      }
      if (moved) api.setScenarioFlag?.('chicaRojaResources', (Number(api.scenarioFlag?.('chicaRojaResources')) || 0) + moved)
      const shifted = shiftAttachedKeys(source, { api, state })
      if (moved || shifted) api.info?.('「红衣女郎」收走 ' + moved + ' 资源，变换了 ' + shifted + ' 把钥匙。')
    },
  }, {
    kind: 'reaction', trigger: ['defeatEnemy'],
    label: '被执行击败后：把她的资源尽可能平均分配给调查员',
    criteria: [({ context, source }) => context?.enemy?.id === source?.id],
    resolve: ({ state, api }) => {
      const total = Number(api.scenarioFlag?.('chicaRojaResources')) || 0
      const alive = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
      if (!total || !alive.length) return
      const each = Math.floor(total / alive.length)
      let remainder = total % alive.length
      for (const inv of alive) {
        const gain = each + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder -= 1
        api.gainResources?.(inv.seat, gain)
      }
      api.setScenarioFlag?.('chicaRojaResources', 0)
      api.info?.('「红衣女郎」的资源被分配给了调查员。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。冷漠 + 生成-最远地点已接线；敌军阶段结算用 enemyPhaseBegins 窗口近似（原始时为「敌军阶段结束时」）。',
}
