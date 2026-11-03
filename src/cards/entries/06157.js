// 06157 自我牺牲
// 卡面：只能投入到你所在地点的另一位调查员执行的技能检定(任意类型)中。
// 卡面：如果本次检定失败，检定失败的所有效果不由执行检定的调查员结算，改为必须由你结算。
//       然后，你抽取2张卡牌，或者执行检定的调查员抽取2张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：commit 描述子 anySkill（可投入任意类型检定：卡面无图标）；失败后可选择抽牌受益者。
// 只能投入同地点另一人的检定；失败效果由 redirectFailureEffects 转给投入者结算。

export default {
  code: '06157',
  abilities: [
    {
      kind: 'commit',
      label: '自我牺牲',
      skill: {
        anySkill: true,
        otherTestOnly: true,
        commitCondition: ({ owner, performer }) => owner.location === performer?.location,
        redirectFailureEffects: true,
        afterTest: ({ state, inv, result, test, api }) => {
          if (result?.success) return
          const performer = state.investigators[test.seat]
          if (!performer) return
          const answer = api.choice({
            kind: 'investigator', source: '06157', seat: inv.seat,
            prompt: '「自我牺牲」：由谁抽取 2 张卡牌？',
            options: [
              { id: String(inv.seat), label: `${inv.name} 抽 2 张` },
              ...(performer.seat !== inv.seat ? [{ id: String(performer.seat), label: `${performer.name} 抽 2 张` }] : []),
            ],
          })
          api.drawCards(Number(answer), 2)
        },
      },
    },
  ],
  modifiers: [],
}
