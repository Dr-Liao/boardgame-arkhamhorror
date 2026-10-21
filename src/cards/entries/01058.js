// 01058 禁忌知识
// 卡面：使用(4秘密)。如果禁忌知识没有秘密，将其弃掉。
// 卡面：[free]横置禁忌知识并受到1点恐惧：将禁忌知识上的1秘密移动到你的资源池，作为资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01058',
  uses: 4,
  usesType: 'secret',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '禁忌知识（横置、受 1 恐惧、花 1 秘密：获得 1 资源）',
      cost: { action: false, exhaust: true, uses: 1, horror: 1 },
      effect: { type: 'gainResource', amount: 1 },
    },
  ],
  modifiers: [

  ],
}
