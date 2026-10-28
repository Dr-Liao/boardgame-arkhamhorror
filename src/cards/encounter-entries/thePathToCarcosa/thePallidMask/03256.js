// 03256 堵塞通道
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：强制 - 在你揭示堵塞通道时：受到2点伤害。本轮你不能离开堵塞通道。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 堵塞通道 / 暗影坟墓（03256）：揭示时若当前幕不是 03246，则所在地点的调查员受到 2 点伤害且不能离开。

export default {
  code: '03256', scope: 'location', flags: { shadowTomb: true },
  locationRule: {
    onReveal(state, location, api) {
      if (state.acts?.[state.actIndex]?.originalCode === '03246') return
      const inv = state.investigators[state.currentSeat]
      if (inv?.location === location.id) api.damage(inv.seat, 2)
      api.lockLocationThisRound(location)
    },
  },
}
