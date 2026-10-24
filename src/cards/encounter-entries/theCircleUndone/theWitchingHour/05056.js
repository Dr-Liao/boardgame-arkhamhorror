// 05056 未毁之环（A Circle Unbroken）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：目标 - 安妮特被击败，或女巫圆环上没有线索；背面 - 击败安妮特→结局1，打破圆环→结局2。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05056', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const outcome = state.scenarioFlags?.actFourOutcome
        || ((state.victoryDisplay || []).some(card => originalOf(card) === '05057') ? 'defeatedAnette' : 'brokeTheCircle')
      const key = outcome === 'defeatedAnette' ? 'resolution1' : 'resolution2'
      api.info?.(outcome === 'defeatedAnette'
        ? '🕯️ 安妮特·梅森被击败：女巫集会陷入寂静。'
        : '⚡ 你打破了女巫圆环，法术反噬了施术者。')
      api.finish?.(key)
      return true
    },
  },
}
