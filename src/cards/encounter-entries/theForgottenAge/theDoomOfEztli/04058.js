// 04058 科学与魔法
// 归属：关卡专用 · theDoomOfEztli（失落的时代 · 埃兹特里的覆灭）
// 遭遇组：eztli
// 卡面：[action]：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
// 卡面：目标 - 只有在时间石室的调查员可以共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { takeControlOfRelicInEntry, formLocationLineInEntry } from '../../_shared.js'

export default {
  code: '04058', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      takeControlOfRelicInEntry(state, api)
      formLocationLineInEntry(state, api)
    },
  },
}
