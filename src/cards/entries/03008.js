// 03008 炮弹休克
// 卡面：显现 - 你身上每有2点伤害，受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03008',
  abilities: [
    { kind: 'weakness', label: '炮弹休克', weakness: { type: 'shellShock' } },
  ],
  modifiers: [

  ],
}
