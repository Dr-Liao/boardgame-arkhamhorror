// 60422 永夜长袍
// 卡面：[reaction]你打出一张[[法术]]卡牌时，横置永夜长袍：该卡牌的费用减少1。打出该卡牌不会引发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import robes from './60412.js'

export default {
  ...robes,
  code: '60422',
  abilities: [{
    ...robes.abilities[0],
    label: '横置：本次打出的法术费用 -1，且不会引发趁乱攻击',
    resolve: ({ context, api }) => api.playerTools.modifyPlay(context, { discount: 1, noOpportunityAttack: true }),
  }],
}
