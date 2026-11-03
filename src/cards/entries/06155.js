// 06155 森哲夫
// 卡面：对你所在地点其他调查员造成的伤害和/或恐惧，可以分配给森哲夫。
// 卡面：[reaction]在森哲夫被击败时：选择你所在地点的一位调查员。该调查员查找自己牌库顶的9张卡牌
//       或弃牌堆，找出一张[[道具]]支援，将其加入自己的手牌。如果查找过牌库，将其混洗。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 被击败窗口 assetDefeated（P6 原语，src/engine/asset-defeat.js），context 带 asset/assetCode；
//   · 牌库顶 9 张只读 state.investigators[seat].deck 尾部（可读状态），选中后 api.moveCard 进手牌 + api.shuffleDeck；
//   · 弃牌堆同样用 api.moveCard(from:'discard')。
//   · 同地点其他调查员的伤害/恐惧承接由 passive.assignHarmAtLocation 进入分配候选。

export default {
  code: '06155',
  passive: { assignHarmAtLocation: true },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      id: 'tetsuoMoriDefeatedSearch',
      label: '被击败时：目标调查员从弃牌堆/牌库顶 9 张找一张[[道具]]支援加入手牌',
      criteria: [({ context, source }) => context?.assetCode === '06155' && context.asset?.id === source?.id],
      resolve: ({ state, inv, api }) => {
        const targets = api.investigatorsAt(inv.location)
        if (!targets.length) { api.info('所在地点没有调查员。'); return }
        const targetSeat = targets.length === 1 ? targets[0].seat : Number(api.choice({
          kind: 'investigator', source: '06155', seat: inv.seat,
          prompt: '选择要为其查找[[道具]]支援的调查员。',
          options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })),
        }))
        const target = state.investigators[targetSeat]
        if (!target) return
        const isItemAsset = code => api.cardType(code) === 'asset'
          && (api.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'item')
        const from = api.choice({
          kind: 'zone', source: '06155', seat: target.seat,
          prompt: `${target.name} 查找牌库顶 9 张，还是查找弃牌堆？`,
          options: [{ id: 'deck', label: '牌库顶 9 张' }, { id: 'discard', label: '弃牌堆' }],
        })
        const searched = from === 'deck' ? (target.deck || []).slice(-9) : (target.discard || [])
        const matches = [...new Set(searched.filter(isItemAsset))]
        const code = matches.length === 1 ? matches[0] : matches.length ? api.choice({
          kind: 'card', source: '06155', seat: target.seat,
          prompt: `${target.name} 选择一张[[道具]]支援加入手牌。`,
          options: matches.map(item => ({ id: item, cardCode: item, label: api.cardName(item) })),
        }) : null
        if (code) api.moveCard({ code, from, to: 'hand', ownerSeat: target.seat })
        if (from === 'deck') api.shuffleDeck(target.seat)
        api.info(code
          ? `${target.name} 把「${api.cardName(code)}」（${from === 'deck' ? '牌库顶 9 张' : '弃牌堆'}）加入手牌${from === 'deck' ? '，并混洗牌库' : ''}。`
          : `${target.name} 在${from === 'deck' ? '牌库顶 9 张' : '弃牌堆'}中没有找到[[道具]]支援${from === 'deck' ? '，并混洗牌库' : ''}。`)
      },
    },
  ],
  modifiers: [],
}
