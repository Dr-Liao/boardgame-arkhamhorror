// 03264 原定计划
// 卡面：永久。卓越。
// 卡面：[reaction]你抽取起始手牌前：查找你的牌库，找出最多3张不同的[[策略]]和/或[[供给]]事件，并将其正面朝下附属到原定计划。(FAQ，v2.0)混洗你的牌库。
// 卡面：附属到原定计划的卡牌可以被打出，如同其在你手中。作为打出一张附属卡牌的额外费用，横置原定计划。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03264 原定计划：永久支援；开局从牌库挑最多 3 张「战术/补给」事件附属到它上面，
// 之后这些牌可以像手牌一样打出（读点见 doPlay / legalMoves / validateMove 的 cardPlan）。

export default {
  code: '03264',
  cardPlan: true,
  passive: { permanent: true },
  abilities: [
    {
      kind: 'setup', label: '开局：从牌库附属最多 3 张战术/补给事件',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        source.attached ||= []
        const selectedNames = new Set()
        while ((source.attached || []).length < 3) {
          const candidates = inv.deck.map((code, index) => ({ code, index }))
            .filter(item => api.cardType(item.code) === 'event'
              && api.cardTraits(item.code).some(trait => trait === 'tactic' || trait === 'supply')
              && !selectedNames.has(api.cardName(item.code)))
          if (!candidates.length) break
          const answer = api.choice({ kind: 'card', source: '03264', seat: inv.seat, canSkip: true,
            prompt: `选择附属到「原定计划」的事件（还可选择 ${3 - (source.attached || []).length} 张）。`,
            options: [{ id: 'done', label: '完成' },
              ...candidates.map(item => ({ id: String(item.index), cardCode: item.code, label: api.cardName(item.code) }))] })
          if (answer === 'done') break
          const picked = candidates.find(item => item.index === Number(answer))
          if (!picked) break
          api.attachToHostByCode(source, picked.code)
          selectedNames.add(api.cardName(picked.code))
        }
        api.shuffleDeck(inv.seat)
        api.info(`${inv.name} 将 ${(source.attached || []).length} 张事件附属到「原定计划」。`)
      },
    },
  ],
  modifiers: [

  ],
}
