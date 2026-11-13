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
//   · 「+2 技能值」没有「事件结算期间」的读点，用本阶段的 skill:* +2 持续效果近似（见 note）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '09072'

const isTacticOrTrickEvent = code => {
  if (!code) return false
  const def = ALL_CARDS[code]
  if (!def || def.type !== 'event') return false
  return (def.traits || []).some(trait => ['Tactic', 'Trick'].includes(String(trait)))
}

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 第三项「事件结算期间 +2 技能值」用本阶段 skill:* +2 持续效果近似（引擎没有事件结算窗口的加值读点）。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      cost: { exhaust: true },
      label: '打出一张[[策略]]/[[技巧]]事件时：横置，选择使其获得快速 / -2 费用 / 结算期间 +2 技能值',
      criteria: [({ inv, source, context }) => Boolean(source)
        && !source.exhausted
        && context?.seat === inv.seat
        && isTacticOrTrickEvent(context?.cardCode)],
      resolve: ({ inv, api, context }) => {
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「查克·费格斯」：为「${api.cardName(context.cardCode)}」选择一项。`,
          options: [
            { id: 'fast', label: '该事件获得快速' },
            { id: 'cheap', label: '该事件的费用减少 2 点' },
            { id: 'skill', label: '该事件结算期间技能检定 +2 技能值' },
          ],
        })
        if (answer === 'cheap') {
          api.playerTools.modifyPlay(context, { discount: 2 })
          api.info(`🕶️ 「查克·费格斯」：「${api.cardName(context.cardCode)}」的费用减少 2 点。`)
          return
        }
        if (answer === 'skill') {
          api.addEffect({
            duration: 'endOfPhase', sourceCode: CODE, controllerSeat: inv.seat,
            label: '「查克·费格斯」：本阶段技能值 +2（近似：事件结算期间）',
            modifiers: [{ target: 'skill:*', amount: 2 }],
          })
          api.info('🕶️ 「查克·费格斯」：本阶段技能检定 +2 技能值（近似事件结算期间）。')
          return
        }
        api.playerTools.modifyPlay(context, { fast: true })
        api.info(`🕶️ 「查克·费格斯」：「${api.cardName(context.cardCode)}」获得快速。`)
      },
    },
  ],
  modifiers: [],
}
