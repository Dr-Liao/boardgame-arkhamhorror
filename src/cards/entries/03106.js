// 03106 英勇救援
// 卡面：快速。在一个非[[精英]]敌人将要攻击你所在地点的另一位调查员时打出。
// 卡面：改为你与该敌人交战并对你结算它的攻击。然后，对其造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03106 英勇救援：别人被敌人攻击时快速打出——自己接战、替其承受这次攻击，并反击 1 点。
// 旧原语读 `_reaction.enemyId`，但手牌触发的反应上下文里只有 `enemy`（没有 enemyId），
// 所以这条反应以前**永远不会生效**；现在改读 `enemy`，是一处有意的修正。

export default {
  code: '03106',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'enemyAttack',
      criteria: { otherInvestigator: true, nonEliteOnly: true },
      label: '替其他调查员承受这次攻击并反击 1 点',
      resolve: ({ inv, api }) => {
        const enemy = api.reactionContext()?.enemy
        if (!enemy || !api.isEnemyInPlay(enemy)) return
        api.engage(enemy, inv.seat)
        api.enemyAttackByCard(enemy, api.cardName('03106'), inv.seat)
        api.damageEnemy(enemy, 1, inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
