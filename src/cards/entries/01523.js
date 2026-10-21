// 01523 闪躲
// 卡面：快速。在一个敌人攻击你所在地点的一位调查员时打出。
// 卡面：取消该次攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01523 闪躲：快速事件；敌人攻击同地点调查员时取消该次攻击。

export default {
  code: '01523',
  abilities: [
    {
      kind: 'reaction', trigger: 'enemyAttack', label: '取消该次攻击',
      fromHand: true,
      criteria: [ctx => ctx.context?.location === ctx.inv?.location],
      resolve: ({ context }) => { context.cancelled = true },
    },
  ],
  modifiers: [

  ],
}
