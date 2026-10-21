// 01097 妄想症
// 卡面：显现 - 弃掉你全部资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01097 妄想症：显现 - 弃掉你全部资源。

export default {
  code: '01097',
  abilities: [
    {
      kind: 'weakness', label: '弃掉全部资源',
      weakness: { type: 'loseResource', all: true },
    },
  ],
  modifiers: [

  ],
}
