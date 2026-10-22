// 03295 骑士大厅
// 归属：关卡专用 · blackStarsRise（卡尔克萨之路 · 黑星升起）
// 遭遇组：black_stars_rise
// 卡面：[action]如果骑士大厅没有线索：调查。不使用[intellect]，改为使用[agility]调查。如果你检定成功，不发现线索，改为记住你“找到了塔楼的钥匙”。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03295', scope: 'location',
  locationRule: {
    actions({ state, location, moves }) {
      if (state.scenarioFlags.foundTowerKey) return
      moves.push({ action: 'scenarioAction', actionKind: 'investigate', rule: 'findTowerKey',
        label: '使用敏捷调查骑士大厅，寻找塔楼钥匙',
        reason: location.clues === 0 ? null : `需要先取走骑士大厅的全部线索（还剩 ${location.clues} 个）` })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'findTowerKey') return false
      const location = state.locations.find(item => item.id === inv.location)
      if (!location || location.clues > 0 || state.scenarioFlags.foundTowerKey) {
        throw new Error('骑士大厅能力当前不可用')
      }
      const difficulty = location.shroud + (location.shroudMod || 0) + (state.fogMod || 0)
      api.test(inv.seat, 'agility', difficulty, result => {
        if (result.success) state.scenarioFlags.foundTowerKey = true
      }, 0, { action: 'investigate', label: '骑士大厅寻找塔楼钥匙' })
      return true
    },
  },
}
