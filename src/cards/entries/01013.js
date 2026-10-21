// 01013 黑暗回忆
// 卡面：在当前密谋上放置1个毁灭标记。本效果能导致当前密谋推进。
// 卡面：强制 - 如果当你回合结束时，黑暗回忆在你手中：将其揭示并受到2点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01013 黑暗回忆：抽到后留在手里（可支付费用打出），而不是立刻结算。

export default {
  code: '01013',
  weaknessStaysInHand: true,
  playableWeakness: true,
  endTurnInHandHorror: 2,
  abilities: [
    { kind: 'played', label: '黑暗回忆', effect: { type: 'addDoom', amount: 1 } },
  ],
  modifiers: [

  ],
}
