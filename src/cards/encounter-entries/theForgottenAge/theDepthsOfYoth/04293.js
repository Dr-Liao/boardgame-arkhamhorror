// 04293 坍塌的通道
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 在你位于坍塌的通道并尝试探索时，检查你的补给品。如果你没有鹤嘴锄：在坍塌的通道上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 87 轮：幽嘶深渊的坍塌通道、被遗弃的仪式场所与两张遭遇。

export default {
  code: '04293', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      if (api.hasSupply?.(inv.seat, 'pickaxe') ?? api.checkSupplies?.(inv.seat, 'pickaxe')) return true
      const location = state.locations.find(item => item.id === inv.location)
      if (location) location.doom = (location.doom || 0) + 1
      api.info?.(`坍塌的通道：${inv.name} 没有鹤嘴锄，此地点放置 1 点毁灭。`)
      return true
    },
  },
}
