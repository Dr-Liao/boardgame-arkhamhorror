// 03180 病人拘禁室
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：[action]：检定[intellect](2)以与这里的病人交谈。如果你检定成功，你终于听懂了她的胡言乱语；记住你“获知了守卫的巡逻路线”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { rememberFact } from '../../_shared.js'

export default {
  code: '03180', scope: 'location',
  locationRule: {
    actions({ state, moves }) {
      if ((state.scenarioFlags.remembered || []).includes('knowTheGuardsPatrols')) return
      moves.push({ action: 'scenarioAction', rule: 'drearyCell', label: '检定智识（2），获知守卫巡逻路线' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'drearyCell') return false
      api.test(inv.seat, 'intellect', 2, result => { if (result.success) rememberFact(state, 'knowTheGuardsPatrols') })
      return true
    },
  },
}
