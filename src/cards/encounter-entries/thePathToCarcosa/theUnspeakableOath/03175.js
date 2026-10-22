// 03175 后院
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：你调查后院时，你每有1点恐惧，后院隐藏值+1。
// 卡面：[action]如果后院没有线索，受到1点伤害：记住你“煽动病人互相攻击”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { rememberFact } from '../../_shared.js'

export default {
  code: '03175', scope: 'location',
  locationRule: {
    actions({ state, inv, location, moves }) {
      if ((state.scenarioFlags.remembered || []).includes('incitedAFightAmongstThePatients')) return
      moves.push({ action: 'scenarioAction', rule: 'yardFight', label: '受到 1 点伤害，煽动病人互相攻击',
        reason: (location?.clues || 0) > 0 ? `需要先取走院子的线索（还剩 ${location.clues || 0} 个）`
          : inv.damage < inv.maxHealth ? null : '伤害已满，无法再承受 1 点伤害' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'yardFight') return false
      api.damage(inv.seat, 1)
      rememberFact(state, 'incitedAFightAmongstThePatients')
      return true
    },
  },
}
