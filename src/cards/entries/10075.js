// 10075 福倚祸伏（Diabolical Luck）· 潜袭者（Rogue）技能 · 0 费 · [[幸运]]/[[被诅咒]]。
// 卡面：你执行的技能检定期间，在你揭示一个[诅咒]标记时，你可以将福倚祸伏从手牌投入到该技能检定。
//       如果你这么做，福倚祸伏获得[意志][意志][意志]（3 个[万能]图标）。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 正常投入 → commit 描述子（印刷 1 个[万能]图标由 cards-data 提供）。
//   · 「揭示[诅咒]标记时从手牌投入」→ reaction + fromHand + trigger:'tokenReveal'（tests.js 在
//     ST.4 揭示标记后开窗；duringOwnSkillTest 锁定“你执行的检定”）；resolve 调 api.commitCards
//     把本卡放进投入区。
//   · 晚投入与三个新增图标均走检定的标准投入入口。
const CODE = '10075'


export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '福倚祸伏：投入本次技能检定（1 个[万能]图标）',
      skill: {},
    },
    {
      kind: 'reaction',
      fromHand: true,
      noPlayCost: true,
      duringOwnSkillTest: true,
      trigger: 'tokenReveal',
      label: '揭示[诅咒]标记后：从手牌投入福倚祸伏（获得 3 个[万能]图标）',
      criteria: [({ state, inv, context }) => {
        if (!state.skillTest || state.skillTest.seat !== inv.seat) return false
        if (context?.when !== 'tokenReveal' || context.token !== 'curse') return false
        if (context.replacementToken || context.cancelled) return false
        return (inv.hand || []).includes(CODE)
      }],
      resolve: ({ inv, api }) => {
        api.commitCards(inv.seat, [CODE], { extraIcons: ['wild', 'wild', 'wild'] })
      },
    },
  ],
  modifiers: [],
}
