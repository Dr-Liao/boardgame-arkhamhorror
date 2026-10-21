// 02266 杀手锏
// 卡面：卓越。快速。只能在你回合期间打出。
// 卡面：你本回合可以进行额外3次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02266',
  abilities: [
    {
      kind: 'played',
      label: '杀手锏',
      fast: true,
      effect: { type: 'gainAction', amount: 3 },
    },
  ],
  modifiers: [

  ],
}
