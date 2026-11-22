// 60412 永夜长袍
// 卡面：[reaction]你打出一张[[法术]]卡牌时，横置永夜长袍：该卡牌的费用减少1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { hasTrait } from '../../engine/matcher.js'
import { assetTextBlanked, assetTextBlankedExceptForced } from '../../engine/card-text.js'

export default {
  code: '60412',
  playCostReductionProvider: (_state, inv, card, source) =>
    source && !source.exhausted && !assetTextBlanked(source, inv) && !assetTextBlankedExceptForced(source)
      && hasTrait(card, 'spell') ? 1 : 0,
  abilities: [{
    kind: 'reaction',
    trigger: 'beforePlayAttempt',
    label: '横置：本次打出的法术费用 -1',
    cost: { exhaust: true },
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, context, helpers }) => context.seat === inv.seat
      && helpers.cardTraits(context.cardCode).some(trait => trait.toLowerCase() === 'spell'),
    resolve: ({ context, api }) => api.playerTools.modifyPlay(context, { discount: 1 }),
  }],
}
