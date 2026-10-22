// 04010 走私货物
// 卡面：芬恩·爱德华兹牌库专用。
// 卡面：你所在地点没有处于重整状态的敌人才能打出。
// 卡面：查找你的弃牌堆或你牌库顶9张卡牌，找出一张[[违法]]卡牌并将其抽取。如果你查找了你的牌库，将走私货物洗入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04010 走私货物：查找牌库顶 9 张或弃牌堆中的[[违法]]卡，加入手牌。

export default {
  code: '04010',
  playRestriction: 'noReadyEnemy',
  abilities: [
    {
      kind: 'played', label: '查找牌库顶 9 张或弃牌堆中的违法卡',
      resolve: ({ state, inv, api }) => {
        const illicit = code => api.cardTraits(code).some(trait => ['illicit', '违法'].includes(trait))
        const options = [{ id: 'deck', label: '查看牌库顶 9 张' }]
        if (inv.discard.some(illicit)) options.push({ id: 'discard', label: '查看弃牌堆' })
        const zone = api.choice({ kind: 'effect', source: '04010', seat: inv.seat,
          prompt: '走私货物：选择查找的区域。', options })
        if (zone === 'discard') {
          const matches = [...new Set(inv.discard.filter(illicit))]
          if (!matches.length) return
          const chosen = api.choice({ kind: 'target', source: '04010', seat: inv.seat,
            prompt: '选择加入手牌的违法卡。',
            options: matches.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
          api.moveCard({ code: chosen, from: 'discard', to: 'hand' })
          api.info(`${inv.name} 从弃牌堆找回了「${api.cardName(chosen)}」。`)
          return
        }
        api.searchTop(inv.seat, { amount: 9, trait: 'Illicit', traitZh: '违法', source: '04010', mandatory: true })
        // 查找了牌库：结算后把走私货物洗回牌库，而不是进弃牌堆。
        state._playDisposal = 'shuffleBack'
      },
    },
  ],
  modifiers: [

  ],
}
