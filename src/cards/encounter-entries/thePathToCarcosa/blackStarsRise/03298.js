// 03298 修道院塔楼
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：vortex
// 卡面：你没有手牌才可在修道院塔楼发现线索。
// 卡面：[action]：弃掉你最多3张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03298', scope: 'location',
  locationRule: {
    // 背面：没找到塔楼钥匙不能进入。引擎在地点揭示后不再调用 entryError。
    entryError(state) {
      return state.scenarioFlags?.foundTowerKey ? null : '需要先在骑士大厅找到塔楼钥匙'
    },
    investigationError(state, inv) { return inv.hand.length ? '必须没有手牌' : null },
    actions({ inv, moves }) {
      moves.push({ action: 'scenarioAction', rule: 'discardTowerCards', label: '弃掉最多3张手牌',
        reason: inv.hand.length ? null : '需要至少 1 张手牌' })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'discardTowerCards') return false
      if (!inv.hand.length) return false
      const amount = Number(api.choose({
        kind: 'discard', source: '03298', seat: inv.seat, prompt: '选择弃掉多少张手牌。',
        options: Array.from({ length: Math.min(3, inv.hand.length) + 1 }, (_, value) =>
          ({ id: String(value), label: `${value}张` })),
      }))
      if (amount) api.discardChosen(inv.seat, amount, '03298')
      return true
    },
  },
}
