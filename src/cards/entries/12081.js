// 12081 及时干预（Timely Intervention）· 技能 0 经验 · 幸运
// 卡面：每次技能检定最多投入1张。
//       你执行的技能检定期间，你可以在揭示混乱标记后从你的手牌投入及时干预。
//
// 读点（批次 3 原语 `lateCommit`）：
//   · 投入档案 `skill: { lateCommit: true }`：ST.3 常规投入窗口会排除该类卡（tests.js 的投入候选过滤），
//     标记揭示后（ST.5）引擎再次询问是否从手牌投入；费用/上限与常规投入同源
//     （commitCards / canCommitToTest），图标计入本次检定差值（tests.js#performTest ST.5 段）；
//   · 图标（意志/敏捷/万用）与「每次技能检定最多投入1张」来自 cards-data 的 icons 与卡面文本，
//     由 commitIcons / canCommitToTest 自动读取，不在条目里重复声明。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
export default {
  code: '12081',
  abilities: [
    {
      kind: 'commit',
      label: '技能：意志/敏捷/万用图标；揭示混乱标记后可从手牌投入',
      skill: { lateCommit: true },
    },
  ],
  modifiers: [],
}
