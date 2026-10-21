// 01057 百战百胜
// 卡面：获得10资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01057',
  abilities: [
    { kind: 'played', label: '百战百胜', effect: { type: 'gainResource', amount: 10 } },
  ],
  modifiers: [

  ],
}
