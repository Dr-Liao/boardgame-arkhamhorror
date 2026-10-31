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
// 显式简化（simplified）：「其他调查员的伤害/恐惧可以分配给森哲夫」——引擎的盟友吸收只覆盖控制者
// 本人的伤害/恐惧（assignHarm），没有跨调查员重定向原语。

export default {
  code: '06155',
  simplified: true,
  note: '未实现：「对你所在地点其他调查员造成的伤害和/或恐惧，可以分配给森哲夫」——'
    + '引擎的盟友吸收只覆盖控制者本人的伤害/恐惧，没有跨调查员重定向读取点。'
    + '被击败时的[[道具]]支援搜索（弃牌堆 / 牌库顶 9 张、搜牌库后混洗）已实现。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      id: 'tetsuoMoriDefeatedSearch',
      limit: 'oncePerTurn',
      label: '被击败时：目标调查员从弃牌堆/牌库顶 9 张找一张[[道具]]支援加入手牌',
      criteria: [({ context }) => context?.assetCode === '06155'],
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
        const discardMatches = [...new Set((target.discard || []).filter(isItemAsset))]
        const deckTop = (target.deck || []).slice(-9)
        const deckMatches = [...new Set(deckTop.filter(isItemAsset))]
        const options = []
        for (const code of discardMatches) options.push({ id: `discard:${code}`, label: `弃牌堆：${api.cardName(code)}` })
        for (const code of deckMatches) options.push({ id: `deck:${code}`, label: `牌库顶 9 张：${api.cardName(code)}` })
        if (!options.length) {
          api.info(`${target.name} 的弃牌堆与牌库顶 9 张里没有[[道具]]支援。`)
          return
        }
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'card', source: '06155', seat: target.seat,
          prompt: `${target.name} 选择一张[[道具]]支援加入手牌。`, options,
        })
        const [from, code] = String(answer).split(':')
        if (!code) return
        api.moveCard({ code, from: from === 'deck' ? 'deck' : 'discard', to: 'hand', ownerSeat: target.seat })
        if (from === 'deck') api.shuffleDeck(target.seat)
        api.info(`${target.name} 把「${api.cardName(code)}」（${from === 'deck' ? '牌库顶 9 张' : '弃牌堆'}）加入手牌${from === 'deck' ? '，并混洗牌库' : ''}。`)
      },
    },
  ],
  modifiers: [],
}
