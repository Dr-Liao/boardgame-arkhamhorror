// 60302 你能做得更好
// 卡面：温妮弗雷德·哈巴默克牌库专用。
// 卡面：只能投入你进行的技能检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60302',
  abilities: [{
    kind: 'commit',
    label: '只能投入自己进行的检定',
    skill: { selfTestOnly: true },
  }],
}
