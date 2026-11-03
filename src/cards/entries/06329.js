// 06329 闪耀的偏方三八面体
// 卡面：[reaction]在你将要支付一张[[法术]]卡牌的费用时，横置闪耀的偏方三八面体：改为检定[willpower](X)，
//       其中X等于该卡牌的资源费用。如果你检定成功，视作你已支付其资源费用。
//       如果你检定失败，取消打出该卡牌，并且不支付其任何费用(包括其行动费用)。
//       直到本轮结束，你不能打出该卡牌及其同名卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 在 beforePlayAttempt 窗口先检定再扣任何费用；失败取消整次打出并禁打同名卡至本轮结束。
// playCostReductionProvider 允许资源不足时仍尝试打出法术，成功后由窗口减免真实费用。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isSpell(code) {
  const def = code ? ALL_CARDS[code] : null
  return Boolean(def) && (def.traits || []).some(trait => String(trait).toLowerCase() === 'spell')
}

export default {
  code: '06329',
  playCostReductionProvider: (_state, _inv, def, asset) =>
    isSpell(def?.code) && !asset?.exhausted ? Math.max(0, Number(def?.cost) || 0) : 0,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayAttempt',
      label: '横置：支付法术费用时改为意志(X)检定，成功则费用视为已支付',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => Boolean(context?.cardCode)
        && context.seat === inv.seat
        && isSpell(context.cardCode)],
      resolve: ({ inv, api, context }) => {
        const x = Math.max(0, Number(context?.cost) || 0)
        api.test(inv.seat, 'willpower', x, {
          source: { label: '闪耀的偏方三八面体', code: '06329' },
          resolve: result => {
            if (result.success) {
              context.costReduction = (context.costReduction || 0) + Number(context.cost || 0)
              api.info(`🔮 「闪耀的偏方三八面体」检定成功：打出「${api.cardName(context.cardCode)}」的资源费用视为已支付。`)
            } else {
              api.cancelCardPlay(context, { forbidSameNameUntilRoundEnd: true })
              api.info('🔮 「闪耀的偏方三八面体」检定失败：取消打出该卡牌，不支付行动或资源费用；本轮不能再打出同名卡。')
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
