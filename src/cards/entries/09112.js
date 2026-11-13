// 09112 主动出击（Gumption）· 幸存者技能 · 1 经验 · [[天赋]]
// 卡面：每次技能检定最多投入 1 张。
//       你可以将主动出击投入任意类型的技能检定。
//       主动出击投入到技能检定时，该检定得到难度 -2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · commit 描述子：anySkill（没有印刷图标也能投入任意检定）与 maxPerTest（每次检定 1 张）；
//   · 难度 -2：onCommit 里 api.reduceTestDifficulty(2)（与「降低难度」同一写点，投入后、
//     揭示标记前生效）。
export default {
  code: '09112',
  abilities: [
    {
      kind: 'commit',
      label: '可投入任意检定；本次检定难度 -2',
      skill: {
        anySkill: true,
        maxPerTest: 1,
        onCommit: ({ api }) => { api.reduceTestDifficulty(2) },
      },
    },
  ],
  modifiers: [],
}
