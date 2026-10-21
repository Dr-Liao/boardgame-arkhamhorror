// 01032 研究馆员
// 卡面：[reaction]研究馆员入场后：查找你的牌库，找出一张[[书籍]]支援，并将其加入你的手牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01032 研究馆员：入场后从牌库顶找 1 张书籍支援。

export default {
  code: '01032',
  abilities: [
    {
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'researchLibrarian', legacyReaction: true,
      criteria: { assetCode: '01032' }, label: '入场后检索 1 张书籍',
      effect: { type: 'searchTop', amount: 999, trait: 'Tome', choose: 1 },
    },
  ],
  modifiers: [

  ],
}
