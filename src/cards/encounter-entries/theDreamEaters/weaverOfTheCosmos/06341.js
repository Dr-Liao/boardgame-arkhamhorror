// 06341 巨网·宇宙之网（地点，2 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：强制 - 你进入本地点后：检定[willpower](3)。如果你检定失败，你必须放置 1 个毁灭
//       标记到本地点，或者每低于难度 1 点就选择并弃掉 1 张手牌。
// 引擎直读 locationRule.onEnter.effect（movement.js）：检定失败差值 = 3 - 检定值。
export default {
  code: '06341',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv) return
        api.test?.(inv.seat, 'willpower', 3, result => {
          if (result.success) return
          const failedBy = Math.max(1, 3 - Number(result.value || 0))
          const canDiscard = (inv.hand || []).length > 0
          const options = [
            ...(canDiscard
              ? [{ id: 'discard', label: `弃掉 ${Math.min(failedBy, inv.hand.length)} 张手牌` }]
              : []),
            { id: 'doom', label: `在「${location.name}」上放置 1 个毁灭标记` },
          ]
          const answer = options.length === 1 ? options[0].id : api.choose({
            kind: 'location', source: location.id, seat: inv.seat,
            prompt: `进入「${location.name}」失败 ${failedBy} 点：弃牌，或在本地点的放 1 个毁灭标记。`,
            options,
          })
          if (answer === 'discard' && canDiscard) {
            api.discardChosen?.(inv.seat, Math.min(failedBy, inv.hand.length))
            api.info?.(`🕸️ 「${location.name}」：${inv.name} 弃掉 ${Math.min(failedBy, inv.hand.length)} 张手牌。`)
            return
          }
          api.locationDoom?.add(location, 1)
          api.info?.(`🕸️ 「${location.name}」：${inv.name} 在其上放置 1 个毁灭标记。`)
        })
      },
    },
  },
}
