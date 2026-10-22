// 03092 邪念扭曲
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：evil_portents
// 卡面：显现 - 如果场上没有毁灭标记，邪念扭曲获得涌动。否则，检定[willpower](X)，其中X为场上的毁灭标记总数。如果你检定失败，随机弃掉你2张手牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03092', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const doom = state.doom + state.locations.reduce((sum, location) => sum + (location.doom || 0), 0)
      + state.enemies.reduce((sum, enemy) => sum + (enemy.doom || 0), 0)
    if (!doom) {
      api.drawEncounter(inv.seat)
      return false
    }
    api.test(inv.seat, 'willpower', doom, result => {
      if (!result.success) api.discardRandom(inv.seat, 2)
    })
    return false
  },
}
