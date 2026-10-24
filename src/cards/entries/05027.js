// 05027 死神·XIII
// 卡面：你得到+1[intellect]。
// 卡面：[reaction]在游戏开始时，如果死神·XIII在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05027 死神·XIII：塔罗槽支援；+1 智识；开局起始手牌中放置入场
// （P2.9 条目级读点 entersPlayFromOpeningHand + 同一时机的反应）。

import { skillModifier } from './_shared.js'

export default {
  code: '05027',
  entersPlayFromOpeningHand: true,
  modifiers: [
    skillModifier('intellect', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05027')) return
        api.putIntoPlay(inv.seat, '05027')
      },
    },
  ],
}
