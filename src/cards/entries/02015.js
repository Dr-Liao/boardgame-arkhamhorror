// 02015 噩梦来袭
// 卡面：显现 - 横置你控制的所有支援，并将噩梦来袭放置入场，放到你的威胁区域。
// 卡面：你控制的支援不能重整。
// 卡面：[action][action]：弃掉噩梦来袭。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02015',
  abilities: [
    {
      kind: 'weakness',
      label: '噩梦来袭',
      weakness: { type: 'threat', preventReady: true, discardCost: { action: 2 } },
    },
  ],
  weaknessExhaustsAssets: true,
  modifiers: [

  ],
}
