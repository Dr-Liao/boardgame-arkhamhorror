// 05054 女巫作祟（Witch Hauntings）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：目标 - 一位调查员花费 1×人数线索推进；背面 - 本场冒险余下时间可以进入其他调查员面前的地点。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05054', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      state.scenarioFlags ||= {}
      state.scenarioFlags.frontsUnlocked = true
      api.info?.('🌒 本场冒险接下来的时间里，调查员可以进入其他调查员面前的地点。')
      return true
    },
  },
}
