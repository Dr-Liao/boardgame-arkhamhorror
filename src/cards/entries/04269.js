// 04269 最后的枪击
// 卡面：对你所在地点的一个敌人造成1点伤害。如果本效果击败该敌人，抽取1张卡牌。如果现在是你的回合，结束你的回合。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04269 最后一击：对同地点敌人造成 1 点伤害；击败则抽 1；若是自己的回合则结束回合。
//
// 2026-10-27 修复（白吞卡）：这张事件必须选择同地点一名敌人才能结算。旧实现在无敌人时
// 直接结束自己的回合（牌和行动都白费）。补 playCondition，并与 resolve 共用同一份候选。

function damageTargets(state, inv) {
  return state.enemies.filter(enemy => enemy.location === inv.location)
}

export default {
  code: '04269',
  playCondition: [{
    when: ({ state, inv }) => damageTargets(state, inv).length > 0,
    message: '所在地点没有可射击的敌人',
  }],
  abilities: [
    {
      kind: 'played', noOpportunityAttack: true, label: '对同地点敌人造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        const targets = damageTargets(state, inv)
        if (targets.length) {
          const chosen = targets.length === 1 ? targets[0].id
            : api.choice({ kind: 'target', source: '04269', seat: inv.seat, prompt: '选择要射击的敌人。',
              options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
          const enemy = targets.find(item => item.id === chosen) || targets[0]
          api.damageEnemy(enemy, 1, inv.seat)
          if (!state.enemies.includes(enemy)) api.drawCards(inv.seat, 1)
        } else api.info(`${inv.name} 的射击没有目标。`)
        if (state.currentSeat === inv.seat) api.endTurn(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
