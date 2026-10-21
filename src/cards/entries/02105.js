// 02105 紧急救援
// 卡面：选择你所在地点的1位调查员。治愈该调查员或其控制的一个[[盟友]]支援的2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02105 紧急救援：选择同地点 1 位调查员，治愈其或其盟友的 2 点伤害。

export default {
  code: '02105',
  abilities: [
    {
      kind: 'played', label: '治愈同地点调查员或其盟友 2 点伤害',
      effect: { type: 'healDamageAtLocation', amount: 2 },
    },
  ],
  modifiers: [

  ],
}
