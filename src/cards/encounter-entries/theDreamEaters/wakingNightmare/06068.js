// 06068 寻找病人（Search for the Patient）· 幕 2
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 正面：目标 - 若一名调查员控制「伦道夫·卡特」（06079），推进。
// 背面：把遭遇弃牌堆洗回遭遇牌库。
// 读点：objective 数据 actRule.objective（章节 behavior.checkObjectives 读 type:'controlsStoryAsset'）；
//   背面 actRule.onReveal（章节 behavior.actReveal 分派）。
const CODE = '06068'

export default {
  code: CODE,
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'controlsStoryAsset', originalCode: '06079' },
    onReveal(state, act, api) {
      api.shuffleDiscard?.()
      api.info?.('🕷️ 「寻找病人」背面：遭遇弃牌堆洗回遭遇牌库。')
      return true
    },
  },
}
