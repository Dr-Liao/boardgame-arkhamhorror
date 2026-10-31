// 06111 浑身是胆
// 卡面：只能投入到攻击或尝试躲避敌人期间的技能检定中。该敌人在本次技能期间获得反击和警戒。
//       在本次检定结束后，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：3 个万能图标由卡面数据通道生效（commitIcons 读 cards-data 的 icons）。
// 显式简化（simplified）：commit 描述子没有「测试期间给敌人加反击/警戒」「检定结束后抽牌」
// 的读点，因此这两条未实现；「只能投入攻击/躲避期间的检定」用引擎已有的
// skill.requireEngagedEnemy（与敌人交战中的检定）近似表达。

export default {
  code: '06111',
  simplified: true,
  note: '未实现：①该敌人在本次技能期间获得反击和警戒；②本次检定结束后抽 1 张卡牌'
    + '（commit 描述子没有「测试期间」/「测试结束后」读点）。「只能投入到攻击或躲避敌人期间的检定」'
    + '以 skill.requireEngagedEnemy 近似（要求投入时与敌人交战）。3 个万能图标由卡面数据通道生效。',
  abilities: [
    {
      kind: 'commit',
      label: '浑身是胆',
      skill: { requireEngagedEnemy: true },
    },
  ],
  modifiers: [],
}
