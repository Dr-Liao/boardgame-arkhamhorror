// 06343 巨网·蛛茧之牢（地点，2 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：强制 - 在你进入本地点后：检定[agility](3)。如果你检定失败，你必须放置 1 个毁灭
//       标记到本地点，或者每低于难度 1 点就失去 1 个行动。
// 引擎直读 locationRule.onEnter.effect（movement.js）；失去行动走 api.loseActions（含取消窗口）。
export default {
  code: '06343',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv) return
        api.test?.(inv.seat, 'agility', 3, result => {
          if (result.success) return
          const failedBy = Math.max(1, 3 - Number(result.value || 0))
          const canLose = (inv.actionsLeft || 0) > 0
          const options = [
            ...(canLose ? [{ id: 'actions', label: `失去 ${failedBy} 个行动` }] : []),
            { id: 'doom', label: `在「${location.name}」上放置 1 个毁灭标记` },
          ]
          const answer = options.length === 1 ? options[0].id : api.choose({
            kind: 'location', source: location.id, seat: inv.seat,
            prompt: `进入「${location.name}」失败 ${failedBy} 点：失去行动，或放置 1 个毁灭标记。`,
            options,
          })
          if (answer === 'actions' && canLose) {
            api.loseActions?.(inv.seat, failedBy)
            api.info?.(`🕸️ 「${location.name}」：${inv.name} 失去 ${failedBy} 个行动。`)
            return
          }
          api.locationDoom?.add(location, 1)
          api.info?.(`🕸️ 「${location.name}」：${inv.name} 在其上放置 1 个毁灭标记。`)
        })
      },
    },
  },
}
