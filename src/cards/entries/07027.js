// 07027 眼花缭乱
// 卡面：快速。使用(3充能)。
// 卡面：[reaction]在敌人对你进行趁乱攻击时，花费1充能：取消该次攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 07027 眼花缭乱：快速；使用(3充能)；[反应]趁乱攻击时花 1 充能取消该次攻击。

export default {
  code: '07027',
  uses: 3,
  usesType: 'charges',
  // 卡面「快速。」：打出不花行动、不引发借机攻击（资产关键字写在条目级，读点 lifecycle.playFlag）。
  fast: true,
  abilities: [
    {
      kind: 'reaction', trigger: 'opportunityAttack', label: '花 1 充能：取消该次攻击',
      cost: { uses: 1 },
      resolve: ({ context }) => { context.cancelled = true },
    },
  ],
  modifiers: [

  ],
}
