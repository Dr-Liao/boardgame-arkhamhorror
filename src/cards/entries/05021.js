// 05021 劫数延后
// 卡面：快速。只能在你回合期间打出。附属到你所在地点的一位调查员，置于该调查员控制之下。
// 卡面：[reaction]在你受到伤害和/或恐惧时：弃掉劫数延后并取消你刚受到的全部伤害和/或恐惧。
// 卡面：强制 - 在神话阶段结束时：你必须花费2资源或弃掉劫数延后。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05021 劫数延后：
//   1. 快速打出后自身放置入场（事件变场上卡，becomesAsset 通道），在场上时其反应由资产来源枚举；
//   2. 受伤害/恐惧时弃掉自身并取消该次结算（harmDealt 上下文的 damage/horror 归零）；
//   3. 神话阶段结束时弃置：条目级 forcedMythosEndDiscard。
//
// 引擎缺口（task-46 复核）：doPlay 已放行 attachTo.kind:'investigator'，但打出后写入的
// inv.attachments 在事务提交后读取不到（探针：日志显示「附属到 X」，state.investigators[i].attachments
// 仍为 undefined，draft 内亦同），因此 investigator 附属无法被 descriptorSources 枚举。
// 本卡暂保持「只附属自己」的近似；已把复现与建议写入 primitive-requests/fix-player.json。

import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '05021',
  simplified: true,
  note: '未实现：卡面允许附属到同地点任意调查员（本实现只附属到自己；引擎 doPlay 虽放行 investigator 附属，但事务提交后 inv.attachments 读不到，无法被能力枚举）；神话阶段结束的「花 2 资源或弃掉」简化为直接弃掉。已实现快速打出、受伤害/恐惧时弃掉并取消该次全部伤害与恐惧。',
  forcedMythosEndDiscard: true,
  playCondition: [
    { when: ownTurn(), message: '只能在你回合期间打出' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      becomesAsset: true,
      label: '附属到场上：准备取消下一次伤害/恐惧',
      resolve: ({ inv, api }) => {
        api.putSelfIntoPlay(inv.seat, '05021')
        api.info(`🎭 ${inv.name} 打出「${api.cardName('05021')}」，将它放置入场。`)
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
        api.info(`🎭 「${api.cardName('05021')}」取消了 ${cancelled.damage} 点伤害与 ${cancelled.horror} 点恐惧。`)
      },
    },
  ],
  modifiers: [

  ],
}
