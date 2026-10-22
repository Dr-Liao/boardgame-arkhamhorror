// 02199 寻找答案
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：目标 - 在有调查员进入隐藏密室时，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId } from '../../_shared.js'

export default {
  code: '02199', scope: 'act',
  actRule: {
    objective(state, { entered }) { return entered('02214') },
    onReveal(state, act, api) {
      for (const loc of state.locations) api.reveal(loc.id)
      const chamber = state.locations.find(item =>
        item.id === (scenarioLocationId(state, '02214') || 'location02214'))
      const total = state.locations.reduce((sum, loc) => sum + loc.clues, 0)
        + state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
      for (const loc of state.locations) loc.clues = 0
      for (const inv of state.investigators) inv.clues = 0
      state.clues = 0
      if (!chamber) return
      chamber.clues = total
      api.spawn('02216', chamber.id)
    },
  },
}
