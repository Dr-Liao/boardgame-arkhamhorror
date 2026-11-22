// 12067 灵魂链接（Soul Link）
// 卡面：作为投入灵魂链接的额外费用，受到1点恐惧。
//
// 读点：
//   · 投入技能检定 → commit 档案（commitProfile 的既有读点）；
//   · 「投入时受到 1 点恐惧」→ commit 档案 onCommit 回调（tests.js#collectForcedCommitments 在投入时调用，
//     与 12012 等「投入时结算」同一时机）；伤害/恐惧只走 api.horror。
const CODE = '12067'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '投入时受到 1 点恐惧（额外费用）',
      skill: {
        anySkill: true,
        onCommit: ({ inv, api }) => {
          api.horror(inv.seat, 1)
          api.info(`🔗「灵魂链接」：${inv.name} 作为投入的额外费用受到 1 点恐惧。`)
        },
      },
    },
  ],
  modifiers: [],
}
