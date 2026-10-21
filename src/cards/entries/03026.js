// 03026 殚精竭虑
// 卡面：选择你所在地点的一位调查员。该调查员查找其牌库顶6张卡牌，找出一张卡牌，将其抽取，并混洗其牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- Phase 5（5c 首批）：卡尔克萨 6 张 ----
// 迁移纪律与 Phase 2 相同：旧条目（content/packs/carcosaPlayer/effects.js 的 custom('…')）
// 与 engine.js 的 `if (effect.action === '…')` 分支同时删除，日志/询问文案逐字保留。
// 03026 殚精竭虑：选择同地点一名调查员，搜索其牌库顶 6 张（原 noStoneUnturned）。

import { searchInvestigatorDeck } from './_shared.js'

export default {
  code: '03026',
  abilities: [
    {
      kind: 'played', label: '搜索同地点一名调查员的牌库顶 6 张',
      resolve: ({ inv, api }) => searchInvestigatorDeck(inv, api, 6),
    },
  ],
  modifiers: [

  ],
}
