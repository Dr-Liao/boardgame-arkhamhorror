// 03181 病人拘禁室
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]：检定[willpower](X)，其中X为你身上的恐惧数量。如果你检定成功，你认出了这间房间；记住你“想起了出去的路”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { rememberFact } from '../../_shared.js'

export default {
  code: '03181', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      if ((state.scenarioFlags.remembered || []).includes('recalledTheWayOut')) return
      moves.push({ action: 'scenarioAction', rule: 'familiarCell', label: '检定意志（等同恐惧），想起出去的路' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'familiarCell') return false
      api.test(inv.seat, 'willpower', inv.horror, result => { if (result.success) rememberFact(state, 'recalledTheWayOut') })
      return true
    },
  },
}
