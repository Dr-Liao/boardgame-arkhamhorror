// 05138 1692年的塞勒姆监狱（Salem Gaol, 1692）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 每场一次智识(3)成功移动到任意已揭示地点；闹鬼：移动到凯夏的房间。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05138', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (state.scenarioFlags?.salemUsed) return
      moves.push({ action: 'scenarioAction', rule: 'salemIntellect', label: '⛓️ 检定智识(3)：移动到任意已揭示地点（每场一次）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'salemIntellect') return false
      state.scenarioFlags ||= {}
      state.scenarioFlags.salemUsed = true
      api.test?.(inv.seat, 'intellect', 3, result => {
        if (!result?.success) return
        const revealed = state.locations.filter(entry => entry.revealed && entry.id !== inv.location)
        if (!revealed.length) return
        const picked = api.choose?.({
          kind: 'location', source: '05138', seat: inv.seat,
          prompt: '选择要移动到的已揭示地点。',
          options: revealed.map(entry => ({ id: entry.id, label: entry.name })),
        })
        api.moveInvestigator?.(inv.seat, picked || revealed[0].id)
      })
      return true
    },
  },
}
