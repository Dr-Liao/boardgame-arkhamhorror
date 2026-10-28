// 05021 劫数延后
// 卡面：快速。只能在你回合期间打出。附属到你所在地点的一位调查员，置于该调查员控制之下。
// 卡面：[reaction]在你受到伤害和/或恐惧时：弃掉劫数延后并取消你刚受到的全部伤害和/或恐惧。
// 卡面：强制 - 在神话阶段结束时：你必须花费2资源或弃掉劫数延后。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：附属对象走条目字段 attachTo.kind='investigator'（controllerScope='location'：同地点任意调查员，
// 含自己）；引擎在 doPlay 里完成目标选择与附属写入，能力从宿主的 inv.attachments 枚举。
// reaction 的「弃掉劫数延后」在 resolve 里调 api.discardSelf（真实从 inv.attachments 移除并进所有者弃牌堆）；
// 神话阶段结束的 forced mythosEnd 由 turn.js 开窗（门控已含 inv.attachments），资源≥2 询问 pay/discard，否则强弃。

import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '05021',
  fast: true,
  attachTo: { kind: 'investigator', controllerScope: 'location' },
  playCondition: [
    { when: ownTurn(), message: '只能在你回合期间打出' },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      label: '弃掉劫数延后：取消刚受到的全部伤害和/或恐惧',
      criteria: [ownSeat()],
      resolve: ({ context, api }) => {
        // 弃掉自身（附属来源真实离场）。
        api.discardSelf('05021')
        const cancelled = { damage: context.damage || 0, horror: context.horror || 0 }
        context.damage = 0
        context.horror = 0
        api.info(`🎭 「${api.cardName('05021')}」取消了 ${cancelled.damage} 点伤害与 ${cancelled.horror} 点恐惧。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'mythosEnd',
      label: '神话阶段结束：花费 2 资源，或弃掉劫数延后',
      // 非持有者跳过（窗口按调查员逐个打开）。
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => {
        if ((inv.resources || 0) >= 2) {
          const answer = api.choice({
            kind: 'effect', source: '05021', seat: inv.seat,
            prompt: '神话阶段结束：「劫数延后」要花费 2 资源保留，还是弃掉？',
            options: [{ id: 'pay', label: '花费 2 资源' }, { id: 'discard', label: '弃掉「劫数延后」' }],
          })
          if (answer === 'pay') {
            // 卡面「花费 2 资源」= 支付费用：走统一的支付入口（合并池先扣寄存量）。
            api.spendResources(inv.seat, 2)
            api.info(`🌑 ${inv.name} 花费 2 资源保留「劫数延后」。`)
            return
          }
        }
        api.discardSelf('05021')
        api.info(`🌑 「劫数延后」在神话阶段结束时被弃掉。`)
      },
    },
  ],
  modifiers: [],
}
