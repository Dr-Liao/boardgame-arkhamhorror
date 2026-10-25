// 05023 宝剑王牌
// 卡面：你得到+1[combat]。
// 卡面：[reaction]在游戏开始时，如果宝剑王牌在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05023 宝剑王牌：+1 战斗；游戏开始时若在起始手牌，可以将其放置入场。
// 审计 R2：开局入场只走卡面的 [reaction]（scenarioStarts 窗口，由 setup 的 openAbilityWindow 打开），
// 不再声明引擎自动放置钩子 `entersPlayFromOpeningHand`——自动放置发生在窗口之前，
// 会吞掉「可以放置」的可选性，也不校验塔罗槽上限。
// 反应 resolve：先确认牌还在手牌，再用 api.canEquip 校验塔罗槽；槽满时保留在手牌。

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
        // 卡面 [reaction] 是「可以」放置：塔罗槽不足时保留在手牌，不自动入场。
        const slot = api.tarotSlotInfo(inv)
        if (slot.free <= 0) { api.info('塔罗槽已满，保留在手牌。'); return }
        api.putIntoPlay(inv.seat, '05023')
      },
    },
  ],
}
