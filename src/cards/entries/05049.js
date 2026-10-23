// 05049 佩妮·怀特（序章故事调查员）
// 卡面：[reaction]你在显现效果期间的技能检定成功后：发现你所在地点的一个线索。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。如果本次技能检定在显现效果期间，则在你下个回合期间，你可以进行额外一次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「显现效果期间」由引擎的 state._treacheryResolving 标记（诡计结算期间为真）；
// 「下个回合额外一次行动」由 beginInvestigationPhase 读 inv.extraActionNextTurn 落实。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05049')

export default {
  code: '05049',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '05049-eldersign',
    label: '旧印：+1；若在显现效果期间，下个回合额外行动一次',
    resolve: ({ state, inv, api }) => {
      if (state._treacheryResolving) {
        inv.extraActionNextTurn = true
        api.info(`${inv.name} 下个回合期间可以额外行动一次。`)
      }
      return { delta: Number(sign.bonus ?? 1) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'skillTestSuccess',
      label: '显现效果期间检定成功：发现你所在地点的 1 个线索',
      limit: 'oncePerRound',
      criteria: [({ inv, state }) => Boolean(state._treacheryResolving) && state.skillTest?.seat === inv.seat],
      resolve: ({ inv, api }) => {
        api.discoverClue(inv.seat, 1)
        api.info(`${inv.name} 在显现效果期间检定成功，发现了 1 个线索。`)
      },
    },
  ],
  modifiers: [],
}
