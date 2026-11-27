// 09126 该付账了（Pay Your Due）· 基础弱点 · 事件
// 卡面：[rogue] 调查员专用。
//       作为打出该付账了的额外费用，你可以花费任意数量的额外行动。每花费一个额外行动，降低其费用 5 点。
//       强制 - 如果当你的回合结束时，该付账了在你手中：将其揭示并受到 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 抽到后留在手中：条目级 weaknessStaysInHand（deck-ops.js 弱点结算分支的唯一读点）；
//   · 回合结束时若仍在手牌：条目级 endTurnInHandDamage（turn-flow.js#advanceInvestigator 扫描手牌的读点，
//     与 09125 的 endTurnInHandHorror 同族）；
//   · 额外行动费用和每点行动的资源折扣在同一支付窗口结算。
const code = '09126'

export default {
  code,
  playableWeakness: true,
  weaknessStaysInHand: true,
  endTurnInHandDamage: 1,
  weaknessHandNote: '留在手中；可在回合结束前打出，否则回合结束时揭示并受到 1 点伤害。',
  optionalPlayActionDiscount: 5,
  abilities: [
    {
      kind: 'played',
      label: '花费额外行动降低费用后打出，弃掉该付账了',
      resolve: ({ inv, api }) => api.info(`💸 「该付账了」：${inv.name} 付清欠款。`),
    },
  ],
  modifiers: [],
}
