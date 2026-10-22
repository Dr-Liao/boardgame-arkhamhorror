// 03056 化妆室
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：[action][action][action]：治愈3点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03056', scope: 'location',
  locationRule: {
    actions({ inv, moves }) {
      moves.push({ action: 'scenarioAction', rule: 'dressingRoomHeal', actions: 3,
        label: '花费3行动，治愈3点恐惧', reason: inv.horror > 0 ? null : '没有需要治愈的恐惧' })
    },
    performAction(state, inv, move) {
      if (move.rule !== 'dressingRoomHeal') return false
      inv.horror = Math.max(0, inv.horror - 3)
      return true
    },
  },
}
