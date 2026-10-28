// 05317 鲜血仪式
// 卡面：绑定(密教辞典)。
// 卡面：抽取2张卡牌。弃掉你最多2张手牌。每有一张卡牌因此被弃掉，你可以获得1资源，
//       或者花费1资源来对你所在地点的一个敌人造成1点伤害。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05317 鲜血仪式：抽 2 → 弃最多 2 张手牌 → 每弃 1 张可换 1 资源或花 1 资源造成 1 点伤害。
// noOpportunityAttack 写在 played 描述子上（卡面明写「不会触发趁乱攻击」）。

export default {
  code: '05317',
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '抽 2 张，弃最多 2 张手牌并换取资源/伤害',
      resolve: ({ inv, state, api }) => {
        api.drawCards(inv.seat, 2)
        for (let round = 0; round < 2; round++) {
          const hand = state.investigators[inv.seat].hand
          if (!hand.length) break
          const answer = api.choice({ kind: 'discard', source: '05317', seat: inv.seat, canSkip: true,
            prompt: '弃掉最多 2 张手牌（每张可换 1 资源或花 1 资源造成 1 点伤害）。',
            options: [{ id: 'done', label: '不再弃牌' },
              ...hand.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))] })
          if (answer === 'done' || answer === undefined) break
          const code = hand[Number(answer)]
          if (!code) break
          api.discardFromHand(inv.seat, code)
          const follow = api.choice({ kind: 'effect', source: '05317', seat: inv.seat,
            prompt: `「${api.cardName(code)}」被弃掉：获得 1 资源，或花 1 资源造成 1 点伤害。`,
            options: [{ id: 'resource', label: '获得 1 资源' },
              { id: 'damage', label: '花费 1 资源，对所在地点一个敌人造成 1 点伤害' },
              { id: 'skip', label: '不结算' }] })
          if (follow === 'resource') api.gainResources(inv.seat, 1)
          else if (follow === 'damage') {
            if (inv.resources < 1) { api.info(`资源不足，无法用「${api.cardName(code)}」造成伤害。`); continue }
            const enemies = state.enemies.filter(enemy => enemy.location === inv.location)
            if (!enemies.length) { api.info('这里没有可伤害的敌人。'); continue }
            // 卡面「花费 1 资源」= 支付费用：走统一的支付入口（合并池先扣寄存量）。
            api.spendResources(inv.seat, 1)
            const target = enemies.length === 1 ? enemies[0] : state.enemies.find(enemy => enemy.id === api.choice({
              kind: 'target', source: '05317', seat: inv.seat, prompt: '选择要伤害的敌人。',
              options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
            }))
            if (target) api.damageEnemy(target, 1, inv.seat)
          }
        }
      },
    },
  ],
  modifiers: [

  ],
}
