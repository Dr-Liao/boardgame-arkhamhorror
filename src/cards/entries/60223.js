// 60223 惠顿·格林
// 卡面：只要你控制一张[[书籍]]或[[遗物]]支援，你得到+1[willpower]和+1[intellect]。
// 卡面：[reaction]你翻开一张地点卡或将一个新地点放置入场后，横置惠顿·格林：从你牌库顶9张卡牌中查找一张[[书籍]]或[[遗物]]支援，抽取它。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../cards-data.js'

function hasTomeOrRelic(inv) {
  return inv.assets.some(asset => ALL_CARDS[asset.code]?.traits?.some(trait => ['tome', 'relic'].includes(trait.toLowerCase())))
}

export default {
  code: '60223',
  modifiers: [
    { target: 'skill:intellect', amount: 1, condition: { when: ({ inv }) => hasTomeOrRelic(inv) } },
    { target: 'skill:willpower', amount: 1, condition: { when: ({ inv }) => hasTomeOrRelic(inv) } },
  ],
  abilities: [{
    kind: 'reaction', trigger: ['locationRevealed', 'locationPlaced'],
    label: '你揭示地点或放置新地点后横置：搜索牌库顶 9 张，抽取 1 张典籍或遗物支援',
    cost: { exhaust: true },
    criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ inv, api }) => api.searchTop(inv.seat, {
      amount: 9, typeFilter: 'asset', traits: ['Tome', 'Relic'], choose: 1,
      source: '60223',
    }),
  }],
}
