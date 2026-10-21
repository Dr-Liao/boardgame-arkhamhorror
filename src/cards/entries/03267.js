// 03267 侥幸逃脱
// 卡面：快速。在敌人对你进行趁乱攻击时打出。
// 卡面：取消该次攻击。本回合中你下次执行的技能检定得到技能值+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03267 窄路逃生：借机攻击时快速打出，取消攻击并让下一次躲避 +2。

export default {
  code: '03267',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'opportunityAttack',
      criteria: { selfOnly: true },
      label: '窄路逃生',
      resolve: ({ inv, api }) => {
        api.cancelCurrentAttack()
        api.prepareEvadeBonus(2, inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
