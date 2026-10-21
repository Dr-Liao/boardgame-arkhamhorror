// 03273 求生高手
// 卡面：将你弃牌堆中的3张[[天性]]技能返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03273 幸存者：至多 3 次，把弃牌堆里的天生技能牌返回手牌。

export default {
  code: '03273',
  abilities: [
    {
      kind: 'played', label: '幸存者',
      resolve: ({ inv, api }) => {
        const candidates = inv.discard.filter(code => api.cardType(code) === 'skill'
          && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'innate'))
        for (let count = 0; count < 3 && candidates.length; count++) {
          const chosen = api.choice({ kind: 'card', source: '03273', seat: inv.seat, prompt: '选择返回手牌的天生技能。',
            options: candidates.map((item, index) => ({ id: String(index), cardCode: item, label: api.cardName(item) })) })
          const index = Number(chosen)
          const picked = candidates.splice(Number.isInteger(index) ? index : 0, 1)[0]
          if (!picked) break
          api.moveCard({ code: picked, from: 'discard', to: 'hand' })
        }
      },
    },
  ],
  modifiers: [

  ],
}
