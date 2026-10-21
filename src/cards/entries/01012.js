// 01012 希波利尔传家宝
// 卡面：艾格尼丝·贝克牌库专用。
// 卡面：[reaction]你打出一张[[法术]]卡后：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01012 传家宝：打出法术卡后抽 1 张。

export default {
  code: '01012',
  abilities: [
    {
      kind: 'reaction', trigger: 'spellPlayed', id: 'heirloom', legacyReaction: true,
      label: '打出法术卡后抽 1 张', effect: { type: 'draw', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
