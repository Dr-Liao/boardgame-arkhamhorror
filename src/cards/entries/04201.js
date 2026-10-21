// 04201 重拾信念
// 卡面：每次技能检定最多投入1张。
// 卡面：你可以将重拾信念投入任意类型的检定。
// 卡面：如果本次检定失败，执行检定的调查员抽取2张卡牌并获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04201',
  abilities: [
    {
      kind: 'commit',
      label: '重拾信念',
      skill: { maxPerTest: 1, anySkill: true, onFail: { draw: 2, resources: 2 } },
    },
  ],
  modifiers: [

  ],
}
