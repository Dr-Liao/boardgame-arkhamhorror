// 05021 劫数延后
// 卡面：快速。只能在你回合期间打出。附属到你所在地点的一位调查员，置于该调查员控制之下。
// 卡面：[reaction]在你受到伤害和/或恐惧时：弃掉劫数延后并取消你刚受到的全部伤害和/或恐惧。
// 卡面：强制 - 在神话阶段结束时：你必须花费2资源或弃掉劫数延后。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05021 劫数延后：
//   1. 快速打出后自身放置入场（事件变场上卡，参照 04199「危险预感」的 becomesAsset 通道），
//      在场上时它的反应能力由能力层按资产来源枚举；
//   2. 受伤害/恐惧时弃掉自身并取消该次结算——把 harmDealt 窗口上下文的 damage/horror 归零
//      （该窗口的结算方在窗口后重新读取这两个值）；
//   3. 神话阶段结束时弃置：条目级 forcedMythosEndDiscard。

import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '05021',
  simplified: true,
  note: '未实现：卡面允许附属到同地点任意调查员（本实现只附属到自己）；神话阶段结束的「花 2 资源或弃掉」简化为直接弃掉。已实现快速打出、受伤害/恐惧时弃掉并取消该次全部伤害与恐惧。',
  forcedMythosEndDiscard: true,
  playCondition: [
    { when: ownTurn(), message: '只能在你回合期间打出' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      becomesAsset: true,
      label: '附属到场：准备取消下一次伤害/恐惧',
      resolve: ({ inv, api }) => {
        api.putSelfIntoPlay(inv.seat, '05021')
        api.info(`🛡️ ${inv.name} 打出「${api.cardName('05021')}」，将它放置入场。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      label: '弃掉劫数延后：取消刚受到的全部伤害和/或恐惧',
      cost: { discardSelf: true },
      criteria: [ownSeat()],
      resolve: ({ context, api }) => {
        const cancelled = { damage: context.damage || 0, horror: context.horror || 0 }
        context.damage = 0
        context.horror = 0
        api.info(`🛡️ 「${api.cardName('05021')}」取消了 ${cancelled.damage} 点伤害与 ${cancelled.horror} 点恐惧。`)
      },
    },
  ],
  modifiers: [

  ],
}
