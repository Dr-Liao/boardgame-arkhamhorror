// 05023 宝剑王牌
// 卡面：你得到+1[combat]。
// 卡面：[reaction]在游戏开始时，如果宝剑王牌在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05023 宝剑王牌：+1 战斗；游戏开始时若在起始手牌，将其放置入场。
// 开局入场有两个等价读点：P2.9 的条目级标记 `entersPlayFromOpeningHand`（引擎在抽完起始手牌后
// 自动放置，见 src/engine/tarot-slot.js），以及卡面印刷的反应（牌桌窗口里的可触发时机）。
// 两者并存时不会重复：反应 resolve 里先检查这张牌是否还在手牌。

import { skillModifier } from './_shared.js'

export default {
  code: '05023',
  entersPlayFromOpeningHand: true,
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
