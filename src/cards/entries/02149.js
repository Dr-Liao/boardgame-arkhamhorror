// 02149 艺术生
// 卡面：[reaction]在艺术生入场后：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02149 艺术生：入场后（自身入场触发）发现 1 个线索。

export default {
  code: '02149',
  abilities: [
    {
      kind: 'reaction', trigger: 'assetEnteredPlay', id: 'artStudent', legacyReaction: true,
      criteria: { assetCode: '02149' }, label: '入场后发现 1 个线索',
      effect: { type: 'discoverClue', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
