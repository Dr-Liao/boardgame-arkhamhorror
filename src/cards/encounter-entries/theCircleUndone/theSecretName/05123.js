// 05123 巫异光芒（The Witch Light）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +3 生命；反应同上。背面 - 幕 3：那赫卜放 1 毁灭；否则放回场外并为密谋 4a 预留 4 毁灭。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05123', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const step = (state.actIndex ?? 0) + 1
      const nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (step === 3) {
        if (nahab) nahab.doom = (nahab.doom || 0) + 1
        api.info?.('🌑 那赫卜获得 1 个毁灭标记。')
        return true
      }
      if (nahab) {
        state.enemies = state.enemies.filter(enemy => enemy !== nahab)
        const inv = state.investigators[nahab.engagedSeat]
        if (inv) inv.engaged = (inv.engaged || []).filter(id => id !== nahab.id)
        state.scenarioZones ||= {}
        state.scenarioZones.setAside = [...(state.scenarioZones.setAside || []), '05149']
        api.info?.('🌑 那赫卜被放回场外（set aside）。')
      }
      const nextAgenda = state.agendas?.[(state.agendaIndex ?? 0) + 1]
      if (nextAgenda) {
        nextAgenda.doom = (nextAgenda.doom || 0) + 4
        api.info?.('🌑 密谋 4a 入场时将带有 4 个毁灭标记。')
      }
      return true
    },
  },
}
