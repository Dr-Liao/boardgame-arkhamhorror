// 02184 最坏的打算
// 卡面：查找你牌库顶的9张卡牌，找出1个[[武器]]支援，将其加入你的手牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02184',
  abilities: [
    {
      kind: 'played',
      label: '最坏的打算',
      effect: { type: 'searchTop', amount: 9, trait: 'Weapon', choose: 1 },
    },
  ],
  modifiers: [

  ],
}
