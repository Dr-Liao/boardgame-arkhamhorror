// 01015 被抛弃的孤单
// 卡面：显现 - 受到2点直接恐惧并将你弃牌堆的所有卡牌从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01015',
  abilities: [
    {
      kind: 'weakness',
      label: '被抛弃的孤单',
      weakness: {
        effects: [{ type: 'takeHorror', amount: 2, direct: true }, { type: 'removeDiscard' }],
      },
    },
  ],
  modifiers: [

  ],
}
