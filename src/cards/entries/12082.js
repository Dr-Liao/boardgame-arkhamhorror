// 12082 苦苦支撑（Scrape By）
// 卡面：快速。在你的技能检定期间揭示了非[auto_fail]标记，且本次技能检定将要失败时打出。
//       改为你本次技能检定成功。如果本次技能检定期间揭示了带有符号的标记，受到 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 快速事件 = reaction 描述子的 fromHand:true + quickEvent:true + trigger（P2-4 统一通道；
//     候选出口 encounter.js#reactionWindow、执行器 assets.js#playReactionCard，与 played+fast 同源）；
//   · 「你的技能检定、将要失败」= trigger testWouldFail + criteria 限定本座位；「揭示了非 auto_fail
//     标记 / 符号标记」读当前检定帧已揭示的混乱标记（state.chaos.revealed 从 frames.at(-1) 起，
//     与 07110/07190 同一读点；tests.js 的窗口 result.drawn 在揭示阶段为空，不能用于此处）；
//   · 「改为成功（勘误：以 0 点成功）」= api.setReactionFlag('testBonus', ...)，tests.js 在窗口后
//     读取 context.testBonus 并入本次检定值（60527/60528 同一读点）；
//   · 「揭示符号 → 1 点恐惧」= api.horror（applyHorror 统一入口）。

const CODE = '12082'
const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

import { ownSeat } from '../../engine/matcher.js'

const revealedTokens = state => {
  const start = state?.chaos?.frames?.at(-1) ?? 0
  return (state?.chaos?.revealed || []).slice(start)
}

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      fromHand: true,
      quickEvent: true,
      trigger: 'testWouldFail',
      label: '你将要失败的检定：改为成功；若有符号标记则受 1 点恐惧',
      criteria: [
        ownSeat(),
        ({ state }) => revealedTokens(state).some(token => token !== 'autofail'),
      ],
      resolve: ({ state, inv, api, context }) => {
        const tokens = revealedTokens(state)
        const current = Number(context?.testValue) || 0
        const difficulty = Number(context?.difficulty) || 0
        const delta = Math.max(0, difficulty - current)
        api.setReactionFlag('testBonus', (context?.testBonus || 0) + delta, context)
        const symbol = tokens.some(token => SYMBOLS.includes(token))
        if (symbol) api.horror(inv.seat, 1)
        api.info(`💪 「苦苦支撑」：本次检定改为成功${symbol ? '，并受到 1 点恐惧' : ''}。`)
      },
    },
  ],
  modifiers: [],
}
