// 03021 勇气过人
// 卡面：你所在地点的其他调查员受到的伤害可以分配给勇气过人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03021',
  passive: {"assignHarmAtLocation":true},
  abilities: [

  ],
  modifiers: [

  ],
}
