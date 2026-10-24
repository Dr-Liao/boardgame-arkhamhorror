// 05139 物理教室（Physics Classroom）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[reaction] 成功调查且超过难度至少 2 点时：发现另一个已揭示地点的 1 个线索（每轮一次）。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05139', scope: 'location', implemented: true,
  locationRule: {
    onInvestigateSuccess({ state, location, inv, result, api }) {
      if (!result?.success) return undefined
      if (Number(result.value) - Number(result.difficulty) < 2) return undefined
      state.scenarioFlags ||= {}
      // 「每轮一次」为每名调查员一次（不是团队共享）。
      const usedBySeat = state.scenarioFlags.physicsRoundBySeat || {}
      if (usedBySeat[inv.seat] === state.round) return undefined
      const candidates = state.locations.filter(entry => entry.revealed && entry.id !== location.id && (entry.clues || 0) > 0)
      if (!candidates.length) return undefined
      const picked = api.choose?.({
        kind: 'location', source: '05139', seat: inv.seat,
        prompt: '选择另一个已揭示、有线索的地点发现 1 个线索。',
        options: candidates.map(entry => ({ id: entry.id, label: entry.name })),
      })
      const target = candidates.find(entry => entry.id === picked) || candidates[0]
      state.scenarioFlags.physicsRoundBySeat = { ...(state.scenarioFlags.physicsRoundBySeat || {}), [inv.seat]: state.round }
      api.discoverClue?.(inv.seat, 1, target.id)
      api.info?.(`🔬 物理教室：${inv.name} 在「${target.name}」发现 1 个线索。`)
      return undefined
    },
  },
}
