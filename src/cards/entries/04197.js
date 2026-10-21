// 04197 奥利芙·麦克布莱德
// 卡面：[reaction]在你将要揭示一个混乱标记时，横置奥利芙·麦克布莱德：改为揭示3个混乱标记，而非1个。选择其中2个标记结算，并忽略其余标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04197 奥利芙·麦克布莱德：揭示混乱标记时横置，揭示 3 个选 2 个。

export default {
  code: '04197',
  abilities: [
    {
      kind: 'reaction', trigger: 'tokenReveal', id: 'oliveMcBride', legacyReaction: true,
      criteria: { selfOnly: true }, label: '揭示标记时多揭示并挑选',
      cost: { exhaust: true },
      // Phase 5（5c-11）：不再走 tfaPlayer 逃生原语，改为直接声明「揭示计划」。
      resolve: ({ api }) => {
        api.planTestReveal({ count: 3, choose: 2, source: '04197' })
        api.info('「奥利芙·麦克布莱德」：改为揭示 3 个混乱标记并选择 2 个结算。')
      },
    },
  ],
  modifiers: [

  ],
}
