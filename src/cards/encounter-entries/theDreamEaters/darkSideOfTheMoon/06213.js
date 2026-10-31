// 06213 幕 IV「意外救援」（Unexpected Rescue）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面（正面）：目标 - 设法离开月球。（要推进场景时，你会收到指示。）
// 背面「船长」：(→ 结局 1)。
//
// 依据 Haskell Act/Cards/.../UnexpectedRescue.hs：本幕没有线索推进，白船的船长（06225）谈判检定成功时
// 推进本幕（见 06225.js 的船长行动）；背面 → 结局 1。
export default {
  code: '06213',
  scope: 'act',
  implemented: true,
  actRule: {
    // 目标只有在「船长」剧情支援的谈判检定成功时才推进（船员行动见 06225.js）。
    objectiveRule: 'captainSetsSail',
    onReveal(state, act, api) {
      api.finish?.('resolution1')
      return true
    },
  },
}
