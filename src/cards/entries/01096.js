// 01096 失忆
// 卡面：显现 - 选择并弃掉你的手牌，只剩1张。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01096 失忆：显现 - 选择并弃掉你的手牌，只剩 1 张。

export default {
  code: '01096',
  abilities: [
    {
      kind: 'weakness', label: '弃掉手牌只剩 1 张',
      weakness: { type: 'discardHandTo', keep: 1 },
    },
  ],
  modifiers: [

  ],
}
