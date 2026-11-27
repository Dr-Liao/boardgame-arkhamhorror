// 08586 回首往事：受 2 恐惧，或在当前密谋上放置可触发推进的 1 毁灭。
const CODE = '08586'

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const choice = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '回首往事：选择一项。',
      options: [{ id: 'horror', label: '受到 2 点恐惧' }, { id: 'doom', label: '在当前密谋放置 1 个毁灭' }] })
    if (choice === 'doom') api.addDoom(1)
    else if (choice === 'horror') api.horror(inv.seat, 2)
    return false
  },
}
