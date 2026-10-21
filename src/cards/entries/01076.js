// 01076 野猫
// 卡面：[free]弃掉野猫：自动躲避你所在地点的一个非[[精英]]敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01076 野猫：引开（弃掉野猫，自动躲避同地点非精英敌人）。

export default {
  code: '01076',
  abilities: [
    {
      kind: 'action', label: '引开（弃掉野猫，自动躲避同地点非精英敌人）',
      cost: { action: false, discardSelf: true }, effect: { type: 'autoEvadeNonElite' },
    },
  ],
  modifiers: [

  ],
}
