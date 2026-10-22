// 03090 黑星升起
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：evil_portents
// 卡面：显现 - 检定[intellect](4)。如果你检定失败，你必须在当前密谋上放置1个毁灭标记，或每低于难度1点就受到1点恐惧。本效果能导致当前密谋推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03090', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'intellect', 4, result => {
      if (result.success) return
      const deficit = Math.max(1, result.difficulty - result.value)
      const choice = api.choose({
        kind: 'encounter', source: '03090', seat: inv.seat,
        prompt: '黑星升起：选择在当前议程放置 1 毁灭，或承受等同失败差值的恐惧。',
        options: [{ id: 'doom', label: '在当前议程放置 1 毁灭' },
          { id: 'horror', label: `承受 ${deficit} 恐惧` }],
      })
      if (choice === 'doom') api.addDoom(1)
      else api.horror(inv.seat, deficit)
    })
    return false
  },
}
