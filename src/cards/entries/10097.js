// 10097 奥利芙·麦克布莱德（Olive McBride）· 潜修者支援 · 2 资源 · 盟友槽 · 2 经验 · 盟友/女巫
// 卡面：
//   [reaction] 在你将要揭示一个混乱标记时，横置奥利芙·麦克布莱德：改为揭示 4 个混乱标记，而非 1 个。
//   选择其中 2 个标记结算，并忽略其余标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「将要揭示一个混乱标记时」→ trigger: 'tokenReveal'（tests.js#campaignBeforeChaosReveal 先开
//     triggerReaction 再开 reactionWindow；与 04197 同一窗口）。
//   · 「横置」→ cost:{ exhaust: true }（canAffordAbility 的横置费读点）。
//   · 「改为揭示 4 个，选 2 个结算」→ api.planTestReveal({ count, choose, source })：
//     tests.js 取出计划后揭示 count 个，逐次询问要结算的 choose 个，其余 returnChaosToken 归还
//     （04197 3/2、04032 5/1 同一原语）。
//   · 旧式反应询问沿用 04197 的 legacyReaction + criteria{selfOnly}：tokenReveal 窗口的询问文案与
//     状态指纹与 TFA 那张同名卡一致；id 改成 oliveMcBride2（等级 2 的独立限次键）。
export default {
  code: '10097',
  name: '奥利芙·麦克布莱德',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'tokenReveal',
      id: 'oliveMcBride2',
      legacyReaction: true,
      criteria: { selfOnly: true },
      label: '揭示标记时改为揭示 4 个并选择 2 个结算',
      cost: { exhaust: true },
      resolve: ({ api }) => {
        api.planTestReveal({ count: 4, choose: 2, source: '10097' })
        api.info('「奥利芙·麦克布莱德」：改为揭示 4 个混乱标记并选择 2 个结算。')
      },
    },
  ],
  modifiers: [],
}
