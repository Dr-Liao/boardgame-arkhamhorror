// 03055 演员休息室
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：[action]调查。你本次调查得到+3[intellect]。本次技能检定结束后，弃掉你的每张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03055', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'greenRoomInvestigate', label: '调查演员休息室（本次智识+3，之后弃掉全部手牌）' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'greenRoomInvestigate') return false
      const location = state.locations.find(item => item.id === inv.location)
      api.test(inv.seat, 'intellect', (location?.shroud || 0) + (location?.shroudMod || 0), result => {
        if (result.success && location.clues > 0) {
          location.clues--
          api.gainClues(inv.seat, 1)
        }
        inv.discard.push(...inv.hand.splice(0))
      }, 3, { type: 'scenario', label: '调查', code: '03055' })
      return true
    },
  },
}
