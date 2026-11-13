// 09047 震撼发现（Captivating Discovery）· 探求者事件 · 1 费。
// 卡面：查找你牌库顶的 6 张卡牌。你可以将你最多 3 个线索放到你所在地点。每以此方式放置 1 个线索，
//       选择并将 2 张查找的卡牌加入你的手牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：牌库顶 6 张（deck 末尾是顶）先当「查找区」；每放 1 个线索（api.spendClueToLocation）
// 就从未取走的查找牌里选 2 张（api.choice），用 api.takeFromDeck 移出牌库并 api.putInHand 入手；
// 最后 api.shuffleDeck 混洗。
const SOURCE = '09047'

export default {
  code: '09047',
  abilities: [
    {
      kind: 'played',
      label: '查找牌库顶 6 张：最多放 3 个线索，每放 1 个选 2 张入手，然后混洗',
      resolve: ({ state, inv, api }) => {
        const owner = state.investigators[inv.seat]
        const searched = (owner.deck || []).slice(-6)
        if (!searched.length) {
          api.info('震撼发现：牌库是空的。')
          return
        }
        let placed = 0
        const taken = []
        for (; placed < 3; placed++) {
          if ((owner.clues || 0) <= 0) break
          const remaining = searched.filter(code => !taken.includes(code))
          if (!remaining.length) break
          const answer = api.choice({
            kind: 'effect', source: SOURCE, seat: inv.seat,
            prompt: `震撼发现：是否放置第 ${placed + 1} 个线索，从查找的 ${remaining.length} 张里取 2 张？`,
            options: [{ id: 'place', label: '放置 1 个线索并取 2 张牌' }, { id: 'stop', label: '停止放置' }],
          })
          if (answer !== 'place') break
          api.spendClueToLocation(inv.seat, 1)
          for (let pick = 0; pick < 2; pick++) {
            const pool = searched.filter(code => !taken.includes(code))
            if (!pool.length) break
            const code = pool.length === 1 ? pool[0] : api.choice({
              kind: 'card', source: SOURCE, seat: inv.seat,
              prompt: '震撼发现：选择要加入手牌的一张牌。',
              options: [...new Set(pool)].map(item => ({ id: item, label: api.cardName(item), cardCode: item })),
            })
            const chosen = pool.includes(code) ? code : pool[0]
            taken.push(chosen)
          }
        }
        if (taken.length) {
          api.takeFromDeck(inv.seat, taken)
          for (const code of taken) api.putInHand(inv.seat, code)
          api.info(`震撼发现：放置 ${placed} 个线索，取走 ${taken.length} 张牌。`)
        } else {
          api.info('震撼发现：没有放置线索，未取牌。')
        }
        api.shuffleDeck(inv.seat)
      },
    },
  ],
  modifiers: [],
}
