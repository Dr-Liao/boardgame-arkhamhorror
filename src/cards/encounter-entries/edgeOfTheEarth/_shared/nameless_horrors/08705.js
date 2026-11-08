// 08705 噩梦烟气（Nightmare Smoke）· 诡计 · nameless_horrors
// 卡面：险境。显现 - 你必须选择一项：失去 2 个行动；或将忒咳哩-哩牌库顶的 2 张卡牌洗入你的牌库，
//   不要查看内容。
export default {
  code: '08705', scope: 'treachery', implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const pick = api.choice({ kind: 'effect', source: '08705', seat: inv.seat,
      prompt: '「噩梦烟气」：选择一项。',
      options: [{ id: 'actions', label: '失去 2 个行动' }, { id: 'tekeli', label: '将忒咳哩-哩牌库顶 2 张洗入你的牌库' }] })
    if (pick !== 'tekeli') {
      api.loseActions(inv.seat, 2)
      return false
    }
    const size = Number(api.mechanics.tekeli.size())
    const shuffled = size > 0 ? api.mechanics.tekeli.shuffleIn(inv.seat, Math.min(2, size)) : false
    api.info('「噩梦烟气」：洗入 ' + (Array.isArray(shuffled) ? shuffled.length : 0) + ' 张忒咳哩-哩。')
    return false
  },
}

