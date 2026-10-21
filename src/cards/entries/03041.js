// 03041 涂绘印记
// 卡面：显现 - 将涂绘印记放置入场，放到你的威胁区域。
// 卡面：你的手牌上限减少5张。(FAQ，v1.6)
// 卡面：[action][action]：弃掉涂绘印记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03041',
  abilities: [
    {
      kind: 'weakness',
      label: '涂绘印记',
      weakness: { type: 'threat', handSizeModifier: -5, discardCost: { action: 2 } },
    },
  ],
  modifiers: [

  ],
}
