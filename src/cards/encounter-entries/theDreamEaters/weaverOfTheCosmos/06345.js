// 06345 巨网·网编浮岛（地点，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：作为调查本地点的额外费用，你必须要么花费 1 个行动，要么在本地点上放置 1 个毁灭标记。
// 引擎没有「调查额外费用」的地点直读点；章节 behavior.beforeInvestigate（actions.js 扣行动前）
// 派发 locationRule.beforeInvestigate：能支付（≥2 行动）时二选一，否则只能放置毁灭；
// 额外行动由 api.spendAction 立即扣（本次调查本身的 1 行动由引擎照常扣）。
export default {
  code: '06345',
  scope: 'location',
  implemented: true,
  locationRule: {
    beforeInvestigate(state, inv, location, api) {
      if (!inv || inv.location !== location.id) return
      const canPayAction = (inv.actionsLeft || 0) >= 2
      const options = [
        ...(canPayAction ? [{ id: 'action', label: '花费 1 个行动' }] : []),
        { id: 'doom', label: `在「${location.name}」上放置 1 个毁灭标记` },
      ]
      const answer = options.length === 1 ? options[0].id : api.choose({
        kind: 'location', source: location.id, seat: inv.seat,
        prompt: `调查「${location.name}」的额外费用：花费 1 个行动，或放置 1 个毁灭标记。`,
        options,
      })
      if (answer === 'action' && canPayAction) {
        api.spendAction?.(inv.seat)
        api.info?.(`🕸️ 「${location.name}」：${inv.name} 额外花费 1 个行动。`)
        return
      }
      api.locationDoom?.add(location, 1)
      api.info?.(`🕸️ 「${location.name}」：${inv.name} 在其上放置 1 个毁灭标记。`)
    },
  },
}
