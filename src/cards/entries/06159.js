// 06159 强梦血清
// 卡面：如果你手中有多张同名手牌，检查手牌上限时其只计作一张。
// 卡面：[reaction]你抽取与你手牌同名的卡牌后，揭示这两张卡牌并横置强梦血清：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [reaction] 挂 cardDrawn 窗口（drawCards 每次抽牌后开窗，context.cardCode 是刚抽到的牌）；
//     条件 = 手牌里同名牌出现 ≥2 次；费用 = 横置血清；效果 = 抽 1 张（api.drawCards）。
// 手牌上限按卡名去重由 passive.sameNameHandLimit 统一结算。

import { ALL_CARDS } from '../../cards/cards-data.js'

const printedName = code => ALL_CARDS[code]?.name || code

export default {
  code: '06159',
  passive: { sameNameHandLimit: true },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'cardDrawn',
      id: 'dreamEnhancingSerumDraw',
      label: '抽到与手牌同名的牌后：横置强梦血清，抽 1 张',
      criteria: [({ inv, context }) => {
        const code = context?.cardCode
        if (!code) return false
        return (inv.hand || []).filter(item => printedName(item) === printedName(code)).length >= 2
      }],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        api.info(`🧪 ${inv.name} 揭示两张同名手牌并横置「强梦血清」，抽取 1 张卡牌。`)
        api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [],
}
