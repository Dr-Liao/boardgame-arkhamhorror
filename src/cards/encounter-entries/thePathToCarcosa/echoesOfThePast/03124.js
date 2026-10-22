// 03124 追寻答案
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'
import { someNonPlayerEntry } from '../../_lookup.js'

export default {
  code: '03124', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      for (const location of state.locations.filter(candidate => candidate.revealed
        && someNonPlayerEntry(entry => entry.code === originalOf(candidate) && entry.historicalRoom))) {
        const max = location.maxClues ?? (location.cluesPerInvestigator || 0) * state.numInvestigators
        location.clues = Math.min(max || Infinity, (location.clues || 0) + state.numInvestigators)
      }
    },
  },
}
