// 05031 月亮·XVIII
// 卡面：你得到+1[agility]。
// 卡面：[reaction]在游戏开始时，如果月亮·XVIII在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05031 月亮·XVIII：塔罗槽支援；+1 敏捷；开局起始手牌中放置入场。

import { skillModifier } from './_shared.js'

export default {
  code: '05031',
  entersPlayFromOpeningHand: true,
  modifiers: [
    skillModifier('agility', 1),
  ],
  abilities: [
    {
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05031')) return
        api.putIntoPlay(inv.seat, '05031')
      },
    },
  ],
}
