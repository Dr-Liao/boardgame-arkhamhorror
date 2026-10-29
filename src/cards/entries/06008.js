// 06008 神秘证据
// 卡面：曼蒂·汤普森牌库专用。将神秘证据混洗入你的牌库。
//       [reaction] 在你查找牌库时，若查找过的卡牌中有神秘证据，将其揭示：抽取该卡牌并发现你所在地点的
//       1 个线索。(每次查找最多使用 1 次[[研究]]能力。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：P6 原语 `searchedCardRule`（src/engine/deck-ops.js）——这张牌自己还在牌库里，
// 引擎的能力源枚举看不到它，因此把「被找到时」的规则写成条目级数据：
// take（抽走）+ discoverClue（发现线索）。mode: 'reaction' 表示会先询问是否结算。

export default {
  code: '06008',
  shuffleBackAfterPlay: true,
  searchedCardRule: {
    mode: 'reaction',
    label: '揭示神秘证据：抽走它并发现 1 个线索',
    prompt: '查找的牌中有「神秘证据」：揭示并抽走它，发现你所在地点的 1 个线索？',
    take: true,
    discoverClue: 1,
  },
  abilities: [
    {
      kind: 'played',
      label: '洗回牌库',
      resolve: ({ api, inv }) => api.info(`${inv.name} 将「神秘证据」洗回牌库。`),
    },
  ],
  modifiers: [],
}
