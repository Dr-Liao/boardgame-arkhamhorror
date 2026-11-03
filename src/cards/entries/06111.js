// 06111 浑身是胆
// 卡面：只能投入到攻击或尝试躲避敌人期间的技能检定中。该敌人在本次技能期间获得反击和警戒。
//       在本次检定结束后，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：3 个万能图标由卡面数据通道生效（commitIcons 读 cards-data 的 icons）。
// 投入限定通过检定来源匹配攻击/躲避敌人；本次检定临时授予目标敌人反击和警戒。

export default {
  code: '06111',
  abilities: [
    {
      kind: 'commit',
      label: '浑身是胆',
      skill: {
        commitCondition: ({ test }) => Boolean(test.source?.enemyId)
          && ['攻击', '躲避'].includes(test.source?.label),
        grantEnemyKeywords: ['retaliate', 'alert'],
        afterTest: ({ inv, api }) => api.drawCards(inv.seat, 1),
      },
    },
  ],
  modifiers: [],
}
