// 05023 宝剑王牌
// 卡面：你得到+1[combat]。
// 卡面：[reaction]在游戏开始时，如果宝剑王牌在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05023 宝剑王牌：+1 战斗；[反应]游戏开始时若在起始手牌，将其放置入场。

import { skillModifier } from './_shared.js'

export default {
  code: '05023',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05023')) return
        api.putIntoPlay(inv.seat, '05023')
      },
    },
  ],
}
