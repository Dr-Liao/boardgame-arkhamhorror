// 03045 加演曲目
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 皇家密使加入胜利区后：移除场上所有的毁灭标记，并将密谋牌库重置到密谋1a。然后，在该密谋上放置3个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03045', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 100)
      if (state.status === 'playing') api.finish('noResolution')
    },
  },
}
