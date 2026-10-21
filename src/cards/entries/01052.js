// 01052 偷袭
// 卡面：对你所在地点的一名横置敌人造成2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01052',
  abilities: [
    {
      kind: 'played',
      label: '偷袭',
      effect: { type: 'dealDamageExhausted', amount: 2 },
    },
  ],
  modifiers: [

  ],
}
