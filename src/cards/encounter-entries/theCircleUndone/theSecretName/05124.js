// 05124 献祭标志（Marked for Sacrifice）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +4 生命；反应同上。背面→结局1。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05124', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      api.info?.('🩸 献祭标志：调查员们逃离了巫宅。')
      api.finish?.('resolution1')
      return true
    },
  },
}
