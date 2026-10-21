// 04154 一目十行
// 卡面：[free]将你的1个线索放到你所在地点并横置一目十行：你本次技能检定得到+3技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04154 一目十行：放回 1 个线索，本次检定 +3。

export default {
  code: '04154',
  abilities: [
    {
      kind: 'free', label: '横置并放回 1 个线索：本次检定 +3',
      cost: { action: false, exhaust: true, clues: 1 }, duringOwnSkillTest: true,
      resolve: ({ inv, api }) => {
        api.returnClueToLocation(inv.seat, 1)
        api.addPendingTestBonus(3)
      },
    },
  ],
  modifiers: [

  ],
}
