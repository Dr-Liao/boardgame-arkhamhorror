// 04021 爱丽·霍洛维兹博士
// 卡面：[reaction]在爱丽·霍洛维兹博士入场后：查找你牌库顶的9张卡牌，找出一张[[遗物]]支援卡牌，将其附属到爱丽·霍洛维兹博士上。混洗你的牌库。
// 卡面：附属在爱丽·霍洛维兹博士上的每张[[遗物]]支援卡牌均不占用任何槽位(这些卡牌仍视为在场上并由你控制)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04021 爱丽·霍洛维兹博士：入场后查找牌库顶 9 张，找出一张[[遗物]]支援并附属到自身。
// 5c-19：不再走 tfaPlayer 逃生原语；读牌库顶/筛选/选择/附属/洗回都在 resolve 里，
// 由 api.topDeckCodes / attachCardFromDeck / shuffleDeck 结算（读点仍是 entersPlay）。

export default {
  code: '04021',
  abilities: [
    {
      kind: 'entersPlay', label: '入场：查找牌库顶 9 张中的[[遗物]]支援并附属',
      resolve: ({ inv, source, api }) => {
        const top = api.topDeckCodes(inv.seat, 9)
        const relics = [...new Set(top.filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).includes('relic') && api.isNonWeakness(code)))]
        if (!relics.length) {
          api.shuffleDeck(inv.seat)
          api.info('牌库顶 9 张里没有遗物支援，洗回牌库。')
          return
        }
        const chosen = relics.length === 1 ? relics[0] : api.choice({ kind: 'search', source: '04021', seat: inv.seat,
          prompt: '从牌库顶 9 张里选择 1 张遗物支援附属到爱丽·霍洛维兹博士。',
          options: relics.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })) })
        const picked = relics.includes(chosen) ? chosen : relics[0]
        api.attachCardFromDeck(source, picked)
        api.shuffleDeck(inv.seat)
        api.info(`「${api.cardName(picked)}」被附属到「${api.cardName('04021')}」，不占用槽位。`)
      },
    },
  ],
  modifiers: [

  ],
}
