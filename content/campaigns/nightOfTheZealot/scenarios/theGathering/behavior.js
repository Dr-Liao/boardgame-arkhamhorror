export const behavior = Object.freeze({
  id: 'theGathering',
  setupLocations: () => ['study'],
  houseFateChoice: true,
  roundEndActIndex: 1,
  litaParleyActIndex: 2,
  investigatorEntryError(state, location) {
    // Also enforce the act gate for old saves that revealed the Parlor too early.
    if (location.id === 'parlor' && (state.actIndex < 2 || !location.revealed)) {
      return '灼热屏障尚未解除，不能进入客厅'
    }
    return null
  },
  // 客厅谈判（取得丽塔控制权）：条件不满足时也返回，带上缺什么，AI 才知道她在哪个地点。
  actions(state, inv) {
    const parlorId = state.locations.find(location => location.parley)?.id
    const lita = (state.storyAssets || []).find(asset => asset.code === '01117' && asset.controllerSeat == null)
    if (!parlorId || !lita) return []
    const litaAt = state.locations.find(location => location.id === lita.location)?.name || lita.location
    const here = inv.location === parlorId && lita.location === inv.location
    return [{ action: 'parleyLita', label: '🤝 谈判丽塔·钱德勒（智识 4，取得控制权）',
      reason: state.actIndex !== 2 ? '需要推进到幕三' : here ? null : `需要与丽塔位于同一地点（她在「${litaAt}」）` }]
  },
  resolution(state, key, events, api) {
    const { campaign } = state
    const rec = campaign.records
    const lead = state.investigators[campaign.leadSeat]
    rec.houseBurned = key === 'r1'
    rec.ghoulPriestAlive = !['r1', 'r2'].includes(key)
    if (key === 'r3') {
      rec.litaForcedOthers = true
      for (const inv of state.investigators) if (!inv.resigned) campaign.investigators[inv.seat].status = 'killed'
    }
    if (key !== 'r2') api.addLitaToCampaign(state)
    if (key === 'r1') api.addTrauma(state, lead.seat, 'mental', 1, events)
    return { bonus: 2, award: key !== 'r3', seatBonus: seat => key === 'r2' && seat === lead.seat ? 1 : 0 }
  },
})
