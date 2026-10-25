// 05012 秘社“债务”
// 卡面：将秘社“债务”从游戏中移除。
// 卡面：强制 - 在游戏结束或你退场时，如果秘社“债务”仍在你手牌中：你承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 第四轮修复（2026-10-25）：
//   · 事件弱点、无 Revelation → 抽到后留在手牌（条目级 weaknessStaysInHand，读点 src/engine/deck-ops.js:369-373）；
//   · 可支付 10 资源打出（playableWeakness + 印刷费用；读点 src/engine/moves.js 的 weakness 打出通道），
//     打出后从游戏中移除（条目级 removeAfterPlay，读点 src/engine/actions.js:313）；
//   · 「游戏结束或你退场时仍在你手牌中 → 1 精神创伤」两分支均已实现：
//     游戏结束走 finishScenario 的手牌扫描（src/engine/campaign-flow.js:160-167；已退场/撤退者被跳过，
//     不会与退场分支重复结算）；退场走 eliminateInvestigator 的手牌扫描（src/engine/harm-threat.js:222-229）。

export default {
  code: '05012',
  // 事件弱点：抽到后进手牌，而不是按「显现」结算后弃置。
  weaknessStaysInHand: true,
  weaknessHandNote: '秘社“债务”留在手中：可支付 10 资源打出，将其从游戏中移除；游戏结束或你退场时仍在手牌则承受 1 点精神创伤。',
  playableWeakness: true,
  // 打出的收尾：从游戏中移除（不进弃牌堆）。
  removeAfterPlay: true,
  // 游戏结束时仍在手牌 → 1 点精神创伤（finishScenario 手牌扫描）。
  traumaAtGameEndWhenInHand: true,
  note: '「游戏结束或你退场时仍在你手牌中 → 1 精神创伤」两分支均已实现：游戏结束由条目级 traumaAtGameEndWhenInHand 在 finishScenario 结算（campaign-flow.js:160-167，已退场/撤退者被跳过），退场由 eliminateInvestigator 结算（harm-threat.js:222-229）；两分支不会重复触发（回归测试见 tests/tcu-investigators.test.mjs 的「退场后再结算游戏结束不重复」用例）。',
  abilities: [
    {
      kind: 'played',
      label: '支付 10 资源打出：将秘社“债务”从游戏中移除',
      resolve: ({ inv, api }) => {
        api.info(`${inv.name} 把「秘社“债务”」移出游戏。`)
      },
    },
    // 兜底：若通过非抽牌通道直接结算该弱点（如剧本效果强制揭示），仍按卡面移出游戏。
    {
      kind: 'weakness',
      label: '秘社“债务”：移出游戏',
      weakness: { type: 'lodgeDebts' },
      resolve: ({ inv, state, api }) => {
        state.removedFromGame ||= []
        state.removedFromGame.push('05012')
        api.info(`${inv.name} 把「秘社“债务”」移出游戏。`)
      },
    },
  ],
  modifiers: [],
}
