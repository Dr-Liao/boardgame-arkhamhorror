// 03179 病人拘禁室
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]：检定[combat](2)以释放这里的病人。如果你检定成功，他像狼一样嚎叫着冲出地下室；记住你“释放了一个危险的病人”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { rememberFact } from '../../_shared.js'

export default {
  code: '03179', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      if ((state.scenarioFlags.remembered || []).includes('releasedADangerousPatient')) return
      moves.push({ action: 'scenarioAction', rule: 'occupiedCell', label: '检定战斗（2），释放危险病人' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'occupiedCell') return false
      api.test(inv.seat, 'combat', 2, result => { if (result.success) rememberFact(state, 'releasedADangerousPatient') })
      return true
    },
  },
}
