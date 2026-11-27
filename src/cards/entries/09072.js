// 09072 查克·费格斯（Chuck Fergus）· 游荡者（Rogue）资产 · 2 经验 · 盟友 · 罪犯 · 盟友槽。
//
// 卡面：[reaction] 在你打出一张[[策略]]或[[技巧]]事件时，横置查克·费格斯：选择一项——
//       - 该事件获得快速。
//       - 该事件打出的资源费用减少 2 点。
//       - 你在该事件的结算期间执行技能检定时，得到技能值 +2。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：beforePlayCost 窗口（actions.js 支付费用前开窗）——
//   · 「快速 / -2 费用」→ api.playerTools.modifyPlay(context, { fast, discount })
//     （context.costReduction / context.noAction 是打出管线既有读点，与 05111/05234 同源）。
//   · 「+2 技能值」→ api.playerTools.modifyPlay，事件结算时由引擎限定加值范围。
import { ALL_CARDS } from '../cards-data.js'
import { assetTextBlanked, assetTextBlankedExceptForced } from '../../engine/card-text.js'

const CODE = '09072'

const isTacticOrTrickEvent = def => def?.type === 'event'
  && (def.traits || []).some(trait => ['tactic', 'trick'].includes(trait.toLowerCase()))

export default {
  code: CODE,
  playCostReductionProvider: (_state, inv, card, source) =>
    source && !source.exhausted && !assetTextBlanked(source, inv) && !assetTextBlankedExceptForced(source)
      && isTacticOrTrickEvent(card) ? 2 : 0,
  playTimingProvider: ({ inv, card, source }) =>
    isTacticOrTrickEvent(card) && !assetTextBlanked(source, inv)
      && (inv.resources || 0) >= Math.max(0, card.cost || 0)
      ? { fast: true, cost: { exhaust: true } }
      : null,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      cost: { exhaust: true },
      label: '打出一张[[策略]]/[[技巧]]事件时：横置，选择使其获得快速 / -2 费用 / 结算期间 +2 技能值',
      criteria: [({ inv, source, context }) => Boolean(source)
        && !source.exhausted
        && context?.seat === inv.seat
        && isTacticOrTrickEvent(ALL_CARDS[context?.playedCardCode || context?.cardCode])],
      resolve: ({ inv, api, context, source }) => {
        const options = [
          { id: 'cheap', label: '该事件的费用减少 2 点' },
          { id: 'skill', label: '该事件结算期间技能检定 +2 技能值' },
        ]
        const resources = context.availableResources ?? api.availableResources(inv.seat)
        const cost = Math.max(0, (context.cost || 0) - (context.costReduction || 0) + (context.costIncrease || 0))
        const answer = context.fastSourceId === source.id ? 'fast'
          : cost > resources ? 'cheap' : api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: `「查克·费格斯」：为「${api.cardName(context.cardCode)}」选择一项。`,
            options,
          })
        if (answer === 'cheap') {
          api.playerTools.modifyPlay(context, { discount: 2 })
          api.info(`🕶️ 「查克·费格斯」：「${api.cardName(context.cardCode)}」的费用减少 2 点。`)
          return
        }
        if (answer === 'skill') {
          api.playerTools.modifyPlay(context, { skillBonus: 2 })
          api.info('🕶️ 「查克·费格斯」：该事件结算期间技能检定 +2 技能值。')
          return
        }
        api.playerTools.modifyPlay(context, { fast: true })
        api.info(`🕶️ 「查克·费格斯」：「${api.cardName(context.cardCode)}」获得快速。`)
      },
    },
  ],
  modifiers: [],
}
