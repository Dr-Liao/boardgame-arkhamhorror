// 06044 通路（The Path）· 幕 4
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 正面：强制 - 任意调查员首次进入「魔幻森林」地点后：在战役日志记录「入梦者偏离了道路」。
//   目标 - 只有位于「魔幻小路」的调查员可以作为一个团队花费所需数量的线索来推进（5×人数）。
// 背面：调查员必须选择其一：退后旁观（→结局 1）/ 打断那只伤痕累累的猫，自己处理（→结局 2）。
// 读点：actRule.onReveal（章节 behavior.actReveal 分派）；目标/强制为数据声明，
//   章节 behavior.checkObjectives / locationEntered 读取 actRule.objective 与 recordOnFirstEnter。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06044'

export default {
  code: CODE,
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'cluesAtLocation', originalCode: '06049', perInvestigator: 5, group: true },
    forcedOnEnter: { locationNameEn: 'Enchanted Woods', record: 'theDreamersStrayedFromThePath' },
    onReveal(state, act, api) {
      const seat = Number(state.campaign?.leadSeat ?? 0)
      const answer = api.choice?.({
        kind: 'story', source: CODE, seat,
        prompt: '祖格鼠与猫群的对峙仍在继续。你要怎么做？',
        options: [
          { id: 'stepBack', label: '退后一步，看这超现实的场景如何展开（→结局 1）' },
          { id: 'interrupt', label: '打断那只伤痕累累的猫，亲自处理（→结局 2）' },
        ],
      })
      const key = answer === 'interrupt' ? 'resolution2' : 'resolution1'
      api.setScenarioFlag?.('thePathChoice', key)
      api.finish?.(key)
      return true
    },
  },
}
