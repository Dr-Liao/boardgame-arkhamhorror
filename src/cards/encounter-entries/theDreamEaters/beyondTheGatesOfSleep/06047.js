// 06047 七百级台阶（Seven Hundred Steps · Of Deeper Slumber）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 当你离开「七百级台阶」时：你手牌中每有 1 张超过 3 张的卡牌，受到 1 点恐惧。
//   [fast]：选择并弃掉你手牌中的 1 张卡牌。
// 读点：onLeave.effect（引擎 movement.js 直接读）；[fast] 行动走 locationRule.actions（actions:0 + fast:true），
//   由章节 behavior.fastActions / performAction 分派。
const CODE = '06047'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onLeave: {
      effect(state, location, api, inv) {
        const excess = Math.max(0, (inv?.hand || []).length - 3)
        if (excess > 0) {
          api.horror?.(inv.seat, excess)
          api.info?.(`🪜 ${inv.name} 离开「七百级台阶」：手牌超出 3 张，受到 ${excess} 点恐惧。`)
        }
      },
    },
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id || !(inv.hand || []).length) return
      moves.push({
        action: 'scenarioAction',
        rule: 'sevenHundredStepsDiscard',
        actions: 0,
        fast: true,
        label: '🪜 七百级台阶：[fast] 选择并弃掉 1 张手牌',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'sevenHundredStepsDiscard') return false
      api.discardChosen?.(inv.seat, 1, CODE)
      return true
    },
  },
}
