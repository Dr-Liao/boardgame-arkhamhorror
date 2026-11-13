// 09030 战斗课程（Fighting Lessons）· 守卫者技能 · 0 经验。
// 卡面：只能投入到攻击或躲避尝试期间的技能检定。
//       你能将本技能投入到任意地点调查员的检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：投入限制写在 commit 档案的 commitCondition（commit-rules.js 的唯一读点）；
// 攻击/躲避检定的来源标签与 06111 同口径。 「任意地点调查员」是默认投入口径（不限制座位）。
export default {
  code: '09030',
  abilities: [
    {
      kind: 'commit',
      label: '只能投入攻击或躲避检定；可投入任意地点调查员的检定',
      skill: {
        commitCondition: ({ test }) => ['攻击', '躲避'].includes(test.source?.label),
      },
    },
  ],
  modifiers: [],
}
