// 06045 七十级台阶（Seventy Steps · Of Lighter Slumber）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 当你离开「七十级台阶」时：你手牌中每有 1 张超过 5 张的卡牌，受到 1 点恐惧。
//   [fast]：选择并弃掉你手牌中的 1 张卡牌。
// 读点：onLeave.effect（引擎 movement.js 直接读 locationRule.onLeave）；
//   [fast] 行动走 locationRule.actions（actions:0 + fast:true），由章节 behavior.fastActions /
//   performAction 分派（TCU 同款 player-window-fast-actions 接线）。
const CODE = '06045'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onLeave: {
      effect(state, location, api, inv) {
        const excess = Math.max(0, (inv?.hand || []).length - 5)
        if (excess > 0) {
          api.horror?.(inv.seat, excess)
          api.info?.(`🪜 ${inv.name} 离开「七十级台阶」：手牌超出 5 张，受到 ${excess} 点恐惧。`)
        }
      },
    },
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id || !(inv.hand || []).length) return
      moves.push({
        action: 'scenarioAction',
        rule: 'seventyStepsDiscard',
        actions: 0,
        fast: true,
        label: '🪜 七十级台阶：[fast] 选择并弃掉 1 张手牌',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'seventyStepsDiscard') return false
      api.discardChosen?.(inv.seat, 1, CODE)
      return true
    },
  },
}
