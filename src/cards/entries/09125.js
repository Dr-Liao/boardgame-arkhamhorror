// 09125 量子悖论（Quantum Paradox）· 基础弱点 · 事件
// 卡面：[seeker] 调查员专用。
//       作为打出量子悖论的额外费用，你必须选择并弃掉 4 张其他卡牌。
//       强制 - 如果当你的回合结束时，量子悖论在你手中：将其揭示并受到 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 抽到后留在手中：条目级 weaknessStaysInHand（deck-ops.js 弱点结算分支的唯一读点）；
//   · 回合结束时揭示并受 1 恐惧：条目级 endTurnInHandHorror（turn-flow.js#advanceInvestigator
//     扫描手牌的读点，日志与伤害都由引擎写）；
//   · 打出以弃掉：playableWeakness（弱点可打出的唯一许可）+ played 描述子；
//   · 额外弃 4 张：引擎不为 played 描述子的 cost 预付，打出条件要求手牌 ≥5（自身+4），
//     结算时用 api.discardChosen 逐张弃掉。
// approximation: 额外费用在结算时支付（而非支付前预检），条件已按「手牌 ≥5」预检。
const code = '09125'

export default {
  code,
  playableWeakness: true,
  weaknessStaysInHand: true,
  endTurnInHandHorror: 1,
  note: 'approximation: 「弃掉 4 张其它手牌」在结算时支付（playCondition 已按手牌 ≥5 预检）。',
  playCondition: [
    { when: ({ inv }) => (inv.hand || []).length >= 5,
      message: '打出量子悖论需要额外弃掉 4 张其它手牌（手牌至少 5 张）' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '额外选择并弃掉 4 张其它手牌，然后弃掉量子悖论',
      resolve: ({ inv, api }) => {
        api.discardChosen(inv.seat, 4, code)
        api.info(`🌀 「量子悖论」：${inv.name} 弃掉 4 张手牌，量子悖论被弃掉。`)
      },
    },
  ],
  modifiers: [],
}
