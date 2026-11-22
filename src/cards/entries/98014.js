// 98014 航海技巧（Nautical Prowess）· 中立 · 技能 · 替换（西拉斯·马什）。
// 卡面（cards-data 98014）：
//   西拉斯·马什牌库专用。替换。
//   如果本次检定期间揭示了带有负修正的混乱标记，选择一项：抽 1 张牌；或航海技巧获得 [wild][wild]。
//
// 引擎读点：
//   · 投入技能检定时读「本次检定已揭示的标记」= state.chaos.revealed 从 frames.at(-1) 起的切片
//     （12082/10038 同一读点；带负修正 = 非符号标记且 token 形如 -1/-2 等）；
//   · 投入中的技能卡作为反应来源参与窗口枚举（descriptorSources 的 skillTest.committed 分支）；
//     触发时机 = negativeTokenRevealed 窗口（tests.js 在揭示负修正标记后派发）；
//   · 抽 1 张牌 = api.drawCards；[wild][wild] = api.addTestPendingBonus(2)
//     （把 +2 技能值并入本次检定，与「获得两个万能图标」在检定数值上等价）。
//   · 检查本卡是否已投入本次检定：state.skillTest.committed 中存在 seat === 本人 且 code === 98014。
const code = '98014'
const NEGATIVE = /^-\d+$/

const committedHere = (state, inv) => (state.skillTest?.committed || []).some(item =>
  item.seat === inv.seat && item.code === code)

export default {
  code,
  abilities: [{
    kind: 'reaction',
    trigger: 'negativeTokenRevealed',
    limit: 'oncePerTest',
    label: '本次检定揭示了负修正标记：抽 1 张牌，或本技能获得 [wild][wild]',
    criteria: [({ state, inv, context }) => {
      const token = context?.token
      if (!negativeToken(token) && !(state.chaos?.revealed || []).some(negativeToken)) return false
      return committedHere(state, inv)
    }],
    resolve: ({ inv, api }) => {
      const choice = api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '航海技巧：揭示负修正标记。选择一项。',
        options: [{ id: 'draw', label: '抽 1 张牌' }, { id: 'icons', label: '本技能获得 [wild][wild]' }],
      })
      if (choice === 'icons') api.addTestPendingBonus(2)
      else api.drawCards(inv.seat, 1)
      api.info(`🧭 航海技巧：${choice === 'icons' ? '本技能获得 [wild][wild]' : '抽 1 张牌'}。`)
    },
  }],
  modifiers: [],
}

function negativeToken(token) {
  return typeof token === 'string' && NEGATIVE.test(token)
}
