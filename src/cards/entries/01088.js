// 01088 应急物品
// 卡面：获得3资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01088 应急物品：获得 3 资源。

export default {
  code: '01088',
  abilities: [
    { kind: 'played', label: '获得 3 资源', effect: { type: 'gainResource', amount: 3 } },
  ],
  modifiers: [

  ],
}
