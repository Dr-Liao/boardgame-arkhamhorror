// 05280 否决存在（5）
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。
// 卡面：你忽略该效果的影响。然后，对应地执行与之相反的效果(抽取卡牌、获得资源、获得额外行动、治愈伤害、治愈恐惧)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现口径（2026-11-11 修正，与 05032 共用 _shared.js 的窗口口径）：
//   · 单一「快速事件统一通道」描述子（reaction + fromHand + quickEvent）覆盖四个窗口；
//     旧实现两个 reaction+fromHand 描述子没有 quickEvent，quickEventView 只能看到第一个，
//     而且伤害/恐惧与三个非伤害窗口的候选来源不一致。
//   · 伤害/恐惧整体二选一（同 05032），并由 cancelHarm 的 heal 模式执行反向治疗。
//   · 弃手牌/失资源/失行动由 ignoreWouldEffect(reverse) 反向：抽牌/获得资源/获得额外行动。
import { denyExistenceCandidate, ignoreWouldEffect } from './_shared.js'

export default {
  code: '05280',
  abilities: [
    {
      kind: 'reaction',
      fromHand: true,
      quickEvent: true,
      trigger: ['harmDealt', 'wouldDiscardFromHand', 'wouldLoseResources', 'wouldLoseActions'],
      label: '否决存在：忽略这次遭遇/攻击造成的伤害、恐惧、弃手牌、失资源或失行动',
      criteria: [denyExistenceCandidate],
      resolve: ({ inv, api, context }) => {
        if (context?.when === 'harmDealt') {
          // 整体忽略伤害或恐惧中的一项，并治愈等量同类伤害/恐惧。
          api.cancelHarm(inv.seat, {
            whole: true,
            heal: true,
            source: '05280',
            prompt: '「否决存在」：选择要忽略的那一项效果。',
          })
          return
        }
        ignoreWouldEffect({ inv, api, context, reverse: true })
      },
    },
  ],
  modifiers: [

  ],
}
