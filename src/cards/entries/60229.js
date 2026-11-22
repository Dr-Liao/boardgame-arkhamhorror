// 60229 禁忌之书
// 卡面：研究。(FAQ, v2.0)
// 卡面：[action][action][action][action]横置禁忌之书：将你所在地点的一张玩家卡上的1点伤害移动到你所在地点的一名敌人上。你每有4张手牌，本能力费用减少1个行动(最低减至[action])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

function damagedCards(state, inv) {
  const investigators = state.investigators.filter(player => !player.defeated && !player.resigned
    && player.location === inv.location)
  return [
    ...investigators.filter(player => player.damage > 0)
      .map(card => ({ id: 'investigator:' + card.seat, card, damage: card.damage })),
    ...investigators.flatMap(player => player.assets.filter(card => card.damage > 0)
      .map(card => ({ id: card.id, card, damage: card.damage, asset: true }))),
  ]
}

export default {
  code: '60229',
  researchRequirement: 'translatedForbiddenTome',
  researchUpgradeFrom: '60210',
  abilities: [{
    kind: 'action', cost: { action: ({ inv }) => Math.max(1, 4 - Math.floor(inv.hand.length / 4)), exhaust: true },
    label: '横置：将同地点玩家卡的 1 伤害转移到同地点敌人；每 4 张手牌少花费 1 行动',
    criteria: ({ state, inv, helpers }) => damagedCards(state, inv).length > 0
      && state.enemies.some(enemy => enemy.location === inv.location && helpers.canDamageEnemy(enemy, inv.seat, '60229')),
    resolve: ({ state, inv, api }) => {
      const cards = damagedCards(state, inv)
      const enemies = state.enemies.filter(enemy => enemy.location === inv.location && api.canDamageEnemy(enemy, inv.seat, '60229'))
      if (!cards.length || !enemies.length) return
      const id = cards.length === 1 ? cards[0].id : api.choice({
        kind: 'card', source: '60229', seat: inv.seat, prompt: '选择要移走 1 伤害的调查员或支援。',
        options: cards.map(item => ({ id: item.id, cardCode: item.card.code, label: api.cardName(item.card.code) })),
      })
      const target = cards.find(item => item.id === id)
      if (!target) return
      const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'enemy', source: '60229', seat: inv.seat, prompt: '选择要接收 1 伤害的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === enemyId)
      if (!enemy) return
      const healed = target.asset ? api.healAsset(target.card, { damage: 1 }) : api.healDamage(target.card.seat, 1)
      if (typeof healed === 'number' ? healed > 0 : target.card.damage < target.damage) {
        api.damageEnemy(enemy, 1, inv.seat, '60229')
      }
    },
  }],
}
