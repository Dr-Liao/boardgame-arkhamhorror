// 02222 怪异标记
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：显现 - 检定[intellect](3)。如果你检定失败，从供应堆将1个线索加到你所在地点(如果有3或4位调查员，则改为2个线索)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02222', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'intellect', 3, result => {
      if (!result.success) {
        const location = state.locations.find(item => item.id === inv.location)
        if (location) location.clues += state.numInvestigators >= 3 ? 2 : 1
      }
    })
    return false
  },
}
