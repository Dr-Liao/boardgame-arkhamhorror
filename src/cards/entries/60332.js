// 60332 查克·费格斯
// 卡面：[reaction]你打出一张[[策略]]或[[技巧]]事件时，横置查克·费格斯：选择以下两项：
// 卡面：- 该事件获得快速。
// 卡面：- 该事件的打出费用减少2资源。
// 卡面：- 你在结算该事件期间进行技能检定时，技能值+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { hasTrait } from '../../engine/matcher.js'
import { assetTextBlanked, assetTextBlankedExceptForced } from '../../engine/card-text.js'
import { ALL_CARDS } from '../cards-data.js'

function isTacticOrTrick(card) {
  return card?.type === 'event' && (hasTrait(card, 'tactic') || hasTrait(card, 'trick'))
}

export default {
  code: '60332',
  playCostReductionProvider: (_state, inv, card, source) =>
    source && !source.exhausted && !assetTextBlanked(source, inv) && !assetTextBlankedExceptForced(source)
      && isTacticOrTrick(card) ? 2 : 0,
  playTimingProvider: ({ inv, card, source }) => isTacticOrTrick(card) && !assetTextBlanked(source, inv)
    ? { fast: true, discount: 0, cost: { exhaust: true } } : null,
  abilities: [{
    kind: 'reaction',
    trigger: 'beforePlayCost',
    label: '横置：在快速、费用 -2 和检定技能值 +2 中选两项',
    cost: { exhaust: true },
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ inv, context }) => context.seat === inv.seat
      && isTacticOrTrick(ALL_CARDS[context.playedCardCode || context.cardCode]),
    resolve: ({ inv, source, context, api }) => {
      if (context.fastSourceId !== source.id) {
        api.playerTools.modifyPlay(context, { discount: 2, skillBonus: 2 })
        return
      }
      const cost = Math.max(0, context.cost - context.costReduction + context.costIncrease)
      const selection = context.availableResources < cost ? 'discount' : api.choice({
        kind: 'effect', source: '60332', seat: inv.seat,
        prompt: '该事件已获得快速。再选择一项。',
        options: [
          { id: 'discount', label: '打出费用减少 2 资源' },
          { id: 'skill', label: '结算期间，你的检定技能值 +2' },
        ],
      })
      api.playerTools.modifyPlay(context, selection === 'discount'
        ? { fast: true, discount: 2 } : { fast: true, skillBonus: 2 })
    },
  }],
}
