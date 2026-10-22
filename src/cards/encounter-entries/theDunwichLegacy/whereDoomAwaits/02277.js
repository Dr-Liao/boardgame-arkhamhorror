// 02277 通往山顶的道路
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：目标 - 调查员在收集的线索总计达到所需数量时，必须立即花费这些线索并推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId } from '../../_shared.js'

export default {
  code: '02277', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      for (const loc of state.locations) loc.clues = 0
      api.reveal(scenarioLocationId(state, '02283') || 'location02283')
    },
  },
}
