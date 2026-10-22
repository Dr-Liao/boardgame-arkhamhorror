// 02102 奥术屏障
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：the_beyond
// 卡面：显现 - 附属到你所在地点。
// 卡面：作为移动进入或离开附属地点的额外费用，检定[willpower](4)。如果检定成功，弃掉奥术屏障。否则，你必须取消该次移动的效果，或者弃掉你牌库顶5张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 奥术屏障（02102）：地点计数器型障碍。引擎按 `locationBarrier.counter` 找规则，
// 检定难度、取消/继续选项与「弃牌库顶 N 张」都由这张卡声明（REPORT.md §9 第 1 批）。

export default {
  code: '02102', implemented: true,
  name: '奥术屏障',
  scope: 'treachery',
  text: '放置到当前地点。离开/进入带此障碍的地点时，意志(4)检定；失败可以取消移动，或弃掉牌库顶 5 张牌继续。',
  locationCounter: 'arcaneBarriers',
  locationBarrier: {
    counter: 'arcaneBarriers',
    label: '奥术屏障',
    test: { skill: 'willpower', difficulty: 4 },
    prompt: '奥术屏障：取消移动，或弃掉牌库顶 5 张牌继续移动。',
    options: [
      { id: 'cancel', label: '取消移动' },
      { id: 'mill', label: '弃掉 5 张牌继续移动', mill: 5 },
    ],
  },
  encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const location = state.locations.find(item => item.id === inv.location)
    location.arcaneBarriers = (location.arcaneBarriers || 0) + 1
    return true
  },
}
