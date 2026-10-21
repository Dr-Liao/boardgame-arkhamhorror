// 03307 殚精竭虑
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：选择你所在地点的一位调查员。该调查员查找其牌库，找出一张卡牌，将其抽取，并混洗其牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03307 不入虎穴：快速事件；搜索同地点一名调查员的全部牌库（原 noStoneUnturned amount: 'all'）。

import { searchInvestigatorDeck } from './_shared.js'

export default {
  code: '03307',
  abilities: [
    {
      kind: 'played', fast: true, label: '搜索同地点一名调查员的全部牌库',
      resolve: ({ state, inv, api }) => searchInvestigatorDeck(inv, api, 'all', state),
    },
  ],
  modifiers: [

  ],
}
