// 03082 正式晚宴
// 归属：关卡专用 · theLastKing（卡尔克萨之路 · 最后的王者）
// 遭遇组：the_last_king
// 卡面：险境。
// 卡面：显现 - 你必须将你的1个线索放置到场上一个[[旁人]]支援上，或受到1点恐惧和1点伤害。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 113 轮：最后之王的两张遭遇。

export default {
  code: '03082', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const bystanders = state.storyAssets.filter(asset => ['03076a', '03077', '03078', '03079', '03080'].includes(asset.code))
    const options = [{ id: 'harm', label: '受到1点伤害和1点恐惧' }]
    if (inv.clues > 0 && bystanders.length) {
      options.unshift(...bystanders.map(asset => ({
        id: asset.id,
        label: `将1个线索放到${asset.name}`,
      })))
    }
    const choice = options.length === 1 ? 'harm' : api.choose({
      kind: 'target', source: '03082', seat: inv.seat,
      prompt: '盛宴：选择将线索放到一名旁人上，或受到伤害和恐惧。',
      options,
    })
    if (choice === 'harm') {
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
    } else {
      const guest = bystanders.find(asset => asset.id === choice)
      if (guest) {
        api.spendClues(inv.seat, 1)
        guest.clues = (guest.clues || 0) + 1
      }
    }
    return false
  },
}
