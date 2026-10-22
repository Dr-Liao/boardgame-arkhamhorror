// 03128 历史协会
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：[action]横置一个[[盟友]]支援：发现本地点的1个线索。(每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔克萨「往事回声」的历史房间 + 幕/密谋脚本。
// 第 119 轮：历史房间自己的场景行动与修正也在这里声明（章节 behavior 只做通用分派）。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '03128', scope: 'location', historicalRoom: true,
  locationRule: {
    actions({ state, inv, location, moves }) {
      const meetingRoomKey = `meetingRoom:${inv.seat}`
      if (state.scenarioFlags?.[meetingRoomKey] === state.round) return
      const readyAlly = (inv.assets || []).some(asset => !asset.exhausted
        && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))
      moves.push({ action: 'scenarioAction', rule: 'meetingRoomAlly',
        label: '横置一名盟友，在会议室发现1个线索',
        reason: location.clues > 0
          ? readyAlly ? null : '需要一名未横置的[[盟友]]支援'
          : '会议室已经没有线索' })
    },
  },
}
