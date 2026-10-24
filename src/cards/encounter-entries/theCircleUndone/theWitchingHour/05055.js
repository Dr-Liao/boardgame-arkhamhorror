// 05055 通向曙光（Paths into Twilight）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：背面 - 放置女巫圆环（05055b）并结算其显现。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05055', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      api.place?.('witchesCircle')
      api.reveal?.('witchesCircle')
      api.info?.('🌒 「女巫圆环」被放置在游戏区域中央，不在任何调查员面前。')
      return true
    },
  },
}
