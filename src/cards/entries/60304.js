// 60304 不顾后果
// 卡面：只能投入你进行的、未投入其它卡牌的任意类型技能检定。其它卡牌不能投入本次技能检定。
// 卡面：如果本次检定失败，将本技能返回手牌。
// 卡面：强制 - 你的回合结束时，如果不顾后果在你手牌中：展示它并失去2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60304',
  weaknessStaysInHand: true,
  weaknessHandNote: '「不顾后果」留在手中；回合结束时仍在手中则失去资源。',
  abilities: [{
    kind: 'commit',
    label: '只能单独投入自己的检定；失败则返回手牌',
    skill: {
      selfTestOnly: true,
      anySkill: true,
      canCommitWeakness: true,
      noOtherCommits: true,
      destination: ({ result }) => result?.success === false && !result.failureEffectsCancelled ? 'hand' : undefined,
    },
  }, {
    kind: 'forced',
    trigger: 'turnEnded',
    fromHand: true,
    noPlayCost: true,
    label: '揭示这张手牌并失去 2 资源',
    criteria: ({ inv, context }) => context.seat === inv.seat,
    resolve: ({ inv, api }) => api.loseResources(inv.seat, 2),
  }],
}
