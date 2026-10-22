// 02124 强行闯入
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：目标 - 如果有调查员进入展厅(禁止入内)，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId, summonHuntingHorror, chooseStoryControllerEntry } from '../../_shared.js'

export default {
  code: '02124', scope: 'act',
  actRule: {
    objective(state, { entered }) { return entered('02137') },
    onReveal(state, act, api) {
      chooseStoryControllerEntry(state, '02138', api)
      summonHuntingHorror(state, scenarioLocationId(state, '02137') || 'location02137', api)
    },
  },
}
