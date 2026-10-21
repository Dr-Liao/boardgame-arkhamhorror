// 01078 调虎离山
// 卡面：躲避。自动躲避你所在地点的所有敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01078',
  abilities: [
    {
      kind: 'played',
      label: '调虎离山',
      effect: { type: 'evade', auto: true, allAtLocation: true },
    },
  ],
  modifiers: [

  ],
}
