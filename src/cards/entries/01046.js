// 01046 扒窃
// 卡面：[reaction]在你躲避1个敌人后，横置扒窃：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01046 扒手：躲避成功后横置抽 1 张。

export default {
  code: '01046',
  abilities: [
    {
      kind: 'reaction', trigger: 'evadeSuccess', id: 'pickpocketing', legacyReaction: true,
      label: '躲避成功后抽 1 张', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
