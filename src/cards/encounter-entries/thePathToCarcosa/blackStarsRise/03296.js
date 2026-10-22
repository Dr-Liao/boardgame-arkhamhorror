// 03296 圣奥伯特礼拜堂
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：flood
// 卡面：你剩余神智值为3点或更少才可在圣奥伯特礼拜堂发现线索。
// 卡面：[action]：受到最多3点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 90 轮：黑星升起的礼拜堂 / 修道院塔楼。

export default {
  code: '03296', scope: 'location',
  locationRule: {
    investigationError(state, inv) {
      return (inv.maxSanity || inv.sanity || 0) - (inv.horror || 0) > 3 ? '剩余神智必须为3点或更少' : null
    },
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'takeChapelHorror', label: '受到最多3点恐惧' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'takeChapelHorror') return false
      const amount = Number(api.choose({
        kind: 'harm', source: '03296', seat: inv.seat, prompt: '选择受到多少点恐惧。',
        options: Array.from({ length: 4 }, (_, value) => ({ id: String(value), label: `${value}点恐惧` })),
      }))
      if (amount) api.horror(inv.seat, amount)
      return true
    },
  },
}
