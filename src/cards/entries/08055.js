// 08055 黑市（Black Market）· 游荡者事件 · 1 经验。
//
// 卡面：快速。当调查阶段开始时打出。
//       从任意位调查员的牌库顶依次揭示卡牌，直到正好揭示 5 张卡牌。将这些卡牌放在一边，位于场外。
//       这些卡牌放在一边时，任意调查员可以将其打出，如同是自己手牌。
//       当下个调查阶段开始时，将这些卡牌中仍放在一边的洗回其所有者的牌库。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation:
//   · 「放一边」用「移入原所有者弃牌堆 + api.playCardFromDiscard」近似（引擎没有 setAside 的
//     「如同手牌」通道）；打出后按正常弃牌/结算。
//   · 未在本次结算中打出的牌留在弃牌堆（「下个调查阶段开始时洗回牌库」需要跨阶段效果读点，
//     待 P7/原语接线）。
export default {
  code: '08055',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'investigationPhaseStarts',
      label: '快速：从任意调查员牌库顶揭示共 5 张「放在一边」；这些牌可被其所有者立即打出',
      resolve: ({ state, inv, api }) => {
        const revealed = []
        for (let i = 0; i < 5; i++) {
          const candidates = state.investigators.filter(owner => !owner.defeated && !owner.resigned
            && Array.isArray(owner.deck) && owner.deck.length > 0)
          if (!candidates.length) break
          const seatId = candidates.length === 1 ? String(candidates[0].seat)
            : api.choice({ kind: 'investigator', source: '08055', seat: inv.seat,
              prompt: `选择从哪位调查员的牌库顶揭示第 ${i + 1} 张「放在一边」的卡牌？`,
              options: candidates.map(owner => ({ id: String(owner.seat), label: owner.name })) })
          const owner = state.investigators[Number(seatId)] || candidates[0]
          const code = owner.deck[owner.deck.length - 1]
          if (!code) continue
          api.moveCard({ code, from: 'deck', to: 'discard', ownerSeat: owner.seat })
          revealed.push({ seat: owner.seat, code, name: api.cardName(code) })
          api.info(`🕳️ 「黑市」：揭示 ${owner.name} 牌库顶的「${api.cardName(code)}」，放在一边（近似：置入其弃牌堆）。`)
        }
        if (!revealed.length) {
          api.info('「黑市」：没有可以揭示的牌库。')
          return
        }
        // 近似：把「放在一边期间可以打出」落成「其所有者现在可以立即从弃牌堆打出一次」。
        for (const item of revealed) {
          const owner = state.investigators[item.seat]
          if (!owner || owner.defeated || owner.resigned) continue
          const answer = api.choice({ kind: 'reaction', source: '08055', seat: item.seat, canSkip: true,
            prompt: `「黑市」：是否打出放在一边的「${item.name}」，如同其在你手牌中？`,
            options: [{ id: 'play', label: '打出' }, { id: 'skip', label: '留在一边' }] })
          if (answer !== 'play') continue
          api.playCardFromDiscard(item.seat, item.code, { noAction: true })
          api.info(`🕳️ 「黑市」：${owner.name} 从放在一边的牌中打出了「${item.name}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
