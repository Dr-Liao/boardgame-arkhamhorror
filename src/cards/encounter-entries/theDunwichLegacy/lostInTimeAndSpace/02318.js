// 02318 关闭裂缝
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：[action]：弃掉遭遇牌库顶3张卡牌。选择以此效果弃掉的一个地点并结算其“显现”能力。
// 卡面：目标 - 只有宇宙的边缘的调查员可以共同花费所需数量的线索以推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { scenarioLocationId } from '../../_shared.js'

export default {
  code: '02318', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      api.remove(scenarioLocationId(state, '02321') || 'location02321')
      api.place(scenarioLocationId(state, '02322') || 'location02322')
    },
  },
}
