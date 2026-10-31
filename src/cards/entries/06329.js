// 06329 闪耀的偏方三八面体
// 卡面：[reaction]在你将要支付一张[[法术]]卡牌的费用时，横置闪耀的偏方三八面体：改为检定[willpower](X)，
//       其中X等于该卡牌的资源费用。如果你检定成功，视作你已支付其资源费用。
//       如果你检定失败，取消打出该卡牌，并且不支付其任何费用(包括其行动费用)。
//       直到本轮结束，你不能打出该卡牌及其同名卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06329 闪耀的偏方三八面体（[[遗物]]配件，P3 escape 登记的单卡逻辑）：
//   · 「支付法术费用前」= beforePlayCost 窗口（actions.js 在扣费前开窗，context 带 cardCode/cost）；
//   · 横置自身作费用（cost.exhaust）；意志(X) 检定用 api.test，成功后把 context.costReduction 设为
//     本次资源费用 → 引擎把费用减到 0（「视作已支付其资源费用」）；
//   · 显式简化：失败分支「取消打出该卡牌（不支付任何费用、包括行动费用）」与「本轮不能再打出同名卡」
//     没有引擎读点（beforePlayCost 窗口没有取消整次打出的字段），未实现——失败时按正常费用结算。
//     这是 escape 的单卡一次性逻辑，登记理由见 docs/tde-player-cards.md §2.1。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isSpell(code) {
  const def = code ? ALL_CARDS[code] : null
  return Boolean(def) && (def.traits || []).some(trait => String(trait).toLowerCase() === 'spell')
}

export default {
  code: '06329',
  simplified: true,
  note: '未实现失败分支：①「检定失败则取消打出该卡牌，不支付任何费用（包括行动费用）」——'
    + 'beforePlayCost 窗口没有取消整次打出的引擎字段；②「直到本轮结束不能打出该卡牌及其同名卡」。'
    + '成功分支已实现：横置自身 + 意志(X) 检定，成功则本次资源费用视为已支付（costReduction = cost）。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      label: '横置：支付法术费用时改为意志(X)检定，成功则费用视为已支付',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => Boolean(context?.cardCode)
        && context.seat === inv.seat
        && isSpell(context.cardCode)
        && Number(context.cost) > 0],
      resolve: ({ inv, api, context }) => {
        const x = Math.max(0, Number(context?.cost) || 0)
        if (!(x > 0)) return
        api.test(inv.seat, 'willpower', x, {
          source: { label: '闪耀的偏方三八面体', code: '06329' },
          resolve: result => {
            if (result.success) {
              context.costReduction = (context.costReduction || 0) + Number(context.cost || 0)
              api.info(`🔮 「闪耀的偏方三八面体」检定成功：打出「${api.cardName(context.cardCode)}」的资源费用视为已支付。`)
            } else {
              api.info('🔮 「闪耀的偏方三八面体」检定失败：本次仍按正常费用结算（简化的失败分支）。')
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
