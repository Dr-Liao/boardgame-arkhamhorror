// 03172 厨房
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]如果厨房没有线索：检定[willpower](2)。如果你检定成功，记住你“在厨房放了火”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 83 轮：邪秽誓约的六个「记忆事实」地点与医务室。

import { rememberFact } from '../../_shared.js'

export default {
  code: '03172', scope: 'location',
  locationRule: {
    entryError(state, location) {
      if (location.revealed || state.actIndex >= 1) return null
      return '通往厨房的门锁住了。你不能进入厨房。'
    },
    actions({ state, location, moves }) {
      if ((state.scenarioFlags.remembered || []).includes('setAFireInTheKitchen')) return
      moves.push({ action: 'scenarioAction', rule: 'kitchenFire', label: '检定意志（2），在厨房放火',
        reason: (location?.clues || 0) === 0 ? null : `需要先取走厨房的线索（还剩 ${location.clues || 0} 个）` })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'kitchenFire') return false
      api.test(inv.seat, 'willpower', 2, result => { if (result.success) rememberFact(state, 'setAFireInTheKitchen') })
      return true
    },
  },
}
