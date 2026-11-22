// 60582 及时干预 · 技能 3 经验（万用×3，幸运，生存者）
// 卡面：每次技能检定最多投入1张。
//       你执行的技能检定期间，你可以在揭示混乱标记后从你的手牌投入及时干预。
//
// 参考实现 `Skill/CardDefs/Standalone.hs#timelyIntervention3`：cdCommitRestrictions =
//   [MaxOnePerTest, CanCommitAfterRevealingTokens]，没有「失败返回手牌」之类的额外规则；
// 因此本卡与 12081 同构，只声明批次 3 的 `lateCommit` 投入档案。
// 读点：tests.js#performTest 的 ST.3 排除 / ST.5 揭示后询问，费用与上限复用 commitCards。
const CODE = '60582'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      label: '技能：万用×3；揭示混乱标记后可从手牌投入',
      skill: { lateCommit: true },
    },
  ],
  modifiers: [],
  note: '核对：参考实现只有 MaxOnePerTest + CanCommitAfterRevealingTokens，没有「失败返回手牌」规则，'
    + '故只接 lateCommit；若后续确认卡面有失败返回文本，用 commit 档案 onFail + api.setCommitDestination(source, \'hand\') 补充。',
}
