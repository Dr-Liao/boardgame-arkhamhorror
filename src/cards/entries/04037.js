// 04037 背包
// 卡面：[reaction]在背包入场后：查找你牌库顶的6张卡牌，找出最多3张非弱点[[道具]]或[[供给]]卡牌，正面朝下附属到背包上。混洗你的牌库。
// 卡面：附属到背包的卡牌可以被打出，如同其在你手中。如果没有卡牌附属在背包，弃掉背包。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04037 背包：入场时从牌库顶 6 张挑最多 3 张道具/补给放进 attachedCards；
// 其中的牌可以像手牌一样打出（读点见 doPlay / legalMoves / validateMove 的 cardBackpack）。

export default {
  code: '04037',
  cardBackpack: true,
  abilities: [
    {
      kind: 'entersPlay', label: '入场：从牌库顶 6 张挑最多 3 张道具/补给放进背包',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const top = api.topDeckCodes(inv.seat, 6).reverse()
        const remaining = top.filter(code => api.cardType(code) && api.isNonWeakness(code)
          && api.cardTraits(code).some(trait => trait === 'item' || trait === 'supply'))
        const chosen = []
        while (chosen.length < 3 && remaining.length) {
          const answer = api.choice({ kind: 'card', source: '04037', seat: inv.seat, canSkip: true,
            prompt: `背包：选择要附属的卡（已选 ${chosen.length}/3）。`,
            options: [{ id: 'done', label: '完成附属' },
              ...remaining.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done') break
          const picked = remaining.splice(Number(answer), 1)[0]
          if (picked) chosen.push(picked)
        }
        api.takeFromDeck(inv.seat, chosen)
        api.shuffleDeck(inv.seat)
        api.setAttachedCards(source, chosen)
        if (!chosen.length) {
          api.discardAsset(inv.seat, source)
          api.info('🎒 背包里没有可附属的道具/补给，弃掉背包。')
          return
        }
        api.info(`🎒 背包附属了 ${chosen.length} 张牌：${chosen.map(code => api.cardName(code)).join('、')}。`)
      },
    },
  ],
  modifiers: [

  ],
}
