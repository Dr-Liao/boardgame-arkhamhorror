// 05040 权杖王牌
// 卡面：[fast]在你回合期间，将权杖王牌从游戏中移除：你本回合可以进行额外1次行动，
//       在该次行动期间你得到每项技能+2。
// 卡面：[reaction]在游戏开始时，如果权杖王牌在你起始手牌中：将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05040 权杖王牌（塔罗槽）：
//   1. 自己回合内的免费能力：流放自身（exileSelf 费用）→ 本回合 +1 行动，并获得「本回合每项技能 +2」
//      的持续效果（state.effects，回合结束由引擎统一过期）；
//   2. 开局起始手牌中放置入场：只走 scenarioStarts 的 [reaction]（不使用引擎自动放置钩子，
//      保留「可以放置」的可选性；塔罗槽满时保留在手牌）。
// 显式简化：卡面写「该次额外行动期间 +2」，这里放宽为「本回合结束前 +2」（持续效果的到期点
// 只能按阶段/回合表达，没有「一次行动」的作用域）。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '05040',
  abilities: [
    {
      kind: 'action',
      label: '从游戏中移除：本回合额外 1 次行动，本回合每项技能 +2',
      cost: { action: false, exileSelf: true },
      criteria: [ownTurn()],
      resolve: ({ inv, api }) => {
        api.gainAction(inv.seat, 1)
        // R7：把「该次行动期间每项技能 +2」排到下一次行动开始时挂上（duration endOfAction，行动结束统一过期）。
        api.scheduleActionEffects([{
          label: '权杖王牌：该次行动每项技能 +2',
          modifiers: [{ target: 'skill:*', amount: 2 }],
        }])
        api.info(`🃏 ${inv.name} 将「${api.cardName('05040')}」移出游戏：本回合额外 1 次行动，该次行动期间每项技能 +2。`)
      },
    },
    {
      kind: 'reaction', trigger: 'scenarioStarts', label: '游戏开始时放置入场',
      fromHand: true, noPlayCost: true,
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05040')) return
        // 卡面 [reaction] 是「可以」放置：塔罗槽不足时保留在手牌，不自动入场。
        const slot = api.tarotSlotInfo(inv)
        if (slot.free <= 0) { api.info('塔罗槽已满，保留在手牌。'); return }
        api.putIntoPlay(inv.seat, '05040')
      },
    },
  ],
  modifiers: [

  ],
}
