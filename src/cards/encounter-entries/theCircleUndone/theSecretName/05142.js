// 05142 古怪图形（Strange Geometry）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 放置入场并移动到其上；强制 - 调查阶段结束弃掉并把所有人与敌人移到线索最多地点（各 1 伤 1 恐）；[free] 无线索时移动到任意已揭示地点。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05142', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if ((location.clues || 0) > 0) return
      if (!state.locations.some(entry => entry.revealed && entry.id !== location.id)) return
      moves.push({ action: 'scenarioAction', rule: 'leaveStrangeGeometry', actions: 0,
        label: '🧩 移动到任意一个已揭示的地点（古怪图形上没有线索，[free]）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'leaveStrangeGeometry') return false
      const revealed = state.locations.filter(entry => entry.revealed && entry.id !== inv.location)
      if (!revealed.length) return false
      const picked = api.choose?.({
        kind: 'location', source: '05142', seat: inv.seat,
        prompt: '选择要移动到的已揭示地点。',
        options: revealed.map(entry => ({ id: entry.id, label: entry.name })),
      })
      api.moveInvestigator?.(inv.seat, picked || revealed[0].id)
      return true
    },
  },
}
