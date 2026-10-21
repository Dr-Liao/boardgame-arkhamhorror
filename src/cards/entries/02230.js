// 02230 幸运骰子
// 卡面：卓越。
// 卡面：[reaction]在你揭示一个非[auto_fail]混乱标记时，花费2资源：忽略该混乱标记，并揭示另一个混乱标记以结算。如果新揭示的标记有[auto_fail]符号，将幸运骰子从游戏中移除(不能忽略/取消)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02230 幸运骰子：揭示混乱标记后花 2 资源重抽。

export default {
  code: '02230',
  abilities: [
    {
      kind: 'reaction', trigger: 'chaosTokenRevealed', id: 'luckyDice', legacyReaction: true,
      label: '花 2 资源重抽混乱标记', cost: { resources: 2 },
      effect: { type: 'redrawChaos' },
    },
  ],
  rerollTokenCost: 2,
  modifiers: [

  ],
}
