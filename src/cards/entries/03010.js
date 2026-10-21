// 03010 缜密分析
// 卡面：潘明牌库专用。
// 卡面：每次其他地点的调查员执行技能检定，你都可以投入1张卡牌。
// 卡面：[reaction]你在技能检定中投入正好1张卡牌后，横置缜密分析：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03010',
  passive: { analyticalMind: true, remoteCommit: true },
  abilities: [

  ],
  modifiers: [

  ],
}
