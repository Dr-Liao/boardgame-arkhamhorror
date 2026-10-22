// 03050 前厅
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 在前厅揭示时：将放在一边的前厅走廊门口地点中的随机2张放置入场。
// 卡面：[action][action]：抽取3张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 86 轮：克苏鲁的帷幕（curtainCall）门厅/后台揭示与剧院离开伤害。

export default {
  code: '03050', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'lobbyDraw', actions: 2, label: '花费2行动，抽取3张牌' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'lobbyDraw') return false
      api.drawCards(inv.seat, 3)
      return true
    },
    onReveal(state, location, api) {
      const pool = state.scenarioFlags.lobbyDoorways || []
      for (let count = 0; count < 2 && pool.length; count++) {
        const id = pool.splice(Math.floor(api.random() * pool.length), 1)[0]
        api.place(id)
      }
    },
  },
}
