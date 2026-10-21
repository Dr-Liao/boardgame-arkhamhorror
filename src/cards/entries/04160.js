// 04160 围困
// 卡面：[free]弃掉你1张手牌：你本次技能检定得到+2技能值。(每次检定仅限一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04160 围困：弃 1 张手牌，本次检定 +2（每次检定一次）。

export default {
  code: '04160',
  abilities: [
    {
      kind: 'free', label: '弃 1 张手牌：本次检定 +2',
      cost: { action: false, exhaust: true, discardHand: 1 },
      duringOwnSkillTest: true, limit: { scope: 'perTest', owner: 'instance' },
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [

  ],
}
