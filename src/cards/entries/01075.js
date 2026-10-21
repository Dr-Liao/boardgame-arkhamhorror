// 01075 幸运兔脚
// 卡面：[reaction]在你技能检定失败后，横置幸运兔脚：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01075 兔脚：检定失败后横置抽 1 张。

export default {
  code: '01075',
  abilities: [
    {
      kind: 'reaction', trigger: 'skillTestFail', id: 'rabbitsFoot', legacyReaction: true,
      label: '检定失败后抽 1 张', cost: { exhaust: true }, effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
