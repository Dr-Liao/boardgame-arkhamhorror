// 09028 励志演讲（Motivational Speech）· 守卫者事件 · 0 费 · 谈判。
// 卡面：谈判。选择你所在地点的一位调查员。该调查者可从手牌打出一张[[盟友]]支援，其费用 -3。
//
// approximation：其他调查员的手牌折扣打出现在没有统一入口；本人用 playCard({discount:3})，
// 他人用 playCardFromOtherHand（不享受 -3，费用照付）——折扣只对本人生效。
export default {
  code: '09028',
  abilities: [{
    kind: 'played',
    countsAs: 'parley',
    noOpportunityAttack: true,
    label: '谈判：选择同地点调查员，从手牌以 -3 费打出一张盟友支援',
    resolve: ({ state, inv, api }) => {
      const others = api.investigatorsAt(inv.location).filter(item => item.seat !== inv.seat)
      const chosen = others.length
        ? api.choice({ kind: 'target', source: '09028', seat: inv.seat,
          prompt: '励志演讲：选择同地点的调查员。',
          options: [{ id: String(inv.seat), label: inv.name }, ...others.map(item => ({ id: String(item.seat), label: item.name }))] })
        : String(inv.seat)
      const seat = Number(chosen)
      const owner = state.investigators[seat] || inv
      const candidates = [...new Set((owner.hand || []).filter(code => api.cardType(code) === 'asset'
        && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'ally')))]
      if (!candidates.length) { api.info('励志演讲：没有可打出的盟友支援。'); return }
      const pick = api.choice({ kind: 'card', source: '09028', seat: inv.seat,
        prompt: '选择要以 -3 费打出的盟友支援。',
        options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
      if (seat === inv.seat) api.playCard(inv.seat, pick, { discount: 3, noAction: true })
      else api.playCardFromOtherHand(seat, pick)
    },
  }],
  modifiers: [],
}
